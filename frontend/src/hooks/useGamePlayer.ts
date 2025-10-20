import { useState, useEffect, useRef, useCallback } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { AuthService } from '../services/auth'
import { GameService } from '../services/game'
import { User, Game, ControlPoint, Toast } from '../types'
import { io, Socket } from 'socket.io-client'
import { useGameTime, ControlPointTimeData } from './useGameTime'
import { useGPSTracking } from './useGPSTracking'
import { useControlPoints } from './useControlPoints'
import { useControlPointTimers } from './useControlPointTimers'
import { useBombTimers } from './useBombTimers'
import { usePlayerMarkers } from './usePlayerMarkers'

interface UseGamePlayerReturn {
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
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  controlPointTimes: ControlPointTimeData[]
  controlPointMarkers: Map<number, any>
  positionCircles: Map<number, any>
  pieCharts: Map<number, any>
  activeBombTimers: Map<number, any>
  isGameResultsDialogOpen: boolean
  openGameResultsDialog: () => void
  closeGameResultsDialog: () => void
  showTeamSelection: boolean
  hideTeamSelection: () => void
  showTeamSelectionManual: () => void
}

export const useGamePlayer = (
  gameId: string | undefined,
  navigate: NavigateFunction,
  addToast: (toast: Omit<Toast, 'id'>) => void
): UseGamePlayerReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGameResultsDialogOpen, setIsGameResultsDialogOpen] = useState(false)
  const [showTeamSelection, setShowTeamSelection] = useState(false)
  const [shouldShowTeamSelection, setShouldShowTeamSelection] = useState(false)
  const [hasAutoShownTeamSelection, setHasAutoShownTeamSelection] = useState(false)

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
  const { updateAllTimerDisplays } = useControlPointTimers(currentGame, socketRef.current, controlPointTimes)

  // Use bomb timers hook
  const { activeBombTimers, updateAllBombTimerDisplays } = useBombTimers(currentGame, socketRef.current)

  // Use control points hook
  const controlPointsResult = useControlPoints({
    game: currentGame,
    map: mapInstanceRef.current,
    isOwner: false,
    socket: socketRef.current,
    showToast: showToastWrapper
  })
  
  const controlPointMarkers = controlPointsResult?.controlPointMarkers || new Map();
  const positionCircles = controlPointsResult?.positionCircles || new Map();
  const pieCharts = controlPointsResult?.pieCharts || new Map();
  const updateAllControlPointTimers = controlPointsResult?.updateAllControlPointTimers || (() => {});

  // Use player markers hook
  const { updatePlayerMarkers, updatePlayerMarkerTeam, updatePlayerMarkerTeamByUserId } = usePlayerMarkers({
    game: currentGame,
    map: mapInstanceRef.current,
    currentUser,
    socket: socketRef.current,
    isOwner: false
  })

  // Log initialization
  useEffect(() => {
  }, [currentGame, currentUser]);

  // Update control point timers when control point times change
  useEffect(() => {
    if (controlPointTimes && controlPointTimes.length > 0) {
      updateAllControlPointTimers();
      updateAllTimerDisplays();
      updateAllBombTimerDisplays();
    }
  }, [controlPointTimes, updateAllControlPointTimers, updateAllTimerDisplays, updateAllBombTimerDisplays]);

  // Update global active bomb timers reference when they change
  useEffect(() => {
    ;(window as any).activeBombTimers = activeBombTimers;
  }, [activeBombTimers]);

  // Use GPS tracking hook
  const { gpsStatus, currentPosition } = useGPSTracking(currentGame, socketRef.current)

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

        setCurrentUser(user)
        currentUserRef.current = user
        setCurrentGame(game)
        
        // Expose game globally for control point interactions
        ;(window as any).currentGame = game
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
      
      // Expose socket and game globally for control point interactions
      ;(window as any).currentSocket = socket
      
      // Expose active bomb timers globally for popup access
      ;(window as any).activeBombTimers = activeBombTimers

      // Listen for successful connection
      socket.on('connect', () => {
        // Join game room
        socket.emit('joinGame', { gameId: parseInt(gameId) })
      })

      // Log all WebSocket events for debugging
      socket.onAny((event: string, ...args: any[]) => {
      });

      // Log WebSocket emits
      const originalEmit = socket.emit.bind(socket);
      socket.emit = (event: string, ...args: any[]) => {
        return originalEmit(event, ...args);
      };

      // Listen for game updates - this should be the main event for game state changes
      socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
        if (data.game) {
          setCurrentGame(data.game)
          // Handle specific status changes
          if (data.game.status === 'finished') {
            setTimeout(() => {
              setIsGameResultsDialogOpen(true)
            }, 1000)
          } else if (data.game.status === 'stopped') {
            setIsGameResultsDialogOpen(false)
            memoizedAddToast({ message: 'El juego ha sido detenido. Puedes seleccionar tu equipo.', type: 'info' })
          }
        }
      })

      // Listen for game state events
      socket.on('gameState', (game: Game) => {
        if (game) {
          setCurrentGame(game)
          // Handle specific status changes
          if (game.status === 'finished') {
            setTimeout(() => {
              setIsGameResultsDialogOpen(true)
            }, 1000)
          } else if (game.status === 'stopped') {
            setIsGameResultsDialogOpen(false)
            memoizedAddToast({ message: 'El juego ha sido detenido. Puedes seleccionar tu equipo.', type: 'info' })
          }
        }
      })

      // Listen for game status changes
      socket.on('gameStatusChanged', (data: { game: Game; previousStatus: string; newStatus: string }) => {
        if (data.game) {
          setCurrentGame(data.game)
          
          // Handle specific status transitions
          if (data.newStatus === 'finished') {
            setTimeout(() => {
              setIsGameResultsDialogOpen(true)
            }, 1000)
          } else if (data.newStatus === 'stopped') {
            setIsGameResultsDialogOpen(false)
            memoizedAddToast({ message: 'El juego ha sido detenido. Puedes seleccionar tu equipo.', type: 'info' })
          }
        }
      })

      // Listen for game finish events specifically
      socket.on('gameFinished', (data: { game: Game }) => {
        if (data.game) {
          setCurrentGame(data.game)
          setTimeout(() => {
            setIsGameResultsDialogOpen(true)
          }, 1000)
        }
      })

      // Listen for game stopped events specifically
      socket.on('gameStopped', (data: { game: Game }) => {
        if (data.game) {
          setCurrentGame(data.game)
          setIsGameResultsDialogOpen(false)
          memoizedAddToast({ message: 'El juego ha sido detenido. Puedes seleccionar tu equipo.', type: 'info' })
        }
      })

      // Listen for any game action that might change the game state
      socket.on('gameAction', (data: { action: string; data: any }) => {
        if (data.action === 'updateGameStatus') {
          // This handles when the owner changes the game status
          // The game state should be updated via gameUpdate or gameState events
        } else if (data.action === 'gameStateChanged' && data.data.game) {
          // Handle game state changes from owner actions
          setCurrentGame(data.data.game);
          
          // Handle specific status changes
          if (data.data.game.status === 'finished') {
            setTimeout(() => {
              setIsGameResultsDialogOpen(true);
            }, 1000);
          } else if (data.data.game.status === 'stopped') {
            setIsGameResultsDialogOpen(false);
            memoizedAddToast({ message: 'El juego ha sido detenido. Puedes seleccionar tu equipo.', type: 'info' });
          }
        } else if (data.action === 'teamCountUpdated' && data.data.game) {
          // Handle team count updates from owner
          setCurrentGame(data.data.game);
        } else if (data.action === 'timeAdded' && data.data.game) {
          // Handle time added by owner
          setCurrentGame(data.data.game);
          memoizedAddToast({ message: 'Se ha agregado tiempo al juego', type: 'info' });
        } else if (data.action === 'gameTimeUpdated' && data.data.game) {
          // Handle game time updates from owner
          setCurrentGame(data.data.game);
          memoizedAddToast({ message: 'El tiempo del juego ha sido actualizado', type: 'info' });
        }
      })

      // Listen for join success
      socket.on('joinSuccess', (data: { user: User }) => {
        if (data.user) {
          setCurrentUser(data.user)
          currentUserRef.current = data.user
        }
      })

      // Listen for player team updates
      socket.on('gameAction', (data: { action: string; data: any }) => {
        if (data.action === 'playerTeamUpdated') {
          
          // Update the current game state to reflect the team change
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

          // Show toast notification for team change
          const targetPlayer = currentGame?.players?.find(p => p.user?.id === data.data.userId);
          const playerName = targetPlayer?.user?.name || data.data.userName || 'Un jugador';
          const teamName = data.data.team && data.data.team !== 'none' ? data.data.team.toUpperCase() : 'sin equipo';
          
          
          if (data.data.userId === currentUserRef.current?.id) {
            memoizedAddToast({ message: `Haz cambiado de equipo`, type: 'info' });
          } else {
            memoizedAddToast({ message: `${playerName} ha cambiado al equipo ${teamName}`, type: 'info' });
          }

          // Force update player markers to reflect team changes
          if (updatePlayerMarkers) {
            updatePlayerMarkers();
          }
          
          // Also update individual player marker if it exists
          if (updatePlayerMarkerTeamByUserId && data.data.userId) {
            updatePlayerMarkerTeamByUserId(data.data.userId, data.data.team);
          } else if (updatePlayerMarkerTeam && data.data.playerId) {
            updatePlayerMarkerTeam(data.data.playerId, data.data.team);
          }

          // Update user's own marker if they changed their own team
          if (data.data.userId === currentUserRef.current?.id && currentPosition) {
            createUserMarker(currentPosition.lat, currentPosition.lng);
          }
        }
      });

      // Listen for challenge responses
      socket.on('codeChallengeResult', (data: { success: boolean; message: string }) => {
        if (data.success) {
          memoizedAddToast({ message: data.message, type: 'success' })
        } else {
          memoizedAddToast({ message: data.message, type: 'error' })
        }
      })

      socket.on('bombChallengeResult', (data: { success: boolean; message: string }) => {
        if (data.success) {
          memoizedAddToast({ message: data.message, type: 'success' })
        } else {
          memoizedAddToast({ message: data.message, type: 'error' })
        }
      })

      socket.on('bombDeactivationResult', (data: { success: boolean; message: string }) => {
        if (data.success) {
          memoizedAddToast({ message: data.message, type: 'success' })
        } else {
          memoizedAddToast({ message: data.message, type: 'error' })
        }
      })

      // Listen for game errors
      socket.on('gameActionError', (data: { action: string; error: string }) => {
        console.error(`Game action error (${data.action}):`, data.error)
        memoizedAddToast({ message: `Error: ${data.error}`, type: 'error' })
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
  
      // Import Leaflet dynamically
      import('leaflet').then(L => {
        if (!mapInstanceRef.current) return
  
        // Find the current player in the game to get the correct team
        const currentPlayer = currentGame?.players?.find(p => p.user?.id === currentUser?.id);
        const teamClass = currentPlayer?.team || currentUser?.team || 'none';
        
        // If marker exists, just update the icon instead of recreating
        if (userMarkerRef.current) {
          const currentPosition = userMarkerRef.current.getLatLng();
          const newIcon = L.divIcon({
            className: `user-marker ${teamClass}`,
            html: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          userMarkerRef.current.setIcon(newIcon);
        } else {
          // Create new marker if it doesn't exist
          userMarkerRef.current = L.marker([lat, lng], {
            icon: L.divIcon({
              className: `user-marker ${teamClass}`,
              html: '',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          }).addTo(mapInstanceRef.current)
          
          // Create popup with custom class for positioning
          const popup = L.popup({
            className: 'user-marker-popup'
          }).setContent('<strong>Tú.</strong>')
          
          userMarkerRef.current.bindPopup(popup).openPopup()
        }
      })
    }, [currentUser, currentGame])

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

  // Show team selection when game is stopped and shouldShowTeamSelection is true
  useEffect(() => {
    if (!currentGame || !currentUser || isLoading) return

    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id
    const isStopped = currentGame.status === 'stopped'

    // Only show team selection for non-owners when game is stopped and shouldShowTeamSelection is true
    if (!isOwner && isStopped && shouldShowTeamSelection) {
      setShowTeamSelection(true)
    } else {
      setShowTeamSelection(false)
    }
  }, [currentGame, currentUser, isLoading, shouldShowTeamSelection])

  // Automatically show team selection only in specific cases
  useEffect(() => {
    if (!currentGame || !currentUser || isLoading) return

    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id
    const isStopped = currentGame.status === 'stopped'
    
    // Find current player
    const currentPlayer = currentGame.players?.find((p: any) => p?.user?.id === currentUser.id)
    const hasTeam = currentPlayer?.team && currentPlayer.team !== 'none'

    // Only show automatically for non-owners when game is stopped
    if (!isOwner && isStopped && !hasAutoShownTeamSelection) {
      // Case 1: Page load/refresh and player doesn't have a team
      if (!hasTeam) {
        setShouldShowTeamSelection(true)
        setHasAutoShownTeamSelection(true)
      }
      // Case 2: Game status changed from 'finished' to 'stopped'
      // This will be handled by the game status change effect below
    }
  }, [currentGame, currentUser, isLoading, hasAutoShownTeamSelection])

  // Reset auto-show flag when game status changes to prevent unwanted popups
  useEffect(() => {
    if (currentGame?.status !== 'stopped') {
      setHasAutoShownTeamSelection(false)
    }
  }, [currentGame?.status])

  // Handle game status changes (specifically from 'finished' to 'stopped')
  useEffect(() => {
    if (!currentGame || !currentUser || isLoading) return

    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id
    const isStopped = currentGame.status === 'stopped'

    // When game changes from 'finished' to 'stopped', show team selection for non-owners
    if (!isOwner && isStopped && !hasAutoShownTeamSelection) {
      setShouldShowTeamSelection(true)
      setHasAutoShownTeamSelection(true)
    }
  }, [currentGame?.status, currentUser, isLoading, hasAutoShownTeamSelection])

  const hideTeamSelection = useCallback(() => {
    setShouldShowTeamSelection(false)
    setShowTeamSelection(false)
  }, [])

  const showTeamSelectionManual = useCallback(() => {
    if (!currentGame || !currentUser) return
    
    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id
    const isStopped = currentGame.status === 'stopped'
    
    // Only allow manual team selection for non-owners when game is stopped
    if (!isOwner && isStopped) {
      setShouldShowTeamSelection(true)
    }
  }, [currentGame, currentUser])

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
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite,
    controlPointTimes,
    controlPointMarkers,
    positionCircles,
    pieCharts,
    activeBombTimers,
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog,
    showTeamSelection,
    hideTeamSelection,
    showTeamSelectionManual
  }
}