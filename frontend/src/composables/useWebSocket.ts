import { ref, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'
import { AuthService } from '../services/auth.js'
import { User, Game, ControlPoint } from '../types/index.js'
import { useToast } from './useToast.js'

// Singleton pattern for WebSocket connection
let globalSocketRef: Socket | null = null
let globalIsConnecting = false
let connectionCount = 0

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
    onPlayerPosition?: (data: any) => void
    onBombTimeUpdate?: (data: any) => void
    onActiveBombTimers?: (data: any) => void
    onPositionChallengeUpdate?: (data: any) => void
    onControlPointTeamAssigned?: (data: any) => void
    onPlayerTeamUpdated?: (data: any) => void
  },
  addToast: any
) => {
  socket.on('connect', () => {
    globalIsConnecting = false
    socket.emit('joinGame', { gameId })
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

  socket.on('gameAction', (data: { action: string; data: any }) => {
    if (data.action === 'gameStateChanged' && data.data.game) {
      callbacks.onGameUpdate(data.data.game)
    } else if (data.action === 'positionUpdate' && callbacks.onPlayerPosition) {
      callbacks.onPlayerPosition(data)
    } else if (data.action === 'controlPointTeamAssigned' && callbacks.onControlPointTeamAssigned) {
      callbacks.onControlPointTeamAssigned(data.data)
    } else if (data.action === 'controlPointUpdated' && callbacks.onControlPointUpdated) {
      callbacks.onControlPointUpdated(data.data.controlPoint)
    } else if (data.action === 'playerTeamUpdated' && callbacks.onPlayerTeamUpdated) {
      callbacks.onPlayerTeamUpdated(data.data)
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
  })

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' || reason === 'transport close') {
      addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
      callbacks.onError('Conexión perdida con el servidor')
    }
  })

  // Debug: listen to all events
  socket.onAny((eventName, ...args) => {
  })

  // Handle control point specific events
  socket.on('controlPointCreated', (data: { controlPoint: ControlPoint }) => {
    callbacks.onControlPointCreated(data.controlPoint)
  })

  // Note: controlPointUpdated events now come through gameAction handler above
  // This direct listener is kept for backward compatibility
  socket.on('controlPointUpdated', (data: { controlPoint: ControlPoint }) => {
    callbacks.onControlPointUpdated(data.controlPoint)
  })

  socket.on('controlPointDeleted', (data: { controlPointId: number }) => {
    callbacks.onControlPointDeleted(data.controlPointId)
  })

  // Handle game time updates for control point timers
  socket.on('gameTime', (data: any) => {
    callbacks.onGameTime(data)
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
      onPlayerPosition?: (data: any) => void
      onBombTimeUpdate?: (data: any) => void
      onActiveBombTimers?: (data: any) => void
      onPositionChallengeUpdate?: (data: any) => void
      onControlPointTeamAssigned?: (data: any) => void
      onPlayerTeamUpdated?: (data: any) => void
    }
  ) => {
    // Usar la conexión global si ya existe
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
      
      
      // Use exact same configuration as React
      const socket = io(wsUrl, {
        auth: {
          token: token  // No Bearer prefix, just the raw token
        }
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
        connectionCount = 0
      }
      
      socketRef.value = null
      isConnecting.value = false
    }
  }

  onUnmounted(() => {
    disconnectWebSocket()
  })

  return {
    socketRef,
    connectWebSocket,
    emitGameAction,
    disconnectWebSocket
  }
}