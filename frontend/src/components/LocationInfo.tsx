import React from 'react'
import { User, Game } from '../types'

interface LocationInfoProps {
  currentUser: User
  currentGame: Game
  gpsStatus: string
  currentPosition: { lat: number; lng: number; accuracy: number } | null
  isOwner: boolean
}

const LocationInfo: React.FC<LocationInfoProps> = ({
  currentUser,
  currentGame,
  gpsStatus,
  currentPosition,
  isOwner
}) => {
  return (
    <div className="location-info">
      <div className="location-header">
        <h3>Información de Ubicación</h3>
      </div>
      
      <div className="location-details">
        <div className="gps-status">
          <span className="label">GPS:</span>
          <span className="value" id="gpsStatus">{gpsStatus}</span>
        </div>
        
        {currentPosition && (
          <>
            <div className="coordinates">
              <span className="label">Lat:</span>
              <span className="value" id="currentLat">
                {currentPosition.lat.toFixed(6)}
              </span>
            </div>
            
            <div className="coordinates">
              <span className="label">Lng:</span>
              <span className="value" id="currentLng">
                {currentPosition.lng.toFixed(6)}
              </span>
            </div>
            
            <div className="accuracy">
              <span className="label">Precisión:</span>
              <span className="value" id="accuracy">
                {Math.round(currentPosition.accuracy)}m
              </span>
            </div>
          </>
        )}
        
        {!isOwner && currentGame.status === 'stopped' && (
          <button className="btn btn-secondary team-selection-btn">
            Seleccionar Equipo
          </button>
        )}
      </div>
    </div>
  )
}

export default LocationInfo