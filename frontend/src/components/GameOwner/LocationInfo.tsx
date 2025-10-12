import React, { useState } from 'react'
import { Game } from '../../types'

interface LocationInfoProps {
  currentPosition: { lat: number; lng: number; accuracy: number } | null
  currentGame: Game
  addTime: (seconds: number) => Promise<void>
  updateGameTime: (timeInSeconds: number) => Promise<void>
  openTeamsDialog: () => void
}

const LocationInfo: React.FC<LocationInfoProps> = ({
  currentPosition,
  currentGame,
  addTime,
  updateGameTime,
  openTeamsDialog
}) => {
  const [timeInput, setTimeInput] = useState('')

  const handleAddTime = (seconds: number) => {
    addTime(seconds)
  }

  const handleUpdateTime = () => {
    const timeInSeconds = parseInt(timeInput) * 60
    if (!isNaN(timeInSeconds) && timeInSeconds > 0) {
      updateGameTime(timeInSeconds)
      setTimeInput('')
    }
  }

  return (
    <div className="location-info-panel">
      {/* GPS Position Info */}
      <div className="gps-info">
        <h3>Posición GPS</h3>
        {currentPosition ? (
          <div className="position-data">
            <div className="coord">
              <span className="label">Lat:</span>
              <span className="value">{currentPosition.lat.toFixed(6)}</span>
            </div>
            <div className="coord">
              <span className="label">Lng:</span>
              <span className="value">{currentPosition.lng.toFixed(6)}</span>
            </div>
            <div className="coord">
              <span className="label">Precisión:</span>
              <span className="value">{currentPosition.accuracy.toFixed(1)}m</span>
            </div>
          </div>
        ) : (
          <div className="no-position">
            Posición GPS no disponible
          </div>
        )}
      </div>

      {/* Time Management */}
      <div className="time-management">
        <h3>Gestión de Tiempo</h3>
        <div className="time-buttons">
          <button 
            className="time-btn" 
            onClick={() => handleAddTime(60)}
          >
            +1 min
          </button>
          <button 
            className="time-btn" 
            onClick={() => handleAddTime(300)}
          >
            +5 min
          </button>
          <button 
            className="time-btn" 
            onClick={() => handleAddTime(600)}
          >
            +10 min
          </button>
        </div>
        
        <div className="set-time-section">
          <input
            type="number"
            placeholder="Minutos"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="time-input"
          />
          <button 
            className="set-time-btn"
            onClick={handleUpdateTime}
          >
            Establecer Tiempo
          </button>
        </div>
      </div>

      {/* Teams Management */}
      <div className="teams-management">
        <h3>Gestión de Equipos</h3>
        <button 
          className="teams-btn"
          onClick={openTeamsDialog}
        >
          Administrar Equipos
        </button>
        <div className="teams-summary">
          <div className="team-count">
            Equipos activos: {currentGame.teamCount}
          </div>
          <div className="players-count">
            Jugadores: {currentGame.activeConnections}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocationInfo