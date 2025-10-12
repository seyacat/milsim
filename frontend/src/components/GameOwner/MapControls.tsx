import React from 'react'

interface MapControlsProps {
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
}

const MapControls: React.FC<MapControlsProps> = ({
  goBack,
  reloadPage,
  centerOnUser,
  centerOnSite
}) => {
  return (
    <div className="map-controls-panel">
      <h3>Controles del Mapa</h3>
      
      {/* Navigation Controls */}
      <div className="navigation-controls">
        <h4>Navegación</h4>
        <div className="nav-buttons">
          <button 
            className="nav-btn back-btn"
            onClick={goBack}
          >
            Volver al Dashboard
          </button>
          <button 
            className="nav-btn reload-btn"
            onClick={reloadPage}
          >
            Recargar Página
          </button>
        </div>
      </div>

      {/* Map View Controls */}
      <div className="view-controls">
        <h4>Vista del Mapa</h4>
        <div className="view-buttons">
          <button 
            className="view-btn center-user-btn"
            onClick={centerOnUser}
          >
            Centrar en Mí
          </button>
          <button 
            className="view-btn center-site-btn"
            onClick={centerOnSite}
          >
            Centrar en Sitio
          </button>
        </div>
      </div>

      {/* Map Tools */}
      <div className="map-tools">
        <h4>Herramientas</h4>
        <div className="tool-buttons">
          <button 
            className="tool-btn create-cp-btn"
            onClick={() => console.log('Crear punto de control')}
          >
            Crear Punto de Control
          </button>
          <button 
            className="tool-btn edit-cp-btn"
            onClick={() => console.log('Editar puntos de control')}
          >
            Editar Puntos
          </button>
          <button 
            className="tool-btn clear-markers-btn"
            onClick={() => console.log('Limpiar marcadores')}
          >
            Limpiar Marcadores
          </button>
        </div>
      </div>

      {/* Map Information */}
      <div className="map-info">
        <h4>Información del Mapa</h4>
        <div className="info-items">
          <div className="info-item">
            <span className="info-label">Zoom:</span>
            <span className="info-value">Auto</span>
          </div>
          <div className="info-item">
            <span className="info-label">Tipo:</span>
            <span className="info-value">OpenStreetMap</span>
          </div>
          <div className="info-item">
            <span className="info-label">Estado:</span>
            <span className="info-value">Activo</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h4>Acciones Rápidas</h4>
        <div className="action-buttons">
          <button 
            className="action-btn fullscreen-btn"
            onClick={() => console.log('Pantalla completa')}
          >
            Pantalla Completa
          </button>
          <button 
            className="action-btn screenshot-btn"
            onClick={() => console.log('Capturar pantalla')}
          >
            Capturar Pantalla
          </button>
          <button 
            className="action-btn export-btn"
            onClick={() => console.log('Exportar datos')}
          >
            Exportar Datos
          </button>
        </div>
      </div>
    </div>
  )
}

export default MapControls