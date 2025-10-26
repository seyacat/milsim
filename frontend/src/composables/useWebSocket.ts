import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { AuthService } from '../services/auth.js'
import { User, Game, ControlPoint } from '../types/index.js'
import { useToast } from './useToast.js'

// Singleton pattern for WebSocket connection
let globalSocketRef: Socket | null = null
let globalIsConnecting = false
let connectionCount = 0
let globalReconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 2000 // 2 seconds

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
    onPlayerPosition?: (data: any) => void
    onBombTimeUpdate?: (data: any) => void
    onActiveBombTimers?: (data: any) => void
    onPositionChallengeUpdate?: (data: any) => void
    onControlPointTeamAssigned?: (data: any) => void
    onPlayerTeamUpdated?: (data: any) => void
    onGameAction?: (data: any) => void
    onControlPointTaken?: (data: any) => void
    onBombActivated?: (data: any) => void
    onBombDeactivated?: (data: any) => void
  },
  addToast: any
) => {
  socket.on('connect', () => {
    globalIsConnecting = false
    globalReconnectAttempts = 0 // Reset reconnection attempts on successful connection
    
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
  socket.on('gameStateChanged', (data: any) => {
    if (data.game) {
      console.log('[WEBSOCKET] Received gameStateChanged event:', {
        gameId: data.game.id,
        status: data.game.status,
        from: data.from
      })
      callbacks.onGameUpdate(data.game)
    }
  })

  // Listen for team count updated events
  socket.on('teamCountUpdated', (data: any) => {
    if (data.game) {
      console.log('[WEBSOCKET] Received teamCountUpdated event:', {
        gameId: data.game.id,
        teamCount: data.game.teamCount
      })
      callbacks.onGameUpdate(data.game)
    }
  })

  // Listen for time added events
  socket.on('timeAdded', (data: any) => {
    if (data.game) {
      console.log('[WEBSOCKET] Received timeAdded event:', {
        gameId: data.game.id
      })
      callbacks.onGameUpdate(data.game)
    }
  })

  // Listen for game time updated events
  socket.on('gameTimeUpdated', (data: any) => {
    if (data.game) {
      console.log('[WEBSOCKET] Received gameTimeUpdated event:', {
        gameId: data.game.id
      })
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
      console.log('[WEBSOCKET] Received gameStateChanged event via gameAction:', {
        gameId: data.data.game.id,
        status: data.data.game.status,
        action: data.action
      })
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
    if (globalReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      globalReconnectAttempts++
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

  socket.on('disconnect', (reason) => {
    
    if (reason === 'io server disconnect' || reason === 'transport close') {
      addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
      callbacks.onError('Conexión perdida con el servidor')
      
      // Attempt reconnection for unexpected disconnections
      if (reason === 'transport close' && globalReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        globalReconnectAttempts++
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
  socket.on('controlPointCreated', (data: { controlPoint: any }) => {
    console.log('useWebSocket - controlPointCreated event received - RAW DATA:', data)
    console.log('useWebSocket - controlPointCreated event structure:', {
      hasControlPoint: 'controlPoint' in data,
      controlPointKeys: data.controlPoint ? Object.keys(data.controlPoint) : 'no controlPoint',
      controlPointValues: data.controlPoint ? data.controlPoint : 'no controlPoint',
      dataKeys: Object.keys(data)
    })
    
    // Extract control point data from the correct structure - data is {controlPoint: {...}}
    const controlPointData = data.controlPoint?.controlPoint || data.controlPoint
    
    console.log('useWebSocket - controlPointData to process:', controlPointData)
    
    // Debug the actual control point data structure
    if (controlPointData) {
      console.log('useWebSocket - controlPointData detailed structure:', {
        id: controlPointData.id,
        name: controlPointData.name,
        latitude: controlPointData.latitude,
        longitude: controlPointData.longitude,
        latitudeType: typeof controlPointData.latitude,
        longitudeType: typeof controlPointData.longitude,
        hasLatitude: 'latitude' in controlPointData,
        hasLongitude: 'longitude' in controlPointData
      })
    }
    
    // Validate that we have required coordinates
    const latitude = controlPointData?.latitude ? parseFloat(controlPointData.latitude) : 0
    const longitude = controlPointData?.longitude ? parseFloat(controlPointData.longitude) : 0
    
    if (!controlPointData || !controlPointData.id || !controlPointData.name || latitude === 0 || longitude === 0) {
      console.error('useWebSocket - Invalid control point data received:', controlPointData)
      console.error('useWebSocket - Original data structure:', data)
      return
    }
    
    // Map backend ControlPoint entity to frontend ControlPoint interface
    const controlPoint: ControlPoint = {
      id: controlPointData.id,
      name: controlPointData.name,
      description: controlPointData.description || undefined,
      latitude: latitude,
      longitude: longitude,
      type: controlPointData.type as 'site' | 'control_point',
      ownedByTeam: controlPointData.ownedByTeam,
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
    console.log('useWebSocket - Processed control point:', controlPoint)
    console.log('useWebSocket - Processed coordinates:', {
      latitude: controlPoint.latitude,
      longitude: controlPoint.longitude,
      hasValidCoordinates: controlPoint.latitude !== 0 && controlPoint.longitude !== 0
    })
    callbacks.onControlPointCreated(controlPoint)
  })

  // Note: controlPointUpdated events now come through gameAction handler above
  // This direct listener is kept for backward compatibility
  socket.on('controlPointUpdated', (data: { controlPoint: any }) => {
    console.log('useWebSocket - controlPointUpdated event received:', data)
    // Ensure the control point has the expected structure
    const controlPoint: ControlPoint = {
      id: data.controlPoint.id,
      name: data.controlPoint.name,
      description: data.controlPoint.description,
      latitude: data.controlPoint.latitude,
      longitude: data.controlPoint.longitude,
      type: data.controlPoint.type,
      ownedByTeam: data.controlPoint.ownedByTeam,
      hasBombChallenge: data.controlPoint.hasBombChallenge || false,
      hasPositionChallenge: data.controlPoint.hasPositionChallenge || false,
      hasCodeChallenge: data.controlPoint.hasCodeChallenge || false,
      bombTimer: data.controlPoint.bombTimer,
      bombStatus: data.controlPoint.bombStatus,
      currentTeam: data.controlPoint.currentTeam,
      currentHoldTime: data.controlPoint.currentHoldTime,
      displayTime: data.controlPoint.displayTime,
      lastTimeUpdate: data.controlPoint.lastTimeUpdate,
      minDistance: data.controlPoint.minDistance,
      minAccuracy: data.controlPoint.minAccuracy,
      code: data.controlPoint.code,
      bombTime: data.controlPoint.bombTime,
      armedCode: data.controlPoint.armedCode,
      disarmedCode: data.controlPoint.disarmedCode
    }
    callbacks.onControlPointUpdated(controlPoint)
  })

  socket.on('controlPointDeleted', (data: { controlPointId: number }) => {
    callbacks.onControlPointDeleted(data.controlPointId)
  })

  // Handle game time updates for control point timers
  socket.on('gameTime', (data: any) => {
    callbacks.onGameTime(data)
  })

  // Handle time updates (broadcast every 20 seconds)
  socket.on('timeUpdate', (data: any) => {
    if (callbacks.onTimeUpdate) {
      callbacks.onTimeUpdate(data)
    }
  })

  // Handle individual control point time updates
  socket.on('controlPointTimeUpdate', (data: any) => {
    // Forward to gameTime handler for processing
    if (data && data.controlPointTimes) {
      callbacks.onGameTime(data)
    }
  })

  // Handle bomb timer updates
  socket.on('bombTimeUpdate', (data: any) => {
    if (callbacks.onBombTimeUpdate) {
      callbacks.onBombTimeUpdate(data)
    }
  })

  // Handle active bomb timers response
  socket.on('activeBombTimers', (data: any) => {
    if (callbacks.onActiveBombTimers) {
      callbacks.onActiveBombTimers(data)
    }
  })

  // Handle position challenge updates
  socket.on('positionChallengeUpdate', (data: any) => {
    if (callbacks.onPositionChallengeUpdate) {
      callbacks.onPositionChallengeUpdate(data)
    }
  })

  // Note: controlPointTeamAssigned events now come through gameAction handler above
  // This direct listener is kept for backward compatibility
  socket.on('controlPointTeamAssigned', (data: any) => {
    if (callbacks.onControlPointTeamAssigned) {
      callbacks.onControlPointTeamAssigned(data)
    } else {
      console.log('No onControlPointTeamAssigned callback registered')
    }
  })

  // Handle player team updates
  socket.on('playerTeamUpdated', (data: any) => {
    if (callbacks.onPlayerTeamUpdated) {
      callbacks.onPlayerTeamUpdated(data)
    } else {
      console.log('useWebSocket - No onPlayerTeamUpdated callback registered')
    }
  })

  // Handle control point taken events
  socket.on('controlPointTaken', (data: any) => {
    if (callbacks.onControlPointTaken) {
      callbacks.onControlPointTaken(data)
    } else {
      console.log('useWebSocket - No onControlPointTaken callback registered')
    }
  })

  // Handle bomb activated events
  socket.on('bombActivated', (data: any) => {
    if (callbacks.onBombActivated) {
      callbacks.onBombActivated(data)
    } else {
      console.log('useWebSocket - No onBombActivated callback registered')
    }
  })

  // Handle bomb deactivated events
  socket.on('bombDeactivated', (data: any) => {
    if (callbacks.onBombDeactivated) {
      callbacks.onBombDeactivated(data)
    } else {
      console.log('useWebSocket - No onBombDeactivated callback registered')
    }
  })

  // Handle position update events (direct position updates from players)
  socket.on('positionUpdate', (data: any) => {
    if (callbacks.onPlayerPosition) {
      callbacks.onPlayerPosition(data)
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
      onPlayerPosition?: (data: any) => void
      onBombTimeUpdate?: (data: any) => void
      onActiveBombTimers?: (data: any) => void
      onPositionChallengeUpdate?: (data: any) => void
      onControlPointTeamAssigned?: (data: any) => void
      onPlayerTeamUpdated?: (data: any) => void
      onGameAction?: (data: any) => void
      onControlPointTaken?: (data: any) => void
      onBombActivated?: (data: any) => void
      onBombDeactivated?: (data: any) => void
    }
  ) => {
    // Clean up any existing connection that might be in a bad state
    if (globalSocketRef && (!globalSocketRef.connected || globalSocketRef.disconnected)) {
      try {
        globalSocketRef.disconnect()
      } catch (error) {
        console.error('Error cleaning up old socket:', error)
      }
      globalSocketRef = null
      connectionCount = 0
    }

    // Usar la conexión global si ya existe y está realmente connected
    if (globalSocketRef && globalSocketRef.connected) {
      socketRef.value = globalSocketRef
      connectionCount++
      
      // Configurar los callbacks en la conexión existente
      setupSocketListeners(globalSocketRef, gameId, callbacks, addToast)
      return globalSocketRef
    }

    // Si ya estamos conectando globalmente, no iniciar otra conexión
    if (globalIsConnecting) {
      return null
    }

    globalIsConnecting = true
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
      globalSocketRef = socket
      socketRef.value = socket
      connectionCount++

      // Configurar todos los listeners del socket
      setupSocketListeners(socket, gameId, callbacks, addToast)

      return socket
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
      globalIsConnecting = false
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
      connectionCount--
      
      // Solo desconectar completamente si no hay más referencias
      if (connectionCount <= 0) {
        socketRef.value.disconnect()
        globalSocketRef = null
        globalIsConnecting = false
        globalReconnectAttempts = 0
        connectionCount = 0
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