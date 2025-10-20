import { useState, useEffect, useRef, useCallback } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { AuthService } from '../services/auth'
import { GameService } from '../services/game'
import { User, Game, ControlPoint, Toast } from '../types'
import { io, Socket } from 'socket.io-client'
import { useControlPoints } from './useControlPoints'
import { useGameTime, ControlPointTimeData } from './useGameTime'
import { useControlPointTimers } from './useControlPointTimers'
import { useBombTimers } from './useBombTimers'
import { useGPSTracking } from './useGPSTracking'
import { usePlayerMarkers } from './usePlayerMarkers'

interface UseGameOwnerReturn {
  currentUser: User | null
  currentGame: Game | null
  isLoading: boolean
  gpsStatus: string
  currentPosition: { lat: number; lng: number; accuracy: number } | null
  mapRef: React.RefObject<HTMLDivElement>
  mapInstanceRef: React.MutableRefObject<any>
  userMarkerRef: React.MutableRefObject<any>
  playerMarkersRef: React.MutableRefObject<any>
  controlPointMarkersRef: React.MutableRefObject<any>
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
  controlPointMarkers: Map<number, L.Marker>
  positionCircles: Map<number, L.Circle>
  pieCharts: Map<number, L.SVGOverlay>
  enableDragMode: (controlPointId: number, markerId: number) => void;
  controlPointTimes: ControlPointTimeData[];
  updateTeamCount: (count: number) => void;
  playerMarkers: Map<number, L.Marker>;
  isGameResultsDialogOpen: boolean
  openGameResultsDialog: () => void
  closeGameResultsDialog: () => void
}

export const useGameOwner = (
  gameId: string | undefined,
  navigate: NavigateFunction,
  addToast: (toast: Omit<Toast, 'id'>) => void
): UseGameOwnerReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGameResultsDialogOpen, setIsGameResultsDialogOpen] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const playerMarkersRef = useRef<any>(null)
  const controlPointMarkersRef = useRef<any>(null)
  const socketRef = useRef<Socket | null>(null)
  const currentUserRef = useRef<User | null>(null)

  // Memoize functions to prevent re-renders
  const memoizedAddToast = useCallback(addToast, [addToast])
  const memoizedNavigate = useCallback(navigate, [navigate])

  // Create a wrapper for showToast that matches the expected signature
  const showToastWrapper = useCallback((message: string, type: string) => {
    memoizedAddToast({ message, type: type as any });
  }, [memoizedAddToast]);

  // Use game time hook to get control point times
  const { controlPointTimes } = useGameTime(currentGame, socketRef.current)

  // Use control point timers hook
  const { controlPointTimes: controlPointTimers } = useControlPointTimers(currentGame, socketRef.current, controlPointTimes)

  // Use bomb timers hook
  const { updateAllBombTimerDisplays } = useBombTimers(currentGame, socketRef.current)

  // Use control points hook
  const controlPointsResult = useControlPoints({
    game: currentGame,
    map: mapInstanceRef.current,
    isOwner: true,
    socket: socketRef.current,
    showToast: showToastWrapper
  })
  
  const controlPointMarkers = controlPointsResult?.controlPointMarkers || new Map();
  const positionCircles = controlPointsResult?.positionCircles || new Map();
  const pieCharts = controlPointsResult?.pieCharts || new Map();
  const enableDragMode = controlPointsResult?.enableDragMode || (() => {});

  // Use player markers hook
  const playerMarkersResult = usePlayerMarkers({
    game: currentGame,
    map: mapInstanceRef.current,
    currentUser: currentUser,
    socket: socketRef.current,
    isOwner: true
  })

  // Listen for player positions when joining as owner
  useEffect(() => {
    if (!socketRef.current || !currentUser || !currentGame) return;

    const handlePlayerPositionsResponse = (data: any) => {
      if (data.action === 'playerPositionsResponse' && data.data.positions) {
        data.data.positions.forEach((position: any) => {
          playerMarkersResult.updatePlayerMarker(position);
        });
      }
    };

    // Request current player positions when joining as owner
    if (currentGame.owner && currentGame.owner.id === currentUser.id) {
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
        action: 'requestPlayerPositions'
      });
    }

    socketRef.current.on('gameAction', handlePlayerPositionsResponse);

    return () => {
      socketRef.current?.off('gameAction', handlePlayerPositionsResponse);
    };
  }, [socketRef.current, currentUser, currentGame, playerMarkersResult.updatePlayerMarker]);

  // Update control point timers when control point times change
  // This effect is removed to prevent flicker when individual CPs are taken
  // Individual CP timer updates are handled by the useControlPointTimers hook

  useEffect(() => {
    let isMounted = true

    const initializeGame = async () => {
      try {
        const user = await AuthService.getCurrentUser()
        if (!isMounted) return
        
        if (!user) {
          memoizedNavigate('/login')
          return
        }

        if (!gameId) {
          memoizedAddToast({ message: 'ID de juego no válido', type: 'error' })
          memoizedNavigate('/dashboard')
          return
        }

        const game = await GameService.getGame(parseInt(gameId))
        if (!isMounted) return
        
        if (!game) {
          memoizedAddToast({ message: 'Juego no encontrado', type: 'error' })
          memoizedNavigate('/dashboard')
          return
        }

        if (game.owner.id !== user.id) {
          memoizedAddToast({ message: 'No tienes permisos para ver este juego', type: 'error' })
          memoizedNavigate('/dashboard')
          return
        }

        setCurrentUser(user)
        currentUserRef.current = user
        setCurrentGame(game)
      } catch (error) {
        if (!isMounted) return
        console.error('Error initializing game:', error)
        memoizedAddToast({ message: 'Error al cargar el juego', type: 'error' })
        memoizedNavigate('/dashboard')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeGame()

    // Initialize WebSocket connection only once
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

      // Listen for game state changes
      socket.on('gameAction', (data: { action: string; data: any }) => {
        if (data.action === 'gameStateChanged' && data.data.game) {
          setCurrentGame(data.data.game)
        }
      })

      // Listen for game updates (including restart)
      socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
        if (data.game) {
          setCurrentGame(data.game)
        }
      })

      // Listen for game state events
      socket.on('gameState', (game: Game) => {
        setCurrentGame(game)
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
        memoizedAddToast({ message: `Error: ${data.error}`, type: 'error' })
      })

  
      // Listen for player position updates
      socket.on('gameAction', (data: { action: string; data: any }) => {
        if (data.action === 'positionUpdate') {
          // Update player markers with position data
          playerMarkersResult.updatePlayerMarker(data.data);
        }
      })

      // Listen for player inactive notifications
      socket.on('gameAction', (data: { action: string; data: any }) => {
        if (data.action === 'playerInactive') {
          // Remove player marker from map
          playerMarkersResult.removePlayerMarker(data.data.userId);
        }
      })

      // Listen for player team updates
      socket.on('gameAction', (data: { action: string; data: any }) => {
        if (data.action === 'playerTeamUpdated') {
          
          handlePlayerTeamUpdate(data.data);
          
          // Also update the game state to reflect the team change
          setCurrentGame(prevGame => {
            if (!prevGame) return prevGame;
            
            // Update the player's team in the game state
            const updatedPlayers = prevGame.players?.map(player => {
              if (player.user?.id === data.data.userId) {
                return { ...player, team: data.data.team };
              }
              return player;
            }) || [];
            
            return { ...prevGame, players: updatedPlayers };
          });

          // Update user's own marker if they changed their own team
          if (data.data.userId === currentUserRef.current?.id && currentPosition) {
            createUserMarker(currentPosition.lat, currentPosition.lng);
          }
        }
      })
  
      // Listen for team count updates
      socket.on('gameAction', (data: { action: string; data: any }) => {
        if (data.action === 'teamCountUpdated') {
          handleTeamCountUpdate(data.data)
        }
      })
  
      // Listen for connection errors
      socket.on('connect_error', (error: Error) => {
        console.error('WebSocket connection error:', error)
        // Don't show toast on every connection error - only show once
      })
  
      // Listen for disconnection
      socket.on('disconnect', (reason) => {
        // Don't show toast on every disconnect - only show for unexpected disconnections
        if (reason === 'io server disconnect' || reason === 'transport close') {
          memoizedAddToast({ message: 'Conexión perdida con el servidor', type: 'error' })
        }
      })

    }

    return () => {
      isMounted = false
      // Don't disconnect WebSocket - let it be persistent
      // The WebSocket will be cleaned up when the component unmounts naturally
    }
  }, [gameId, memoizedNavigate, memoizedAddToast])

  // Use GPS tracking hook
  const {
    gpsStatus,
    currentPosition
  } = useGPSTracking(currentGame, socketRef.current)

  // Update user marker when position changes
  useEffect(() => {
    if (currentPosition && mapInstanceRef.current) {
      // Update user marker on map
      if (!userMarkerRef.current) {
        createUserMarker(currentPosition.lat, currentPosition.lng)
        
        // Set view to user's location when GPS is first available (like in original code)
        mapInstanceRef.current.setView([currentPosition.lat, currentPosition.lng], 16)
      } else if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([currentPosition.lat, currentPosition.lng])
      }
    }
  }, [currentPosition])

  // Update user marker when game state changes (including team changes)
  useEffect(() => {
    if (currentPosition && mapInstanceRef.current && userMarkerRef.current) {
      // Recreate user marker with updated team
      createUserMarker(currentPosition.lat, currentPosition.lng);
    }
  }, [currentGame])

  const createUserMarker = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return

    // Use the player markers hook to create user marker
    const marker = playerMarkersResult.createUserMarker(lat, lng);
    if (marker) {
      userMarkerRef.current = marker;
    }
  }, [playerMarkersResult])

  const startGame = useCallback(() => {
    if (!currentGame || !socketRef.current) return
    try {
      // Send start action via WebSocket (like in original code)
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
        action: 'startGame'
      })
      memoizedAddToast({ message: 'Juego iniciado', type: 'success' })
    } catch (error) {
      console.error('Error starting game:', error)
      memoizedAddToast({ message: 'Error al iniciar el juego', type: 'error' })
    }
  }, [currentGame, memoizedAddToast])

  const pauseGame = useCallback(() => {
    if (!currentGame || !socketRef.current) return
    try {
      // Send pause action via WebSocket (like in original code)
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
        action: 'pauseGame'
      })
      memoizedAddToast({ message: 'Juego pausado', type: 'success' })
    } catch (error) {
      console.error('Error pausing game:', error)
      memoizedAddToast({ message: 'Error al pausar el juego', type: 'error' })
    }
  }, [currentGame, memoizedAddToast])

  const resumeGame = useCallback(() => {
    if (!currentGame || !socketRef.current) return
    try {
      // Send resume action via WebSocket (like in original code)
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
        action: 'resumeGame'
      })
      memoizedAddToast({ message: 'Juego reanudado', type: 'success' })
    } catch (error) {
      console.error('Error resuming game:', error)
      memoizedAddToast({ message: 'Error al reanudar el juego', type: 'error' })
    }
  }, [currentGame, memoizedAddToast])

  const endGame = useCallback(() => {
    if (!currentGame || !socketRef.current) return
    try {
      // Send end action via WebSocket (like in original code)
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
        action: 'endGame'
      })
      memoizedAddToast({ message: 'Juego finalizado', type: 'success' })
    } catch (error) {
      console.error('Error ending game:', error)
      memoizedAddToast({ message: 'Error al finalizar el juego', type: 'error' })
    }
  }, [currentGame, memoizedAddToast])

  const restartGame = useCallback(() => {
    if (!currentGame || !socketRef.current) return
    try {
      // Send restart action via WebSocket
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
        action: 'restartGame'
      })
      memoizedAddToast({ message: 'Juego reiniciado', type: 'success' })
    } catch (error) {
      console.error('Error restarting game:', error)
      memoizedAddToast({ message: 'Error al reiniciar el juego', type: 'error' })
    }
  }, [currentGame, memoizedAddToast])

  const addTime = useCallback((seconds: number) => {
    if (!currentGame || !socketRef.current) return
    try {
      // Send add time action via WebSocket (like in original code)
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
        action: 'addTime',
        data: {
          seconds: seconds
        }
      })
      const minutes = seconds / 60
      memoizedAddToast({ message: `Se agregaron ${minutes} minutos al juego`, type: 'success' })
    } catch (error) {
      console.error('Error adding time:', error)
      memoizedAddToast({ message: 'Error al añadir tiempo', type: 'error' })
    }
  }, [currentGame, memoizedAddToast])

  const updateGameTime = useCallback((timeInSeconds: number) => {
    if (!currentGame || !socketRef.current) return
    try {
      // Send update game time action via WebSocket (like in original code)
      socketRef.current.emit('gameAction', {
        gameId: currentGame.id,
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
      memoizedAddToast({ message: `Tiempo del juego actualizado: ${timeText}`, type: 'success' })
    } catch (error) {
      console.error('Error updating game time:', error)
      memoizedAddToast({ message: 'Error al actualizar el tiempo', type: 'error' })
    }
  }, [currentGame, memoizedAddToast])

  const goBack = useCallback(() => {
    memoizedNavigate('/dashboard')
  }, [memoizedNavigate])

  const reloadPage = useCallback(() => {
    window.location.reload()
  }, [])

  const centerOnUser = useCallback(() => {
    if (mapInstanceRef.current && currentPosition) {
      mapInstanceRef.current.setView([currentPosition.lat, currentPosition.lng], 18)
    }
  }, [currentPosition])

  const centerOnSite = useCallback(() => {
    if (mapInstanceRef.current && currentGame) {
      const siteControlPoint = currentGame.controlPoints.find(cp => cp.type === 'site')
      if (siteControlPoint) {
        mapInstanceRef.current.setView([siteControlPoint.latitude, siteControlPoint.longitude], 16)
      }
    }
  }, [currentGame])

  const openTeamsDialog = useCallback(() => {
    // This function is now handled by the GameOwner component state
    // The actual dialog opening is managed in the component
  }, [])

  const updateTeamCount = useCallback((count: number) => {
    if (!currentGame || !socketRef.current) return
    
    socketRef.current.emit('gameAction', {
      gameId: currentGame.id,
      action: 'updateTeamCount',
      data: {
        teamCount: count
      }
    })
  }, [currentGame])

  const handlePlayerTeamUpdate = useCallback((data: any) => {
    // Update the affected player's data in currentGame
    if (currentGame && currentGame.players) {
      const playerIndex = currentGame.players.findIndex(p => p && p.id === data.playerId)
      if (playerIndex !== -1) {
        currentGame.players[playerIndex].team = data.team
      }
    }

    // Show notification
    if (data.userId !== currentUser?.id) {
      memoizedAddToast({ message: `${data.userName} ha sido asignado al equipo ${data.team || 'none'}`, type: 'info' })
    } else {
      memoizedAddToast({ message: `Has sido asignado al equipo ${data.team || 'none'}`, type: 'success' })
    }
  }, [currentGame, currentUser, memoizedAddToast])

  const handleTeamCountUpdate = useCallback((data: any) => {
    // Update game data and refresh team selection
    if (data && data.game) {
      setCurrentGame(data.game)
    }
  }, [])

  const enableGameNameEdit = useCallback(() => {
    memoizedAddToast({ message: 'Funcionalidad de edición de nombre no implementada aún', type: 'info' })
  }, [memoizedAddToast])

  const createControlPoint = useCallback((lat: number, lng: number) => {
    if (!socketRef.current || !currentGame) return

    const name = `Punto ${Math.round(lat * 10000)}-${Math.round(lng * 10000)}`
    
    socketRef.current.emit('gameAction', {
      gameId: currentGame.id,
      action: 'createControlPoint',
      data: {
        name,
        description: '',
        latitude: lat,
        longitude: lng,
        gameId: currentGame.id
      }
    })

    memoizedAddToast({ message: 'Punto de control creado', type: 'success' })
  }, [currentGame, memoizedAddToast])

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (!mapInstanceRef.current) return;
    
    // Remove any existing popup first
    mapInstanceRef.current.closePopup();

    // Create menu content similar to original implementation
    const menuContent = `
      <div id="controlPointMenu">
        <div style="display: flex; justify-content: center;">
          <button onclick="window.createControlPoint(${latlng.lat}, ${latlng.lng})" style="padding: 8px 16px; margin: 0 10px 0 5px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Crear Punto de Control</button>
        </div>
      </div>
    `;

    // Import Leaflet dynamically and create popup
    import('leaflet').then(L => {
      if (!mapInstanceRef.current) return;

      // Create Leaflet popup that sticks to the map
      const popup = L.popup()
        .setLatLng([latlng.lat, latlng.lng])
        .setContent(menuContent)
        .openOn(mapInstanceRef.current);

      // Add global function for the button
      (window as any).createControlPoint = (lat: number, lng: number) => {
        createControlPoint(lat, lng);
        mapInstanceRef.current?.closePopup();
      };
    });
  }, [createControlPoint])


  const openGameResultsDialog = useCallback(() => {
    setIsGameResultsDialogOpen(true)
  }, [])

  const closeGameResultsDialog = useCallback(() => {
    setIsGameResultsDialogOpen(false)
  }, [])

  // Automatically open game results dialog when game enters finished state
  useEffect(() => {
    if (currentGame?.status === 'finished') {
      // Small delay to ensure DOM is ready (like in original code)
      setTimeout(() => {
        openGameResultsDialog()
      }, 1000)
    }
  }, [currentGame?.status, openGameResultsDialog])

  // Check game status on initial load and show results if already finished
  useEffect(() => {
    if (currentGame?.status === 'finished' && !isLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        openGameResultsDialog()
      }, 1500)
    }
  }, [currentGame?.status, isLoading, openGameResultsDialog])

  return {
    currentUser,
    currentGame,
    isLoading,
    gpsStatus,
    currentPosition,
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
    controlPointMarkers,
    positionCircles,
    pieCharts,
    enableDragMode,
    controlPointTimes,
    updateTeamCount,
    playerMarkers: playerMarkersResult.playerMarkers,
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog
  }
}