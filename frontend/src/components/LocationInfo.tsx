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
  const getGPSStatusColor = () => {
    if (gpsStatus === 'Activo') return 'status-active';
    if (gpsStatus.includes('Inactivo')) return 'status-inactive';
    if (gpsStatus.includes('Error') || gpsStatus.includes('denegado')) return 'status-error';
    return 'status-connecting';
  };

  return (
    <div className="location-info">
      <div className="location-header">
        <h3>Sistema de Posición GPS</h3>
      </div>
      
      <div className="location-details">
        <div className={`gps-status ${getGPSStatusColor()}`}>
          <span className="label">Estado GPS:</span>
          <span className="value" id="gpsStatus">{gpsStatus}</span>
        </div>
        
        {currentPosition && (
          <>
            <div className="coordinates">
              <span className="label">Latitud:</span>
              <span className="value" id="currentLat">
                {currentPosition.lat.toFixed(6)}
              </span>
            </div>
            
            <div className="coordinates">
              <span className="label">Longitud:</span>
              <span className="value" id="currentLng">
                {currentPosition.lng.toFixed(6)}
              </span>
            </div>
            
            <div className="accuracy">
              <span className="label">Precisión:</span>
              <span className="value" id="accuracy">
                {Math.round(currentPosition.accuracy)} metros
              </span>
            </div>

            <div className="tracking-info">
              <div className="info-item">
                <span className="label">Detecciones:</span>
                <span className="value">Cada 10 segundos</span>
              </div>
              <div className="info-item">
                <span className="label">Notificaciones:</span>
                <span className="value">Cada 10 segundos</span>
              </div>
              <div className="info-item">
                <span className="label">Timeout:</span>
                <span className="value">3 minutos sin detecciones</span>
              </div>
            </div>
          </>
        )}
        
        {!currentPosition && (
          <div className="no-position">
            <p>Esperando datos de GPS...</p>
            <p className="help-text">
              Asegúrate de que el GPS esté activado y tengas permisos de ubicación.
            </p>
          </div>
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