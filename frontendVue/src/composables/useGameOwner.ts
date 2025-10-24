import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AuthService } from '../services/auth.js'
import { GameService } from '../services/game.js'
import { User, Game, Toast } from '../types/index.js'
import { io, Socket } from 'socket.io-client'
import { useToast } from './useToast.js'

interface UseGameOwnerReturn {
  currentUser: User | null
  currentGame: Game | null
  isLoading: boolean
  gpsStatus: string
  currentPosition: { lat: number; lng: number; accuracy: number } | null
  mapRef: any
  mapInstanceRef: any
  userMarkerRef: any
  playerMarkersRef: any
  controlPointMarkersRef: any
  socket: Socket | null
  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  endGame: () => void
  restartGame: () => void
  addTime: (seconds: number) => void
  updateGameTime: (timeInSeconds: number) => void
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  openTeamsDialog: () => void
  enableGameNameEdit: () => void
  createControlPoint: (lat: number, lng: number) => void
  handleMapClick: (latlng: { lat: number; lng: number }) => void
  controlPointMarkers: Map<number, any>
  positionCircles: Map<number, any>
  pieCharts: Map<number, any>
  enableDragMode: (controlPointId: number, markerId: number) => void
  controlPointTimes: any[]
  updateTeamCount: (count: number) => void
  playerMarkers: Map<number, any>
  isGameResultsDialogOpen: boolean
  openGameResultsDialog: () => void
  closeGameResultsDialog: () => void
}

export const useGameOwner = (): UseGameOwnerReturn => {
  const route = useRoute()
  const router = useRouter()
  const { addToast } = useToast()

  const currentUser = ref<User | null>(null)
  const currentGame = ref<Game | null>(null)
  const isLoading = ref(true)
  const isGameResultsDialogOpen = ref(false)

  const mapRef = ref(null)
  const mapInstanceRef = ref(null)
  const userMarkerRef = ref(null)
  const playerMarkersRef = ref(null)
  const controlPointMarkersRef = ref(null)
  const socketRef = ref<Socket | null>(null)
  const currentUserRef = ref<User | null>(null)

  const gameId = computed(() => route.params.gameId as string)

  // Simplified implementation - in a real migration, we would need to convert all the React hooks
  // For now, I'll provide the basic structure and return values

  onMounted(async () => {
    try {
      const user = await AuthService.getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      if (!gameId.value) {
        addToast({ message: 'ID de juego no válido', type: 'error' })
        router.push('/dashboard')
        return
      }

      const game = await GameService.getGame(parseInt(gameId.value))
      if (!game) {
        addToast({ message: 'Juego no encontrado', type: 'error' })
        router.push('/dashboard')
        return
      }

      if (game.owner.id !== user.id) {
        addToast({ message: 'No tienes permisos para ver este juego', type: 'error' })
        router.push('/dashboard')
        return
      }

      currentUser.value = user
      currentUserRef.value = user
      currentGame.value = game

      // Initialize WebSocket connection
      const token = AuthService.getToken()
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}`
      
      const socket = io(wsUrl, {
        auth: {
          token: token
        }
      })
      socketRef.value = socket

      socket.on('connect', () => {
        socket.emit('joinGame', { gameId: parseInt(gameId.value) })
      })

      socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
        if (data.game) {
          currentGame.value = data.game
        }
      })

      socket.on('joinSuccess', (data: { user: User }) => {
        if (data.user) {
          currentUser.value = data.user
          currentUserRef.value = data.user
        }
      })

      socket.on('gameActionError', (data: { action: string; error: string }) => {
        console.error(`Game action error (${data.action}):`, data.error)
        addToast({ message: `Error: ${data.error}`, type: 'error' })
      })

      socket.on('connect_error', (error: Error) => {
        console.error('WebSocket connection error:', error)
      })

      socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect' || reason === 'transport close') {
          addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
        }
      })

    } catch (error) {
      console.error('Error initializing game:', error)
      addToast({ message: 'Error al cargar el juego', type: 'error' })
      router.push('/dashboard')
    } finally {
      isLoading.value = false
    }
  })

  onUnmounted(() => {
    if (socketRef.value) {
      socketRef.value.disconnect()
    }
  })

  const startGame = () => {
    if (!currentGame.value || !socketRef.value) return
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'startGame'
      })
      addToast({ message: 'Juego iniciado', type: 'success' })
    } catch (error) {
      console.error('Error starting game:', error)
      addToast({ message: 'Error al iniciar el juego', type: 'error' })
    }
  }

  const pauseGame = () => {
    if (!currentGame.value || !socketRef.value) return
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'pauseGame'
      })
      addToast({ message: 'Juego pausado', type: 'success' })
    } catch (error) {
      console.error('Error pausing game:', error)
      addToast({ message: 'Error al pausar el juego', type: 'error' })
    }
  }

  const resumeGame = () => {
    if (!currentGame.value || !socketRef.value) return
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'resumeGame'
      })
      addToast({ message: 'Juego reanudado', type: 'success' })
    } catch (error) {
      console.error('Error resuming game:', error)
      addToast({ message: 'Error al reanudar el juego', type: 'error' })
    }
  }

  const endGame = () => {
    if (!currentGame.value || !socketRef.value) return
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'endGame'
      })
      addToast({ message: 'Juego finalizado', type: 'success' })
    } catch (error) {
      console.error('Error ending game:', error)
      addToast({ message: 'Error al finalizar el juego', type: 'error' })
    }
  }

  const restartGame = () => {
    if (!currentGame.value || !socketRef.value) return
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'restartGame'
      })
      addToast({ message: 'Juego reiniciado', type: 'success' })
    } catch (error) {
      console.error('Error restarting game:', error)
      addToast({ message: 'Error al reiniciar el juego', type: 'error' })
    }
  }

  const addTime = (seconds: number) => {
    if (!currentGame.value || !socketRef.value) return
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'addTime',
        data: {
          seconds: seconds
        }
      })
      const minutes = seconds / 60
      addToast({ message: `Se agregaron ${minutes} minutos al juego`, type: 'success' })
    } catch (error) {
      console.error('Error adding time:', error)
      addToast({ message: 'Error al añadir tiempo', type: 'error' })
    }
  }

  const updateGameTime = (timeInSeconds: number) => {
    if (!currentGame.value || !socketRef.value) return
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'updateGameTime',
        data: {
          timeInSeconds: timeInSeconds
        }
      })
      let timeText = 'indefinido'
      if (timeInSeconds > 0) {
        const minutes = timeInSeconds / 60
        timeText = `${minutes} min`
      }
      addToast({ message: `Tiempo del juego actualizado: ${timeText}`, type: 'success' })
    } catch (error) {
      console.error('Error updating game time:', error)
      addToast({ message: 'Error al actualizar el tiempo', type: 'error' })
    }
  }

  const goBack = () => {
    router.push('/dashboard')
  }

  const reloadPage = () => {
    window.location.reload()
  }

  const centerOnUser = () => {
    // Implementation would depend on GPS functionality
  }

  const centerOnSite = () => {
    // Implementation would depend on map functionality
  }

  const openTeamsDialog = () => {
    // This function is now handled by the GameOwner component state
  }

  const updateTeamCount = (count: number) => {
    if (!currentGame.value || !socketRef.value) return
    
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'updateTeamCount',
      data: {
        teamCount: count
      }
    })
  }

  const enableGameNameEdit = () => {
    addToast({ message: 'Funcionalidad de edición de nombre no implementada aún', type: 'info' })
  }

  const createControlPoint = (lat: number, lng: number) => {
    if (!socketRef.value || !currentGame.value) return

    const name = `Punto ${Math.round(lat * 10000)}-${Math.round(lng * 10000)}`
    
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'createControlPoint',
      data: {
        name,
        description: '',
        latitude: lat,
        longitude: lng,
        gameId: currentGame.value.id
      }
    })

    addToast({ message: 'Punto de control creado', type: 'success' })
  }

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    // Implementation would depend on map functionality
  }

  const openGameResultsDialog = () => {
    isGameResultsDialogOpen.value = true
  }

  const closeGameResultsDialog = () => {
    isGameResultsDialogOpen.value = false
  }

  return {
    currentUser: currentUser.value,
    currentGame: currentGame.value,
    isLoading: isLoading.value,
    gpsStatus: '',
    currentPosition: null,
    mapRef,
    mapInstanceRef,
    userMarkerRef,
    playerMarkersRef,
    controlPointMarkersRef,
    socket: socketRef.value,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    restartGame,
    addTime,
    updateGameTime,
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite,
    openTeamsDialog,
    enableGameNameEdit,
    createControlPoint,
    handleMapClick,
    controlPointMarkers: new Map(),
    positionCircles: new Map(),
    pieCharts: new Map(),
    enableDragMode: () => {},
    controlPointTimes: [],
    updateTeamCount,
    playerMarkers: new Map(),
    isGameResultsDialogOpen: isGameResultsDialogOpen.value,
    openGameResultsDialog,
    closeGameResultsDialog
  }
}