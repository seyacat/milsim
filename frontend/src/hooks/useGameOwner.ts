import { useState, useEffect, useRef, useCallback } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { AuthService } from '../services/auth'
import { GameService } from '../services/game'
import { User, Game, ControlPoint, Toast } from '../types'
import { io, Socket } from 'socket.io-client'

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
}

export const useGameOwner = (
  gameId: string | undefined,
  navigate: NavigateFunction,
  addToast: (toast: Omit<Toast, 'id'>) => void
): UseGameOwnerReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentGame, setCurrentGame] = useState<Game | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [gpsStatus, setGpsStatus] = useState('Desconectado')
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const playerMarkersRef = useRef<any>(null)
  const controlPointMarkersRef = useRef<any>(null)
  const watchIdRef = useRef<number | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Memoize functions to prevent re-renders
  const memoizedAddToast = useCallback(addToast, [addToast])
  const memoizedNavigate = useCallback(navigate, [navigate])

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
        console.log('WebSocket connected')
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
        console.log('WebSocket disconnected:', reason)
        // Don't show toast on every disconnect - only show for unexpected disconnections
        if (reason === 'io server disconnect' || reason === 'transport close') {
          memoizedAddToast({ message: 'Conexión perdida con el servidor', type: 'error' })
        }
      })

    }

    return () => {
      isMounted = false
      // Clean up GPS watch
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      // Don't disconnect WebSocket - let it be persistent
      // The WebSocket will be cleaned up when the component unmounts naturally
    }
  }, [gameId, memoizedNavigate, memoizedAddToast])

  // Start GPS tracking when component mounts
  useEffect(() => {
    let isMounted = true

    const startGPS = () => {
      if (!navigator.geolocation) {
        setGpsStatus('GPS no soportado')
        return
      }

      setGpsStatus('Activando...')

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (!isMounted) return

          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const accuracy = position.coords.accuracy

          setCurrentPosition({ lat, lng, accuracy })
          setGpsStatus('Activo')

          // Update user marker on map
          if (!userMarkerRef.current && mapInstanceRef.current) {
            createUserMarker(lat, lng)
            
            // Set view to user's location when GPS is first available (like in original code)
            mapInstanceRef.current.setView([lat, lng], 16)
          } else if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([lat, lng])
          }

          // Send position update via WebSocket
          if (socketRef.current && currentGame) {
            socketRef.current.emit('gameAction', {
              gameId: currentGame.id,
              action: 'positionUpdate',
              data: { lat, lng, accuracy }
            })
          }
        },
        (error) => {
          if (!isMounted) return
          
          console.error('GPS error:', error)
          let message = 'Error de GPS'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Permiso denegado'
              break
            case error.POSITION_UNAVAILABLE:
              message = 'Ubicación no disponible'
              break
            case error.TIMEOUT:
              message = 'Tiempo agotado'
              break
          }
          setGpsStatus(message)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0  // Force fresh GPS updates every time
        }
      )
    }

    const createUserMarker = (lat: number, lng: number) => {
      if (!mapInstanceRef.current) return

      // Remove existing marker if it exists
      if (userMarkerRef.current) {
        mapInstanceRef.current.removeLayer(userMarkerRef.current)
        userMarkerRef.current = null
      }

      // Import Leaflet dynamically
      import('leaflet').then(L => {
        if (!isMounted || !mapInstanceRef.current) return

        const teamClass = currentUser?.team || 'none'
        
        userMarkerRef.current = L.marker([lat, lng], {
          icon: L.divIcon({
            className: `user-marker ${teamClass}`,
            iconSize: [24, 24],
          })
        }).addTo(mapInstanceRef.current)
        
        // Create popup with custom class for positioning
        const popup = L.popup({
          className: 'user-marker-popup'
        }).setContent('<strong>Tú.</strong>')
        
        userMarkerRef.current.bindPopup(popup).openPopup()
      })
    }

    // Start GPS tracking
    startGPS()

    return () => {
      isMounted = false
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [currentGame, currentUser])

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
        mapInstanceRef.current.setView([siteControlPoint.lat, siteControlPoint.lng], 16)
      }
    }
  }, [currentGame])

  const openTeamsDialog = useCallback(() => {
    memoizedAddToast({ message: 'Funcionalidad de equipos no implementada aún', type: 'info' })
  }, [memoizedAddToast])

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
    handleMapClick
  }
}