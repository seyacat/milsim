import { createSignal, createEffect, onCleanup } from 'solid-js'
import { AuthService } from '../services/auth'
import { GameService } from '../services/game'
import { User, Game, Toast } from '../types/index'
import { io, Socket } from 'socket.io-client'

interface UseGamePlayerReturn {
  currentUser: () => User | null
  currentGame: () => Game | null
  isLoading: () => boolean
  mapRef: (el: HTMLDivElement) => void
  mapInstanceRef: { current: any }
  userMarkerRef: { current: any }
  playerMarkersRef: { current: any }
  controlPointMarkersRef: { current: any }
  socket: Socket | null
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  controlPointMarkers: Map<number, any>
  positionCircles: Map<number, any>
  pieCharts: Map<number, any>
  isGameResultsDialogOpen: () => boolean
  openGameResultsDialog: () => void
  closeGameResultsDialog: () => void
  showTeamSelection: () => boolean
  hideTeamSelection: () => void
  showTeamSelectionManual: () => void
}

export const useGamePlayer = (
  gameId: string | undefined,
  addToast: (toast: Omit<Toast, 'id'>) => void
): UseGamePlayerReturn => {
  const [currentUser, setCurrentUser] = createSignal<User | null>(null)
  const [currentGame, setCurrentGame] = createSignal<Game | null>(null)
  const [isLoading, setIsLoading] = createSignal(true)
  const [isGameResultsDialogOpen, setIsGameResultsDialogOpen] = createSignal(false)
  const [showTeamSelection, setShowTeamSelection] = createSignal(false)
  const [shouldShowTeamSelection, setShouldShowTeamSelection] = createSignal(false)
  const [hasAutoShownTeamSelection, setHasAutoShownTeamSelection] = createSignal(false)

  let mapElement: HTMLDivElement | null = null
  const mapRef = (el: HTMLDivElement) => { mapElement = el }
  const mapInstanceRef = { current: null as any }
  const userMarkerRef = { current: null as any }
  const playerMarkersRef = { current: null as any }
  const controlPointMarkersRef = { current: null as any }
  const socketRef = { current: null as Socket | null }
  const currentUserRef = { current: null as User | null }

  // Control points state
  const [controlPointMarkers] = createSignal(new Map<number, any>())
  const [positionCircles] = createSignal(new Map<number, any>())
  const [pieCharts] = createSignal(new Map<number, any>())

  createEffect(() => {
    let isMounted = true

    const initializeGame = async () => {
      try {
        const user = await AuthService.getCurrentUser()
        if (!isMounted) return
        
        if (!user) {
          window.location.href = '/login'
          return
        }

        if (!gameId) {
          addToast({ message: 'ID de juego no válido', type: 'error' })
          window.location.href = '/dashboard'
          return
        }

        const game = await GameService.getGame(parseInt(gameId))
        if (!isMounted) return
        
        if (!game) {
          addToast({ message: 'Juego no encontrado', type: 'error' })
          window.location.href = '/dashboard'
          return
        }

        setCurrentUser(user)
        currentUserRef.current = user
        setCurrentGame(game)
        
        // Expose game globally for control point interactions
        ;(window as any).currentGame = game
      } catch (error) {
        if (!isMounted) return
        console.error('Error initializing game:', error)
        addToast({ message: 'Error al cargar el juego', type: 'error' })
        window.location.href = '/dashboard'
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeGame()

    // Initialize WebSocket connection
    if (gameId && !socketRef.current) {
      const token = AuthService.getToken()
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}`
      
      const socket = io(wsUrl, {
        auth: {
          token: token
        }
      })
      socketRef.current = socket
      
      // Expose socket and game globally for control point interactions
      ;(window as any).currentSocket = socket
      
      // Listen for successful connection
      socket.on('connect', () => {
        // Join game room
        socket.emit('joinGame', { gameId: parseInt(gameId) })
      })

      // Consolidated game state updates
      socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
        if (data.game) {
          // Skip game update for player team changes
          if (data.type === 'playerTeamChanged') {
            return
          }
          
          setCurrentGame(data.game)
          // Handle specific status changes
          if (data.game.status === 'finished') {
            setTimeout(() => {
              setIsGameResultsDialogOpen(true)
            }, 1000)
          } else if (data.game.status === 'stopped') {
            setIsGameResultsDialogOpen(false)
            addToast({ message: 'El juego ha sido detenido. Puedes seleccionar tu equipo.', type: 'info' })
          }
        }
      })

      // Listen for join success
      socket.on('joinSuccess', (data: { user: User }) => {
        if (data.user) {
          setCurrentUser(data.user)
          currentUserRef.current = data.user
        }
      })

      // Listen for challenge responses
      socket.on('codeChallengeResult', (data: { success: boolean; message: string }) => {
        if (data.success) {
          addToast({ message: data.message, type: 'success' })
        } else {
          addToast({ message: data.message, type: 'error' })
        }
      })

      socket.on('bombChallengeResult', (data: { success: boolean; message: string }) => {
        if (data.success) {
          addToast({ message: data.message, type: 'success' })
        } else {
          addToast({ message: data.message, type: 'error' })
        }
      })

      socket.on('bombDeactivationResult', (data: { success: boolean; message: string }) => {
        if (data.success) {
          addToast({ message: data.message, type: 'success' })
        } else {
          addToast({ message: data.message, type: 'error' })
        }
      })

      // Listen for game errors
      socket.on('gameActionError', (data: { action: string; error: string }) => {
        console.error(`Game action error (${data.action}):`, data.error)
        addToast({ message: `Error: ${data.error}`, type: 'error' })
      })

      // Listen for connection errors
      socket.on('connect_error', (error: Error) => {
        console.error('WebSocket connection error:', error)
      })

      // Listen for disconnection
      socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect' || reason === 'transport close') {
          addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
        }
      })
    }

    onCleanup(() => {
      isMounted = false
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    })
  })

  // Handle game status and team selection logic
  createEffect(() => {
    const game = currentGame()
    const user = currentUser()
    if (!game || !user || isLoading()) return

    const isOwner = game.owner && game.owner.id === user.id
    const isStopped = game.status === 'stopped'
    const isFinished = game.status === 'finished'
    
    // Find current player
    const currentPlayer = game.players?.find((p: any) => p?.user?.id === user.id)
    const hasTeam = currentPlayer?.team && currentPlayer.team !== 'none'

    // Handle game finished status
    if (isFinished) {
      setTimeout(() => {
        openGameResultsDialog()
      }, 1000)
    }

    // Handle team selection logic
    if (!isOwner && isStopped) {
      // Show team selection if shouldShowTeamSelection is true
      if (shouldShowTeamSelection()) {
        setShowTeamSelection(true)
      } else {
        setShowTeamSelection(false)
      }

      // Automatically show team selection in specific cases
      if (!hasAutoShownTeamSelection()) {
        // Case 1: Page load/refresh and player doesn't have a team
        if (!hasTeam) {
          setShouldShowTeamSelection(true)
          setHasAutoShownTeamSelection(true)
        }
      }
    } else {
      setShowTeamSelection(false)
    }

    // Reset auto-show flag when game status changes from stopped
    if (!isStopped) {
      setHasAutoShownTeamSelection(false)
    }
  })

  const goBack = () => {
    window.location.href = '/dashboard'
  }

  const reloadPage = () => {
    window.location.reload()
  }

  const centerOnUser = () => {
    // To be implemented with GPS
  }

  const centerOnSite = () => {
    const game = currentGame()
    if (mapInstanceRef.current && game) {
      const siteControlPoint = game.controlPoints.find(cp => cp.type === 'site')
      if (siteControlPoint) {
        mapInstanceRef.current.setView([siteControlPoint.latitude, siteControlPoint.longitude], 16)
      }
    }
  }

  const openGameResultsDialog = () => {
    setIsGameResultsDialogOpen(true)
  }

  const closeGameResultsDialog = () => {
    setIsGameResultsDialogOpen(false)
  }

  const hideTeamSelection = () => {
    setShouldShowTeamSelection(false)
    setShowTeamSelection(false)
  }

  const showTeamSelectionManual = () => {
    const game = currentGame()
    const user = currentUser()
    if (!game || !user) return
    
    const isOwner = game.owner && game.owner.id === user.id
    const isStopped = game.status === 'stopped'
    
    // Only allow manual team selection for non-owners when game is stopped
    if (!isOwner && isStopped) {
      setShouldShowTeamSelection(true)
    }
  }

  return {
    currentUser,
    currentGame,
    isLoading,
    mapRef,
    mapInstanceRef,
    userMarkerRef,
    playerMarkersRef,
    controlPointMarkersRef,
    socket: socketRef.current,
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite,
    controlPointMarkers: controlPointMarkers(),
    positionCircles: positionCircles(),
    pieCharts: pieCharts(),
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog,
    showTeamSelection,
    hideTeamSelection,
    showTeamSelectionManual
  }
}