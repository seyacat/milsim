import React, { memo } from 'react'
import { User, Game } from '../../types'

interface LocationInfoProps {
  currentPosition?: { lat: number; lng: number; accuracy: number } | null
  currentGame: Game
}

const LocationInfo: React.FC<LocationInfoProps> = ({
  currentPosition,
  currentGame
}) => {
  return (
    <div className="location-info-panel">
      <div className="location-header">
        <h3>Sistema de Posición GPS</h3>
        <div className="gps-status">
          <span className="label">Estado:</span>
          <span className="value" id="gpsStatus">Desconectado</span>
        </div>
      </div>
      
      <div className="location-details">
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
        
      </div>
    </div>
  )
}

export default memo(LocationInfo)