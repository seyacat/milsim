import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { AuthService } from '../services/auth.js'
import { User, Game, ControlPoint, TeamColor } from '../types/index.js'
import type { PositionBroadcastData } from '../types/position-types.js'
import {
  ControlPointCreatedEvent,
  ControlPointUpdatedEvent,
  ControlPointTakenEvent,
  BombActivatedEvent,
  BombDeactivatedEvent,
  ControlPointTeamAssignedEvent,
  GameStateChangedEvent,
  TeamCountUpdatedEvent,
  TimeAddedEvent,
  GameTimeUpdatedEvent,
  GameTimeEvent,
  TimeUpdateEvent,
  ControlPointTimeUpdateEvent,
  BombTimeUpdateEvent,
  ActiveBombTimersEvent,
  PositionChallengeUpdateEvent,
  PlayerTeamUpdatedEvent,
  PositionUpdateEvent
} from '../types/websocket-events.js'
import { useToast } from './useToast.js'

// Game-specific WebSocket connections
const gameConnections = new Map<number, Socket>() // gameId -> Socket
const gameConnectionCounts = new Map<number, number>() // gameId -> connection count
const gameReconnectAttempts = new Map<number, number>() // gameId -> reconnect attempts
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 2000 // 2 seconds
const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const HEARTBEAT_TIMEOUT = 10000 // 10 seconds

// Función para configurar los listeners del socket
const setupSocketListeners = (
  socket: Socket,
  gameId: number,
  callbacks: {
    onGameUpdate: (game: Game) => void
    onControlPointCreated: (controlPoint: ControlPoint) => void
    onControlPointUpdated: (controlPoint: ControlPoint) => void
    onControlPointDeleted: (controlPointId: number) => void
    onJoinSuccess: (user: User) => void
    onError: (error: string) => void
    onGameTime: (data: any) => void
    onTimeUpdate?: (data: any) => void
    onPlayerPosition?: (data: PositionBroadcastData) => void
    onBombTimeUpdate?: (data: any) => void
    onActiveBombTimers?: (data: any) => void
    onPositionChallengeUpdate?: (data: any) => void
    onControlPointTeamAssigned?: (data: ControlPointTeamAssignedEvent) => void
    onPlayerTeamUpdated?: (data: any) => void
    onGameAction?: (data: any) => void
    onControlPointTaken?: (data: ControlPointTakenEvent) => void
    onBombActivated?: (data: BombActivatedEvent) => void
    onBombDeactivated?: (data: BombDeactivatedEvent) => void
  },
  addToast: any
) => {
  let heartbeatInterval: NodeJS.Timeout | null = null
  let heartbeatTimeout: NodeJS.Timeout | null = null

  const startHeartbeat = () => {
    // Clear any existing heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
    }
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout)
    }

    // Send heartbeat every 30 seconds
    heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', { timestamp: Date.now() })
        
        // Set timeout to detect if server doesn't respond
        heartbeatTimeout = setTimeout(() => {
          console.warn('Heartbeat timeout - server not responding')
          addToast({ message: 'Servidor no responde, reconectando...', type: 'warning' })
          socket.disconnect()
          setTimeout(() => {
            socket.connect()
          }, 1000)
        }, HEARTBEAT_TIMEOUT)
      }
    }, HEARTBEAT_INTERVAL)
  }

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout)
      heartbeatTimeout = null
    }
  }

  socket.on('connect', () => {
    // Reset reconnection attempts for this game on successful connection
    gameReconnectAttempts.set(gameId, 0)
    
    // Start heartbeat when connected
    startHeartbeat()
    
    // Always rejoin the game when reconnecting to ensure we're in the right state
    socket.emit('joinGame', { gameId })
    addToast({ message: 'Conectado al servidor', type: 'success' })
  })

  // Handle reconnection events specifically
  socket.on('reconnect', (attemptNumber) => {
    
    // Rejoin the game to ensure we're properly synchronized
    socket.emit('joinGame', { gameId })
    addToast({ message: 'Reconectado al servidor', type: 'success' })
  })

  socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
    if (data.game) {
      callbacks.onGameUpdate(data.game)
    }
  })

  // Add game state listeners for real-time state synchronization
  socket.on('gameState', (game: Game) => {
    if (game) {
      callbacks.onGameUpdate(game)
    }
  })

  // Listen for specific game state change events
  socket.on('gameStateChanged', (data: GameStateChangedEvent) => {
    if (data.game) {
      callbacks.onGameUpdate(data.game)
    }
  })

  // Listen for team count updated events
  socket.on('teamCountUpdated', (data: TeamCountUpdatedEvent) => {
    if (data.game) {
      callbacks.onGameUpdate(data.game)
    }
  })

  // Listen for time added events
  socket.on('timeAdded', (data: TimeAddedEvent) => {
    if (data.game) {
      callbacks.onGameUpdate(data.game)
    }
  })

  // Listen for game time updated events
  socket.on('gameTimeUpdated', (data: GameTimeUpdatedEvent) => {
    if (data.game) {
      callbacks.onGameUpdate(data.game)
    }
  })

  // DEPRECATED: Keep gameAction listener for backward compatibility
  // This should be removed once all events are migrated to specific types
  socket.on('gameAction', (data: { action: string; data: any }) => {
    
    // Log specific info for playerTeamUpdated events
    if (data.action === 'playerTeamUpdated') {
      console.log('useWebSocket - Processing playerTeamUpdated gameAction:', data)
    }
    
    // Only handle specific actions that need centralized processing
    if (data.action === 'gameStateChanged' && data.data.game) {
      callbacks.onGameUpdate(data.data.game)
    }
    
    // Call the general gameAction callback for all gameAction events
    if (callbacks.onGameAction) {
      callbacks.onGameAction(data)
    }
  })

  socket.on('joinSuccess', (data: { user: User }) => {
    if (data.user) {
      callbacks.onJoinSuccess(data.user)
    }
  })

  socket.on('gameActionError', (data: { action: string; error: string }) => {
    console.error(`Game action error (${data.action}):`, data.error)
    addToast({ message: `Error: ${data.error}`, type: 'error' })
    callbacks.onError(data.error)
  })

  socket.on('joinError', (data: any) => {
    console.error('Join error received:', data)
    const errorMessage = `Error al unirse al juego: ${data.message || 'Error desconocido'}`
    addToast({ message: errorMessage, type: 'error' })
    callbacks.onError(errorMessage)
  })

  socket.on('connect_error', (error: Error) => {
    console.error('WebSocket connection error:', error)
    const errorMessage = 'Error de conexión WebSocket: ' + error.message
    addToast({ message: errorMessage, type: 'error' })
    callbacks.onError(errorMessage)
    
    // Attempt reconnection
    const currentAttempts = gameReconnectAttempts.get(gameId) || 0
    if (currentAttempts < MAX_RECONNECT_ATTEMPTS) {
      gameReconnectAttempts.set(gameId, currentAttempts + 1)
      setTimeout(() => {
        if (socket.disconnected) {
          socket.connect()
        }
      }, RECONNECT_DELAY)
    } else {
      console.error('Max reconnection attempts reached')
      addToast({ message: 'No se pudo reconectar al servidor', type: 'error' })
    }
  })

  // Handle heartbeat response from server
  socket.on('heartbeat_ack', (data: { timestamp: number }) => {
    // Clear the timeout since server responded
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout)
      heartbeatTimeout = null
    }
  })

  socket.on('disconnect', (reason) => {
    // Stop heartbeat when disconnected
    stopHeartbeat()
    
    if (reason === 'io server disconnect' || reason === 'transport close') {
      addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
      callbacks.onError('Conexión perdida con el servidor')
      
      // Attempt reconnection for unexpected disconnections
      const currentAttempts = gameReconnectAttempts.get(gameId) || 0
      if (reason === 'transport close' && currentAttempts < MAX_RECONNECT_ATTEMPTS) {
        gameReconnectAttempts.set(gameId, currentAttempts + 1)
        setTimeout(() => {
          if (socket.disconnected) {
            socket.connect()
          }
        }, RECONNECT_DELAY)
      }
    }
  })

  // Debug: listen to all events
  socket.onAny((eventName, ...args) => {
  })

  // Handle control point specific events with proper typing
  socket.on('controlPointCreated', (data: ControlPointCreatedEvent) => {
    
    // Extract control point data from the correct structure - data is {controlPoint: {...}}
    const controlPointData = data.controlPoint
    
    
    // Debug the actual control point data structure
    
    // Validate that we have required coordinates
    const latitude = controlPointData?.latitude ? parseFloat(controlPointData.latitude.toString()) : 0
    const longitude = controlPointData?.longitude ? parseFloat(controlPointData.longitude.toString()) : 0
    
    if (!controlPointData || !controlPointData.id || !controlPointData.name || latitude === 0 || longitude === 0) {
      console.error('useWebSocket - Invalid control point data received:', controlPointData)
      console.error('useWebSocket - Original data structure:', data)
      return
    }
    
    // Convert ownedByTeam from string | null to TeamColor | undefined
    const ownedByTeam = controlPointData.ownedByTeam && controlPointData.ownedByTeam !== 'none'
      ? controlPointData.ownedByTeam as TeamColor
      : undefined
    
    // Map backend ControlPoint entity to frontend ControlPoint interface
    const controlPoint: ControlPoint = {
      id: controlPointData.id,
      name: controlPointData.name,
      description: controlPointData.description || undefined,
      latitude: latitude,
      longitude: longitude,
      type: controlPointData.type as 'site' | 'control_point',
      ownedByTeam: ownedByTeam,
      hasBombChallenge: controlPointData.hasBombChallenge || false,
      hasPositionChallenge: controlPointData.hasPositionChallenge || false,
      hasCodeChallenge: controlPointData.hasCodeChallenge || false,
      bombTimer: undefined, // Not provided by backend
      bombStatus: undefined, // Not provided by backend
      currentTeam: undefined, // Not provided by backend
      currentHoldTime: undefined, // Not provided by backend
      displayTime: undefined, // Not provided by backend
      lastTimeUpdate: undefined, // Not provided by backend
      minDistance: controlPointData.minDistance || undefined,
      minAccuracy: controlPointData.minAccuracy || undefined,
      code: controlPointData.code || undefined,
      bombTime: controlPointData.bombTime || undefined,
      armedCode: controlPointData.armedCode || undefined,
      disarmedCode: controlPointData.disarmedCode || undefined
    }
    callbacks.onControlPointCreated(controlPoint)
  })

  // Note: controlPointUpdated events now come through gameAction handler above
  // This direct listener is kept for backward compatibility
  socket.on('controlPointUpdated', (data: ControlPointUpdatedEvent) => {
    
    // Ensure the control point has the expected structure - data is {controlPoint: {...}}
    const controlPointData = data.controlPoint
    
    // Debug the control point data structure
    
    // Validate that we have required coordinates
    const latitude = controlPointData?.latitude ? parseFloat(controlPointData.latitude.toString()) : 0
    const longitude = controlPointData?.longitude ? parseFloat(controlPointData.longitude.toString()) : 0
    
    if (!controlPointData || !controlPointData.id || !controlPointData.name || latitude === 0 || longitude === 0) {
      console.error('useWebSocket - Invalid control point data received:', controlPointData)
      console.error('useWebSocket - Original data structure:', data)
      return
    }
    
    // Convert ownedByTeam from string | null to TeamColor | undefined
    const ownedByTeam = controlPointData.ownedByTeam && controlPointData.ownedByTeam !== 'none'
      ? controlPointData.ownedByTeam as TeamColor
      : undefined
    
    const controlPoint: ControlPoint = {
      id: controlPointData.id,
      name: controlPointData.name,
      description: controlPointData.description || undefined,
      latitude: latitude,
      longitude: longitude,
      type: controlPointData.type as 'site' | 'control_point',
      ownedByTeam: ownedByTeam,
      hasBombChallenge: controlPointData.hasBombChallenge || false,
      hasPositionChallenge: controlPointData.hasPositionChallenge || false,
      hasCodeChallenge: controlPointData.hasCodeChallenge || false,
      bombTimer: undefined,
      bombStatus: undefined,
      currentTeam: undefined,
      currentHoldTime: undefined,
      displayTime: undefined,
      lastTimeUpdate: undefined,
      minDistance: controlPointData.minDistance || undefined,
      minAccuracy: controlPointData.minAccuracy || undefined,
      code: controlPointData.code || undefined,
      bombTime: controlPointData.bombTime || undefined,
      armedCode: controlPointData.armedCode || undefined,
      disarmedCode: controlPointData.disarmedCode || undefined
    }
    
    callbacks.onControlPointUpdated(controlPoint)
  })

  socket.on('controlPointDeleted', (data: { controlPointId: number }) => {
    callbacks.onControlPointDeleted(data.controlPointId)
  })

  // Handle game time updates for control point timers
  socket.on('gameTime', (data: GameTimeEvent) => {
    callbacks.onGameTime(data)
  })

  // Handle time updates (broadcast every 20 seconds)
  socket.on('timeUpdate', (data: TimeUpdateEvent) => {
    if (callbacks.onTimeUpdate) {
      callbacks.onTimeUpdate(data)
    }
  })

  // Handle individual control point time updates
  socket.on('controlPointTimeUpdate', (data: ControlPointTimeUpdateEvent) => {
    // Forward to gameTime handler for processing
    if (data && data.controlPointId) {
      callbacks.onGameTime(data)
    }
  })

  // Handle bomb timer updates
  socket.on('bombTimeUpdate', (data: BombTimeUpdateEvent) => {
    if (callbacks.onBombTimeUpdate) {
      callbacks.onBombTimeUpdate(data)
    }
  })

  // Handle active bomb timers response
  socket.on('activeBombTimers', (data: ActiveBombTimersEvent) => {
    if (callbacks.onActiveBombTimers) {
      callbacks.onActiveBombTimers(data)
    }
  })

  // Handle position challenge updates
  socket.on('positionChallengeUpdate', (data: PositionChallengeUpdateEvent) => {
    if (callbacks.onPositionChallengeUpdate) {
      callbacks.onPositionChallengeUpdate(data)
    }
  })

  // Note: controlPointTeamAssigned events now come through gameAction handler above
  // This direct listener is kept for backward compatibility
  socket.on('controlPointTeamAssigned', (data: ControlPointTeamAssignedEvent) => {
    
    // Extract control point data from the event structure
    const controlPointData = data.controlPoint
    const latitude = typeof controlPointData?.latitude === 'string'
      ? parseFloat(controlPointData.latitude)
      : controlPointData?.latitude || 0
    const longitude = typeof controlPointData?.longitude === 'string'
      ? parseFloat(controlPointData.longitude)
      : controlPointData?.longitude || 0
    
    // Convert ownedByTeam from string | null to TeamColor | undefined
    const ownedByTeam = controlPointData.ownedByTeam && controlPointData.ownedByTeam !== 'none'
      ? controlPointData.ownedByTeam as TeamColor
      : undefined
    
    const controlPoint: ControlPoint = {
      id: controlPointData.id,
      name: controlPointData.name,
      description: controlPointData.description || undefined,
      latitude: latitude,
      longitude: longitude,
      type: controlPointData.type as 'site' | 'control_point',
      ownedByTeam: ownedByTeam,
      hasBombChallenge: controlPointData.hasBombChallenge || false,
      hasPositionChallenge: controlPointData.hasPositionChallenge || false,
      hasCodeChallenge: controlPointData.hasCodeChallenge || false,
      bombTimer: undefined,
      bombStatus: undefined,
      currentTeam: undefined,
      currentHoldTime: undefined,
      displayTime: undefined,
      lastTimeUpdate: undefined,
      minDistance: controlPointData.minDistance || undefined,
      minAccuracy: controlPointData.minAccuracy || undefined,
      code: controlPointData.code || undefined,
      bombTime: controlPointData.bombTime || undefined,
      armedCode: controlPointData.armedCode || undefined,
      disarmedCode: controlPointData.disarmedCode || undefined
    }
    
    
    if (callbacks.onControlPointTeamAssigned) {
      callbacks.onControlPointTeamAssigned(data)
    } else {
      console.log('No onControlPointTeamAssigned callback registered')
    }
  })

  // Handle player team updates
  socket.on('playerTeamUpdated', (data: PlayerTeamUpdatedEvent) => {
    if (callbacks.onPlayerTeamUpdated) {
      callbacks.onPlayerTeamUpdated(data)
    } else {
      console.log('useWebSocket - No onPlayerTeamUpdated callback registered')
    }
  })

  // Handle control point taken events
  socket.on('controlPointTaken', (data: ControlPointTakenEvent) => {
    if (callbacks.onControlPointTaken) {
      callbacks.onControlPointTaken(data)
    } else {
      console.log('useWebSocket - No onControlPointTaken callback registered')
    }
  })

  // Handle bomb activated events
  socket.on('bombActivated', (data: BombActivatedEvent) => {
    if (callbacks.onBombActivated) {
      callbacks.onBombActivated(data)
    } else {
      console.log('useWebSocket - No onBombActivated callback registered')
    }
  })

  // Handle bomb deactivated events
  socket.on('bombDeactivated', (data: BombDeactivatedEvent) => {
    if (callbacks.onBombDeactivated) {
      callbacks.onBombDeactivated(data)
    } else {
      console.log('useWebSocket - No onBombDeactivated callback registered')
    }
  })

  // Handle position update events (direct position updates from players)
  socket.on('positionUpdate', (data: PositionUpdateEvent) => {
    if (callbacks.onPlayerPosition) {
      callbacks.onPlayerPosition(data as PositionBroadcastData)
    }
  })
}

export const useWebSocket = () => {
  const socketRef = ref<Socket | null>(null)
  const isConnecting = ref(false)
  const { addToast } = useToast()

  const connectWebSocket = (
    gameId: number,
    callbacks: {
      onGameUpdate: (game: Game) => void
      onControlPointCreated: (controlPoint: ControlPoint) => void
      onControlPointUpdated: (controlPoint: ControlPoint) => void
      onControlPointDeleted: (controlPointId: number) => void
      onJoinSuccess: (user: User) => void
      onError: (error: string) => void
      onGameTime: (data: any) => void
      onTimeUpdate?: (data: any) => void
      onPlayerPosition?: (data: PositionBroadcastData) => void
      onBombTimeUpdate?: (data: any) => void
      onActiveBombTimers?: (data: any) => void
      onPositionChallengeUpdate?: (data: any) => void
      onControlPointTeamAssigned?: (data: ControlPointTeamAssignedEvent) => void
      onPlayerTeamUpdated?: (data: any) => void
      onGameAction?: (data: any) => void
      onControlPointTaken?: (data: ControlPointTakenEvent) => void
      onBombActivated?: (data: BombActivatedEvent) => void
      onBombDeactivated?: (data: BombDeactivatedEvent) => void
    }
  ) => {
    // Check if we already have a connection for this specific game
    const existingSocket = gameConnections.get(gameId)
    if (existingSocket && existingSocket.connected) {
      socketRef.value = existingSocket
      const currentCount = gameConnectionCounts.get(gameId) || 0
      gameConnectionCounts.set(gameId, currentCount + 1)
      
      // Configure callbacks on the existing connection
      setupSocketListeners(existingSocket, gameId, callbacks, addToast)
      return existingSocket
    }

    // Clean up any existing connection for this game that might be in a bad state
    if (existingSocket && (!existingSocket.connected || existingSocket.disconnected)) {
      try {
        existingSocket.disconnect()
      } catch (error) {
        console.error('Error cleaning up old socket for game:', gameId, error)
      }
      gameConnections.delete(gameId)
      gameConnectionCounts.delete(gameId)
      gameReconnectAttempts.delete(gameId)
    }

    isConnecting.value = true

    try {
      const token = AuthService.getToken()
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}`
      
      
      // Use exact same configuration as React with reconnection options
      const socket = io(wsUrl, {
        auth: {
          token: token  // No Bearer prefix, just the raw token
        },
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: RECONNECT_DELAY,
        reconnectionDelayMax: 10000,
        timeout: 20000
      })
      
      // Store the connection for this specific game
      gameConnections.set(gameId, socket)
      socketRef.value = socket
      const currentCount = gameConnectionCounts.get(gameId) || 0
      gameConnectionCounts.set(gameId, currentCount + 1)
      gameReconnectAttempts.set(gameId, 0)

      // Configure all socket listeners
      setupSocketListeners(socket, gameId, callbacks, addToast)

      return socket
    } catch (error) {
      console.error('Failed to initialize WebSocket for game:', gameId, error)
      isConnecting.value = false
      addToast({ message: 'Error al inicializar WebSocket', type: 'error' })
      throw error
    }
  }

  const emitGameAction = (gameId: number, action: string, data?: any) => {
    if (!socketRef.value) {
      console.error('WebSocket not connected')
      return false
    }

    try {
      socketRef.value.emit('gameAction', {
        gameId,
        action,
        data
      })
      return true
    } catch (error) {
      console.error('Error emitting game action:', error)
      addToast({ message: 'Error al enviar acción', type: 'error' })
      return false
    }
  }

  const disconnectWebSocket = () => {
    if (socketRef.value) {
      // Find which game this socket belongs to
      let targetGameId: number | null = null
      for (const [gameId, socket] of gameConnections.entries()) {
        if (socket === socketRef.value) {
          targetGameId = gameId
          break
        }
      }
      
      if (targetGameId !== null) {
        const currentCount = gameConnectionCounts.get(targetGameId) || 0
        const newCount = Math.max(0, currentCount - 1)
        gameConnectionCounts.set(targetGameId, newCount)
        
        // Only disconnect completely if no more references for this game
        if (newCount <= 0) {
          socketRef.value.disconnect()
          gameConnections.delete(targetGameId)
          gameConnectionCounts.delete(targetGameId)
          gameReconnectAttempts.delete(targetGameId)
        }
      }
      
      socketRef.value = null
      isConnecting.value = false
    }
  }

  const checkConnection = () => {
    if (socketRef.value && !socketRef.value.connected) {
      try {
        socketRef.value.connect()
      } catch (error) {
        console.error('Error during WebSocket reconnection:', error)
        addToast({ message: 'Error al reconectar WebSocket', type: 'error' })
      }
      return false
    }
    return socketRef.value?.connected || false
  }

  const forceReconnect = () => {
    if (socketRef.value) {
      try {
        socketRef.value.disconnect()
        setTimeout(() => {
          try {
            socketRef.value?.connect()
          } catch (error) {
            console.error('Error during forced WebSocket reconnection:', error)
            addToast({ message: 'Error al forzar reconexión WebSocket', type: 'error' })
          }
        }, 1000)
      } catch (error) {
        console.error('Error during WebSocket disconnection:', error)
        addToast({ message: 'Error al desconectar WebSocket', type: 'error' })
      }
    }
  }

  // Enhanced connection health check with automatic recovery
  const startConnectionHealthCheck = () => {
    const healthCheckInterval = setInterval(() => {
      if (socketRef.value && !socketRef.value.connected) {
        checkConnection()
      }
    }, 10000) // Check every 10 seconds

    return () => clearInterval(healthCheckInterval)
  }

  onUnmounted(() => {
    disconnectWebSocket()
  })

  return {
    socketRef,
    connectWebSocket,
    emitGameAction,
    disconnectWebSocket,
    checkConnection,
    forceReconnect
  }
}