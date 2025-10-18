import React from 'react'
import { Game } from '../../types'

interface ControlPanelProps {
  currentGame: Game
  startGame: () => Promise<void>
  pauseGame: () => Promise<void>
  resumeGame: () => Promise<void>
  endGame: () => Promise<void>
  restartGame: () => Promise<void>
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  currentGame,
  startGame,
  pauseGame,
  resumeGame,
  endGame,
  restartGame
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

  const getStatusActions = () => {
    switch (currentGame.status) {
      case 'stopped':
        return (
          <button
            id="startGameBtn"
            className="btn btn-primary"
            onClick={handleStartGame}
            style={{ display: 'block', width: '100%' }}
          >
            Iniciar
          </button>
        )
      case 'running':
        return (
          <button
            id="pauseGameBtn"
            className="btn btn-warning"
            onClick={handlePauseGame}
            style={{ display: 'block', width: '100%' }}
          >
            Pausar
          </button>
        )
      case 'paused':
        return (
          <>
            <button
              id="endGameBtn"
              className="btn btn-danger"
              onClick={handleEndGame}
              style={{ display: 'block', width: '100%', marginBottom: '10px' }}
            >
              Finalizar
            </button>
            <button
              id="resumeGameBtn"
              className="btn btn-primary"
              onClick={handleResumeGame}
              style={{ display: 'block', width: '100%' }}
            >
              Reanudar
            </button>
          </>
        )
      case 'finished':
        return (
          <button
            id="restartGameBtn"
            className="btn btn-primary"
            onClick={handleRestartGame}
            style={{ display: 'block', width: '100%' }}
          >
            Nuevo Juego
          </button>
        )
      default:
        return null
    }
  }

  return (
    <div className="control-panel">
      <div id="ownerControls" style={{ display: 'block' }}>
        {getStatusActions()}
        {currentGame.status !== 'finished' && currentGame.status !== 'running' && currentGame.status !== 'paused' && currentGame.status !== 'stopped' && (
          <button
            id="endGameBtn"
            className="btn btn-danger"
            onClick={handleEndGame}
            style={{ display: 'block', width: '100%', marginBottom: '10px' }}
          >
            Finalizar
          </button>
        )}
      </div>
    </div>
  )
}

export default ControlPanel