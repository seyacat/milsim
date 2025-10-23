import React, { memo } from 'react'
import { User, Game } from '../../types'
import { GameTimeDisplayRefactored } from '../GameTimeDisplayRefactored'
import { Socket } from 'socket.io-client'
import { useTimer } from '../TimerManager'
import { useGPS } from '../GPSManager'

interface GameOverlayProps {
  currentUser: User
  currentGame: Game
  socket: Socket | null
}

const GameOverlay: React.FC<GameOverlayProps> = React.memo(({
  currentUser,
  currentGame,
  socket
}) => {
  const { gpsStatus } = useGPS();
  const { timeData } = useTimer();
  
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
        
        <GameTimeDisplayRefactored currentGame={currentGame} />
      </div>
    </div>
  )
})

const arePropsEqual = (prevProps: GameOverlayProps, nextProps: GameOverlayProps) => {
  // Only re-render if game status, user name, or game name changes
  // Don't re-render for player team changes or other minor updates
  return (
    prevProps.currentUser.name === nextProps.currentUser.name &&
    prevProps.currentGame.name === nextProps.currentGame.name &&
    prevProps.currentGame.status === nextProps.currentGame.status &&
    prevProps.currentGame.owner.name === nextProps.currentGame.owner.name
  );
};

export default memo(GameOverlay, arePropsEqual)