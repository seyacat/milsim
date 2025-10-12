import { useState, useEffect, useRef } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { AuthService } from '../services/auth'
import { GameService } from '../services/game'
import { User, Game, ControlPoint, Toast } from '../types'

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
  startGame: () => Promise<void>
  pauseGame: () => Promise<void>
  resumeGame: () => Promise<void>
  endGame: () => Promise<void>
  restartGame: () => Promise<void>
  addTime: (seconds: number) => Promise<void>
  updateGameTime: (timeInSeconds: number) => Promise<void>
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  openTeamsDialog: () => void
  enableGameNameEdit: () => void
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

  useEffect(() => {
    let isMounted = true

    const initializeGame = async () => {
      try {
        const user = await AuthService.getCurrentUser()
        if (!isMounted) return
        
        if (!user) {
          navigate('/login')
          return
        }

        if (!gameId) {
          addToast({ message: 'ID de juego no válido', type: 'error' })
          navigate('/dashboard')
          return
        }

        const game = await GameService.getGame(parseInt(gameId))
        if (!isMounted) return
        
        if (!game) {
          addToast({ message: 'Juego no encontrado', type: 'error' })
          navigate('/dashboard')
          return
        }

        if (game.owner.id !== user.id) {
          addToast({ message: 'No tienes permisos para ver este juego', type: 'error' })
          navigate('/dashboard')
          return
        }

        setCurrentUser(user)
        setCurrentGame(game)
      } catch (error) {
        if (!isMounted) return
        console.error('Error initializing game:', error)
        addToast({ message: 'Error al cargar el juego', type: 'error' })
        navigate('/dashboard')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeGame()

    return () => {
      isMounted = false
    }
  }, [gameId, navigate, addToast])

  const startGame = async () => {
    if (!currentGame) return
    try {
      await GameService.startGame(currentGame.id)
      addToast({ message: 'Juego iniciado', type: 'success' })
    } catch (error) {
      console.error('Error starting game:', error)
      addToast({ message: 'Error al iniciar el juego', type: 'error' })
    }
  }

  const pauseGame = async () => {
    if (!currentGame) return
    try {
      await GameService.pauseGame(currentGame.id)
      addToast({ message: 'Juego pausado', type: 'success' })
    } catch (error) {
      console.error('Error pausing game:', error)
      addToast({ message: 'Error al pausar el juego', type: 'error' })
    }
  }

  const resumeGame = async () => {
    if (!currentGame) return
    try {
      await GameService.resumeGame(currentGame.id)
      addToast({ message: 'Juego reanudado', type: 'success' })
    } catch (error) {
      console.error('Error resuming game:', error)
      addToast({ message: 'Error al reanudar el juego', type: 'error' })
    }
  }

  const endGame = async () => {
    if (!currentGame) return
    try {
      await GameService.endGame(currentGame.id)
      addToast({ message: 'Juego finalizado', type: 'success' })
    } catch (error) {
      console.error('Error ending game:', error)
      addToast({ message: 'Error al finalizar el juego', type: 'error' })
    }
  }

  const restartGame = async () => {
    if (!currentGame) return
    try {
      await GameService.restartGame(currentGame.id)
      addToast({ message: 'Juego reiniciado', type: 'success' })
    } catch (error) {
      console.error('Error restarting game:', error)
      addToast({ message: 'Error al reiniciar el juego', type: 'error' })
    }
  }

  const addTime = async (seconds: number) => {
    if (!currentGame) return
    try {
      await GameService.addTime(currentGame.id, seconds)
      addToast({ message: `Tiempo añadido: ${seconds} segundos`, type: 'success' })
    } catch (error) {
      console.error('Error adding time:', error)
      addToast({ message: 'Error al añadir tiempo', type: 'error' })
    }
  }

  const updateGameTime = async (timeInSeconds: number) => {
    if (!currentGame) return
    try {
      await GameService.updateGameTime(currentGame.id, timeInSeconds)
      addToast({ message: 'Tiempo actualizado', type: 'success' })
    } catch (error) {
      console.error('Error updating game time:', error)
      addToast({ message: 'Error al actualizar el tiempo', type: 'error' })
    }
  }

  const goBack = () => {
    navigate('/dashboard')
  }

  const reloadPage = () => {
    window.location.reload()
  }

  const centerOnUser = () => {
    if (mapInstanceRef.current && currentPosition) {
      mapInstanceRef.current.setView([currentPosition.lat, currentPosition.lng], 18)
    }
  }

  const centerOnSite = () => {
    if (mapInstanceRef.current && currentGame) {
      // Find the site control point to center on
      const siteControlPoint = currentGame.controlPoints.find(cp => cp.type === 'site')
      if (siteControlPoint) {
        mapInstanceRef.current.setView([siteControlPoint.lat, siteControlPoint.lng], 16)
      }
    }
  }

  const openTeamsDialog = () => {
    addToast({ message: 'Funcionalidad de equipos no implementada aún', type: 'info' })
  }

  const enableGameNameEdit = () => {
    addToast({ message: 'Funcionalidad de edición de nombre no implementada aún', type: 'info' })
  }

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
    enableGameNameEdit
  }
}