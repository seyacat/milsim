import React from 'react'
import { User, Game } from '../types'
import { GameTimeDisplay } from './GameTimeDisplay'
import { Socket } from 'socket.io-client'

interface GameOverlayProps {
  currentUser: User
  currentGame: Game
  isOwner: boolean
  goBack: () => void
  socket: Socket | null
}

const GameOverlay: React.FC<GameOverlayProps> = ({
  currentUser,
  currentGame,
  isOwner,
  goBack,
  socket
}) => {
  return (
    <div className="game-overlay">
      <div className="game-header">
        <div className="game-title-section">
          <h1 className="game-title" id="gameTitle">
            {currentGame.name}
          </h1>
          {isOwner && (
            <span
              className="edit-pencil"
              id="editPencil"
              title="Editar nombre del juego"
            >
              ✏️
            </span>
          )}
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
        </div>
        
        {/* Debug: Add time elements directly for testing */}
        <div className="game-time-display" style={{border: '1px solid red', padding: '10px', margin: '10px 0'}}>
          <div className="time-section">
            <div className="time-label">Tiempo jugado (DEBUG):</div>
            <div id="timePlayed" className="time-value" style={{color: 'red', fontWeight: 'bold'}}>00:00</div>
          </div>
          <div id="timeRemainingContainer" className="time-section" style={{display: 'none'}}>
            <div className="time-label">Tiempo restante:</div>
            <div id="timeRemaining" className="time-value">00:00</div>
          </div>
        </div>
        
        <GameTimeDisplay currentGame={currentGame} socket={socket} />
        
        <button className="btn btn-secondary back-btn" onClick={goBack}>
          ← Volver
        </button>
      </div>
    </div>
  )
}

export default GameOverlay