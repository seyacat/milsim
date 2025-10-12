import React from 'react'
import { Game } from '../../types'

interface ControlPanelProps {
  currentGame: Game
  startGame: () => Promise<void>
  pauseGame: () => Promise<void>
  resumeGame: () => Promise<void>
  endGame: () => Promise<void>
  restartGame: () => Promise<void>
  addTime: (seconds: number) => Promise<void>
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  currentGame,
  startGame,
  pauseGame,
  resumeGame,
  endGame,
  restartGame,
  addTime
}) => {
  const handleStartGame = () => {
    startGame()
  }

  const handlePauseGame = () => {
    pauseGame()
  }

  const handleResumeGame = () => {
    resumeGame()
  }

  const handleEndGame = () => {
    endGame()
  }

  const handleRestartGame = () => {
    restartGame()
  }

  const handleAddTime = (seconds: number) => {
    addTime(seconds)
  }
  const getStatusActions = () => {
    switch (currentGame.status) {
      case 'stopped':
        return (
          <button
            className="control-btn start-btn"
            onClick={handleStartGame}
          >
            Iniciar Juego
          </button>
        )
      case 'running':
        return (
          <button
            className="control-btn pause-btn"
            onClick={handlePauseGame}
          >
            Pausar Juego
          </button>
        )
      case 'paused':
        return (
          <button
            className="control-btn resume-btn"
            onClick={handleResumeGame}
          >
            Reanudar Juego
          </button>
        )
      case 'finished':
        return (
          <button
            className="control-btn restart-btn"
            onClick={handleRestartGame}
          >
            Reiniciar Juego
          </button>
        )
      default:
        return null
    }
  }

  return (
    <div className="control-panel">
      <h3>Controles del Juego</h3>
      
      {/* Main Game Controls */}
      <div className="main-controls">
        {getStatusActions()}
        
        {currentGame.status !== 'finished' && (
          <button
            className="control-btn end-btn"
            onClick={handleEndGame}
          >
            Finalizar Juego
          </button>
        )}
      </div>

      {/* Quick Time Controls */}
      <div className="time-controls">
        <h4>Control de Tiempo Rápido</h4>
        <div className="time-buttons-grid">
          <button
            className="time-control-btn"
            onClick={() => handleAddTime(30)}
          >
            +30s
          </button>
          <button
            className="time-control-btn"
            onClick={() => handleAddTime(60)}
          >
            +1m
          </button>
          <button
            className="time-control-btn"
            onClick={() => handleAddTime(300)}
          >
            +5m
          </button>
          <button
            className="time-control-btn"
            onClick={() => handleAddTime(600)}
          >
            +10m
          </button>
        </div>
      </div>

      {/* Game Status Info */}
      <div className="game-status-info">
        <div className="status-item">
          <span className="status-label">Estado:</span>
          <span className={`status-value status-${currentGame.status}`}>
            {currentGame.status === 'stopped' && 'Detenido'}
            {currentGame.status === 'running' && 'En Curso'}
            {currentGame.status === 'paused' && 'Pausado'}
            {currentGame.status === 'finished' && 'Finalizado'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Jugadores:</span>
          <span className="status-value">{currentGame.activeConnections}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Puntos de Control:</span>
          <span className="status-value">{currentGame.controlPoints.length}</span>
        </div>
      </div>

      {/* Emergency Controls */}
      <div className="emergency-controls">
        <h4>Controles de Emergencia</h4>
        <div className="emergency-buttons">
          <button
            className="emergency-btn force-end-btn"
            onClick={handleEndGame}
          >
            Forzar Finalización
          </button>
          <button
            className="emergency-btn reset-btn"
            onClick={handleRestartGame}
          >
            Reiniciar Todo
          </button>
        </div>
      </div>
    </div>
  )
}

export default ControlPanel