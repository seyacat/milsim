import React, { memo } from 'react'
import { Game, User } from '../../types'
import { GameTimeDisplayRefactored } from '../GameTimeDisplayRefactored'
import { Socket } from 'socket.io-client'
import { useTimer } from '../TimerManager'

interface GameOverlayProps {
  currentGame: Game
  currentUser: User
  gpsStatus?: string
  enableGameNameEdit: () => void
  socket: Socket | null
}

const GameOverlay: React.FC<GameOverlayProps> = ({
  currentGame,
  currentUser,
  gpsStatus,
  enableGameNameEdit,
  socket
}) => {
  const { timeData } = useTimer();
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
        </div>
      </div>
      
      {/* Game Time Display Component */}
      <GameTimeDisplayRefactored currentGame={currentGame} />
      
      <div className="game-details">
        GPS: <span>{gpsStatus}</span>
      </div>
    </div>
  )
}

export default memo(GameOverlay)