import { createSignal, createEffect, onCleanup } from 'solid-js'
import { AuthService } from '../services/auth'
import { GameService } from '../services/game'
import { User, Game, Toast } from '../types/index'
import { io, Socket } from 'socket.io-client'

interface UseGameOwnerReturn {
  currentUser: () => User | null
  currentGame: () => Game | null
  isLoading: () => boolean
  mapRef: (el: HTMLDivElement) => void
  mapInstanceRef: { current: any }
  userMarkerRef: { current: any }
  playerMarkersRef: { current: any }
  controlPointMarkersRef: { current: any }
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
  updateTeamCount: (count: number) => void
  playerMarkers: Map<number, any>
  isGameResultsDialogOpen: () => boolean
  openGameResultsDialog: () => void
  closeGameResultsDialog: () => void
}

export const useGameOwner = (
  gameId: string | undefined,
  addToast: (toast: Omit<Toast, 'id'>) => void
): UseGameOwnerReturn => {
  const [currentUser, setCurrentUser] = createSignal<User | null>(null)
  const [currentGame, setCurrentGame] = createSignal<Game | null>(null)
  const [isLoading, setIsLoading] = createSignal(true)
  const [isGameResultsDialogOpen, setIsGameResultsDialogOpen] = createSignal(false)

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
  const [playerMarkers] = createSignal(new Map<number, any>())

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

        if (game.owner.id !== user.id) {
          addToast({ message: 'No tienes permisos para ver este juego', type: 'error' })
          window.location.href = '/dashboard'
          return
        }

        setCurrentUser(user)
        currentUserRef.current = user
        setCurrentGame(game)
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

      // Listen for successful connection
      socket.on('connect', () => {
        // Join game room
        socket.emit('joinGame', { gameId: parseInt(gameId) })
      })

      // Consolidated game state updates
      socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
        if (data.game) {
          setCurrentGame(data.game)
          // Handle specific status changes
          if (data.game.status === 'finished') {
            setTimeout(() => {
              setIsGameResultsDialogOpen(true)
            }, 1000)
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

  const startGame = () => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    try {
      socketRef.current.emit('gameAction', {
        gameId: game.id,
        action: 'startGame'
      })
      addToast({ message: 'Juego iniciado', type: 'success' })
    } catch (error) {
      console.error('Error starting game:', error)
      addToast({ message: 'Error al iniciar el juego', type: 'error' })
    }
  }

  const pauseGame = () => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    try {
      socketRef.current.emit('gameAction', {
        gameId: game.id,
        action: 'pauseGame'
      })
      addToast({ message: 'Juego pausado', type: 'success' })
    } catch (error) {
      console.error('Error pausing game:', error)
      addToast({ message: 'Error al pausar el juego', type: 'error' })
    }
  }

  const resumeGame = () => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    try {
      socketRef.current.emit('gameAction', {
        gameId: game.id,
        action: 'resumeGame'
      })
      addToast({ message: 'Juego reanudado', type: 'success' })
    } catch (error) {
      console.error('Error resuming game:', error)
      addToast({ message: 'Error al reanudar el juego', type: 'error' })
    }
  }

  const endGame = () => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    try {
      socketRef.current.emit('gameAction', {
        gameId: game.id,
        action: 'endGame'
      })
      addToast({ message: 'Juego finalizado', type: 'success' })
    } catch (error) {
      console.error('Error ending game:', error)
      addToast({ message: 'Error al finalizar el juego', type: 'error' })
    }
  }

  const restartGame = () => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    try {
      socketRef.current.emit('gameAction', {
        gameId: game.id,
        action: 'restartGame'
      })
      addToast({ message: 'Juego reiniciado', type: 'success' })
    } catch (error) {
      console.error('Error restarting game:', error)
      addToast({ message: 'Error al reiniciar el juego', type: 'error' })
    }
  }

  const addTime = (seconds: number) => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    try {
      socketRef.current.emit('gameAction', {
        gameId: game.id,
        action: 'addTime',
        data: { seconds }
      })
      const minutes = seconds / 60
      addToast({ message: `Se agregaron ${minutes} minutos al juego`, type: 'success' })
    } catch (error) {
      console.error('Error adding time:', error)
      addToast({ message: 'Error al añadir tiempo', type: 'error' })
    }
  }

  const updateGameTime = (timeInSeconds: number) => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    try {
      socketRef.current.emit('gameAction', {
        gameId: game.id,
        action: 'updateGameTime',
        data: { timeInSeconds }
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

  const openTeamsDialog = () => {
    // To be implemented
  }

  const enableGameNameEdit = () => {
    addToast({ message: 'Funcionalidad de edición de nombre no implementada aún', type: 'info' })
  }

  const createControlPoint = (lat: number, lng: number) => {
    const game = currentGame()
    if (!socketRef.current || !game) return

    const name = `Punto ${Math.round(lat * 10000)}-${Math.round(lng * 10000)}`
    
    socketRef.current.emit('gameAction', {
      gameId: game.id,
      action: 'createControlPoint',
      data: {
        name,
        description: '',
        latitude: lat,
        longitude: lng,
        gameId: game.id
      }
    })

    addToast({ message: 'Punto de control creado', type: 'success' })
  }

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    if (!mapInstanceRef.current) return
    
    // Remove any existing popup first
    mapInstanceRef.current.closePopup()

    // Create menu content
    const menuContent = `
      <div id="controlPointMenu">
        <div style="display: flex; justify-content: center;">
          <button onclick="window.createControlPoint(${latlng.lat}, ${latlng.lng})" style="padding: 8px 16px; margin: 0 10px 0 5px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Crear Punto de Control</button>
        </div>
      </div>
    `

    // Import Leaflet dynamically and create popup
    import('leaflet').then(L => {
      if (!mapInstanceRef.current) return

      // Create Leaflet popup that sticks to the map
      // const popup = L.popup({})
      //   .setLatLng([latlng.lat, latlng.lng])
      //   .setContent(menuContent)
      //   .openOn(mapInstanceRef.current)

      // Add global function for the button
      (window as any).createControlPoint = (lat: number, lng: number) => {
        createControlPoint(lat, lng)
        mapInstanceRef.current?.closePopup()
      }
    })
  }

  const enableDragMode = (controlPointId: number, markerId: number) => {
    // To be implemented
  }

  const updateTeamCount = (count: number) => {
    const game = currentGame()
    if (!game || !socketRef.current) return
    
    socketRef.current.emit('gameAction', {
      gameId: game.id,
      action: 'updateTeamCount',
      data: { teamCount: count }
    })
  }

  const openGameResultsDialog = () => {
    setIsGameResultsDialogOpen(true)
  }

  const closeGameResultsDialog = () => {
    setIsGameResultsDialogOpen(false)
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
    controlPointMarkers: controlPointMarkers(),
    positionCircles: positionCircles(),
    pieCharts: pieCharts(),
    enableDragMode,
    updateTeamCount,
    playerMarkers: playerMarkers(),
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog
  }
}