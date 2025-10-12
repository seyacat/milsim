import { useState, useEffect, useRef, useCallback } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { AuthService } from '../services/auth'
import { GameService } from '../services/game'
import { User, Game, ControlPoint, Toast } from '../types'
import { io, Socket } from 'socket.io-client'
import { useGameTime, ControlPointTimeData } from './useGameTime'

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
}

export const useGamePlayer = (
  gameId: string | undefined,
  navigate: NavigateFunction,
  addToast: (toast: Omit<Toast, 'id'>) => void
): UseGamePlayerReturn => {
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

  // Use game time hook to get control point times
  const { controlPointTimes } = useGameTime(currentGame, socketRef.current)

  // Log control point times for debugging
  useEffect(() => {
    if (controlPointTimes && controlPointTimes.length > 0) {
    }
  }, [controlPointTimes]);

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
        // Join game room
        socket.emit('joinGame', { gameId: parseInt(gameId) })
      })

      // Listen for game updates
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
    controlPointTimes
  }
}