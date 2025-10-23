import React, { useState, memo } from 'react'
import { Game } from '../../types'
import { useGPS } from '../GPSManager'

interface LocationInfoProps {
  currentGame: Game
  updateGameTime: (timeInSeconds: number) => Promise<void>
  openTeamsDialog: () => void
}

const LocationInfo: React.FC<LocationInfoProps> = ({
  currentGame,
  updateGameTime,
  openTeamsDialog
}) => {
  const { currentPosition } = useGPS();
  const [timeInput, setTimeInput] = useState('')

  const handleUpdateTime = () => {
    const timeInSeconds = parseInt(timeInput) * 60
    if (!isNaN(timeInSeconds) && timeInSeconds > 0) {
      updateGameTime(timeInSeconds)
      setTimeInput('')
    }
  }

  const handleTimeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const timeInSeconds = parseInt(e.target.value)
    updateGameTime(timeInSeconds)
  }

  // Default time value for the select
  const defaultTimeValue = 1200 // 20 minutes

  return (
    <div className="location-info-panel">
      <div>Estado GPS: <span id="gpsStatus">Desconectado</span></div>
      <div>Lat: <span id="currentLat">{currentPosition ? currentPosition.lat.toFixed(6) : '-'}</span></div>
      <div>Lng: <span id="currentLng">{currentPosition ? currentPosition.lng.toFixed(6) : '-'}</span></div>
      <div>Precisión: <span id="accuracy">{currentPosition ? currentPosition.accuracy.toFixed(1) + 'm' : '-'}</span></div>
      
      
      <div style={{ marginTop: '10px' }}>
        <label style={{ color: 'white', fontSize: '12px', display: 'block', marginBottom: '5px' }}>Tiempo:</label>
        <select
          style={{ width: '100%', padding: '5px', borderRadius: '3px', background: '#333', color: 'white', border: '1px solid #666' }}
          onChange={handleTimeSelect}
          defaultValue={defaultTimeValue}
        >
          <option value="20">20 seg (test)</option>
          <option value="300">5 min</option>
          <option value="600">10 min</option>
          <option value="1200">20 min</option>
          <option value="3600">1 hora</option>
          <option value="0">indefinido</option>
        </select>
      </div>
    </div>
  )
}

export default memo(LocationInfo)