import React from 'react'
import { Game, User } from '../../types'

interface GameOverlayProps {
  currentGame: Game
  currentUser: User
  gpsStatus: string
  enableGameNameEdit: () => void
}

const GameOverlay: React.FC<GameOverlayProps> = ({
  currentGame,
  currentUser,
  gpsStatus,
  enableGameNameEdit
}) => {
  const formatTime = (seconds: number | null | undefined): string => {
    if (!seconds && seconds !== 0) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'stopped': return 'Detenido'
      case 'running': return 'En curso'
      case 'paused': return 'Pausado'
      case 'finished': return 'Finalizado'
      default: return status
    }
  }

  return (
    <div className="game-overlay">
      <div className="game-info">
        <div className="game-title-container">
          <h2>{currentGame.name}</h2>
          <span className="edit-pencil" onClick={enableGameNameEdit} title="Editar nombre del juego">
            ✏️
          </span>
        </div>
        <div className="game-details">
          <div>
            Estado: <span>{getStatusText(currentGame.status)}</span>
          </div>
          <div>
            Jugadores: <span>{currentGame.activeConnections}</span>
          </div>
          <div>
            Propietario: <span>{currentUser.name}</span>
          </div>
          <div>
            Usuario: <span>{currentUser.name}</span>
          </div>
          {currentGame.playedTime !== undefined && (
            <div>
              Tiempo jugado: <span>{formatTime(currentGame.playedTime)}</span>
            </div>
          )}
          {currentGame.remainingTime !== undefined && (
            <div>
              Tiempo restante: <span>{formatTime(currentGame.remainingTime)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="game-details">
        GPS: <span>{gpsStatus}</span>
      </div>
    </div>
  )
}

export default GameOverlay