import React from 'react'
import { User, Game } from '../../types'
import { GameTimeDisplayRefactored } from '../GameTimeDisplayRefactored'
import { Socket } from 'socket.io-client'

interface GameOverlayProps {
  currentUser: User
  currentGame: Game
  gpsStatus?: string
  socket: Socket | null
  timeData?: {
    remainingTime: number | null;
    playedTime: number;
    totalTime: number | null;
  };
}

const GameOverlay: React.FC<GameOverlayProps> = ({
  currentUser,
  currentGame,
  gpsStatus,
  socket,
  timeData
}) => {
  return (
    <div className="game-overlay">
      <div className="game-header">
        <div className="game-title-section">
          <h1 className="game-title" id="gameTitle">
            {currentGame.name}
          </h1>
        </div>
        
        <div className="game-info">
          <div className="game-status">
            <span className="status-label">Estado:</span>
            <span className="status-value" id="gameStatus">
              {currentGame.status}
            </span>
          </div>
          
          <div className="game-owner">
            <span className="owner-label">Propietario:</span>
            <span className="owner-value" id="gameOwner">
              {currentGame.owner.name}
            </span>
          </div>
          
          <div className="current-user">
            <span className="user-label">Tú:</span>
            <span className="user-value" id="currentUser">
              {currentUser.name}
            </span>
          </div>

          <div className="gps-status">
            <span className="status-label">GPS:</span>
            <span className="status-value" id="gpsStatus">
              {gpsStatus}
            </span>
          </div>
        </div>
        
        <GameTimeDisplayRefactored currentGame={currentGame} timeData={timeData} />
      </div>
    </div>
  )
}

export default GameOverlay