import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import type { Game, User, ControlPoint } from '../types'
import type { Router } from 'vue-router'
import { useWebSocket } from './useWebSocket'
import { useMap } from './useMap'

interface UseGamePlayerReturn {
  currentUser: Ref<User | null>
  currentGame: Ref<Game | null>
  isLoading: Ref<boolean>
  mapRef: Ref<HTMLElement | null>
  mapInstanceRef: Ref<any | null>
  userMarkerRef: Ref<any | null>
  playerMarkersRef: Ref<Map<number, any>>
  controlPointMarkersRef: Ref<Map<number, any>>
  socket: Ref<any>
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  controlPointMarkers: Ref<Map<number, any>>
  positionCircles: Ref<Map<number, any>>
  pieCharts: Ref<Map<number, any>>
  isGameResultsDialogOpen: Ref<boolean>
  openGameResultsDialog: () => void
  closeGameResultsDialog: () => void
  showTeamSelection: Ref<boolean>
  hideTeamSelection: () => void
  showTeamSelectionManual: () => void
}

export const useGamePlayer = (
  gameId: Ref<string>,
  router: Router
): UseGamePlayerReturn => {
  const currentUser = ref<User | null>(null)
  const currentGame = ref<Game | null>(null)
  const isLoading = ref(true)
  const mapRef = ref<HTMLElement | null>(null)
  const mapInstanceRef = ref<any | null>(null)
  const userMarkerRef = ref<any | null>(null)
  const playerMarkersRef = ref<Map<number, any>>(new Map())
  const controlPointMarkersRef = ref<Map<number, any>>(new Map())
  const controlPointMarkers = ref<Map<number, any>>(new Map())
  const positionCircles = ref<Map<number, any>>(new Map())
  const pieCharts = ref<Map<number, any>>(new Map())
  const isGameResultsDialogOpen = ref(false)
  const showTeamSelection = ref(false)

  // WebSocket connection
  const { socketRef, connectWebSocket, disconnectWebSocket } = useWebSocket()

  // Map functionality
  const { initializeMap } = useMap()

  // Navigation functions
  const goBack = () => {
    router.back()
  }

  const reloadPage = () => {
    window.location.reload()
  }

  const centerOnUser = () => {
    // TODO: Implement center on user functionality
  }

  const centerOnSite = () => {
    // TODO: Implement center on site functionality
  }

  // Dialog functions
  const openGameResultsDialog = () => {
    isGameResultsDialogOpen.value = true
  }

  const closeGameResultsDialog = () => {
    isGameResultsDialogOpen.value = false
  }

  // Team selection functions
  const hideTeamSelection = () => {
    showTeamSelection.value = false
  }

  const showTeamSelectionManual = () => {
    showTeamSelection.value = true
  }

  // Initialize game data
  const initializeGameData = () => {
    try {
      isLoading.value = true
      
      // TODO: Fetch current user data
      // currentUser.value = await fetchCurrentUser()
      
      // TODO: Fetch game data
      // currentGame.value = await fetchGame(gameId.value)
      
      // Connect to WebSocket
      if (currentGame.value) {
        connectWebSocket(parseInt(gameId.value), {
          onGameUpdate: (game: Game) => {
            currentGame.value = game
          },
          onControlPointCreated: (controlPoint: ControlPoint) => {
            // Handle control point creation
          },
          onControlPointUpdated: (controlPoint: ControlPoint) => {
            // Handle control point update
          },
          onControlPointDeleted: (controlPointId: number) => {
            // Handle control point deletion
          },
          onJoinSuccess: (user: User) => {
            currentUser.value = user
          },
          onError: (error: string) => {
            console.error('WebSocket error:', error)
          },
          onGameTime: (data: any) => {
            // Handle game time updates
          }
        })
      }
      
    } catch (error) {
      console.error('Error initializing game data:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Listen for WebSocket events
  const setupWebSocketListeners = () => {
    if (!socketRef.value) return

    const handleGameUpdate = (data: any) => {
      if (data.game) {
        currentGame.value = data.game
      }
    }

    const handleGameEnded = (data: any) => {
      if (data.gameId === gameId.value) {
        openGameResultsDialog()
      }
    }

    socketRef.value.on('gameUpdate', handleGameUpdate)
    socketRef.value.on('gameAction', (data: any) => {
      if (data.action === 'gameEnded') {
        handleGameEnded(data)
      }
    })

    onUnmounted(() => {
      socketRef.value?.off('gameUpdate', handleGameUpdate)
    })
  }

  onMounted(() => {
    initializeGameData()
    setupWebSocketListeners()
  })

  onUnmounted(() => {
    disconnectWebSocket()
  })

  return {
    currentUser,
    currentGame,
    isLoading,
    mapRef,
    mapInstanceRef,
    userMarkerRef,
    playerMarkersRef,
    controlPointMarkersRef,
    socket: socketRef,
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite,
    controlPointMarkers,
    positionCircles,
    pieCharts,
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog,
    showTeamSelection,
    hideTeamSelection,
    showTeamSelectionManual
  }
}