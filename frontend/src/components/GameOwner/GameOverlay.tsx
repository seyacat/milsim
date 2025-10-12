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
      {/* Game Info Panel */}
      <div className="game-info-panel">
        <div className="game-header">
          <h2 className="game-name" onClick={enableGameNameEdit}>
            {currentGame.name}
          </h2>
          <div className="game-status">
            <span className={`status-badge status-${currentGame.status}`}>
              {getStatusText(currentGame.status)}
            </span>
          </div>
        </div>

        <div className="game-stats">
          <div className="stat-item">
            <span className="stat-label">Jugadores:</span>
            <span className="stat-value">{currentGame.activeConnections}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Equipos:</span>
            <span className="stat-value">{currentGame.teamCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">GPS:</span>
            <span className={`stat-value gps-${gpsStatus.toLowerCase()}`}>
              {gpsStatus}
            </span>
          </div>
        </div>

        <div className="time-display">
          <div className="time-section">
            <span className="time-label">Tiempo Total:</span>
            <span className="time-value">
              {formatTime(currentGame.totalTime)}
            </span>
          </div>
          {currentGame.remainingTime !== undefined && (
            <div className="time-section">
              <span className="time-label">Tiempo Restante:</span>
              <span className="time-value">
                {formatTime(currentGame.remainingTime)}
              </span>
            </div>
          )}
          {currentGame.playedTime !== undefined && (
            <div className="time-section">
              <span className="time-label">Tiempo Jugado:</span>
              <span className="time-value">
                {formatTime(currentGame.playedTime)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Control Points Panel */}
      <div className="control-points-panel">
        <h3>Puntos de Control</h3>
        <div className="control-points-list">
          {currentGame.controlPoints.map(cp => (
            <div key={cp.id} className="control-point-item">
              <div className="cp-info">
                <span className="cp-name">{cp.name}</span>
                <span className="cp-type">{cp.type === 'site' ? 'Sitio' : 'Control'}</span>
              </div>
              <div className="cp-status">
                {cp.currentTeam && (
                  <span className={`team-badge team-${cp.currentTeam}`}>
                    {cp.currentTeam}
                  </span>
                )}
                {cp.displayTime && (
                  <span className="cp-time">{cp.displayTime}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default GameOverlay