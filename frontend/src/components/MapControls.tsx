import React from 'react'

interface MapControlsProps {
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
}

const MapControls: React.FC<MapControlsProps> = ({
  reloadPage,
  centerOnUser,
  centerOnSite
}) => {
  return (
    <div className="map-controls">
      <div className="control-group">
        <button 
          className="btn btn-primary control-btn"
          onClick={reloadPage}
          title="Recargar página"
        >
          🔄
        </button>
        
        <button 
          className="btn btn-primary control-btn"
          onClick={centerOnUser}
          title="Centrar en mi ubicación"
        >
          🧭
        </button>
        
        <button 
          className="btn btn-primary control-btn"
          onClick={centerOnSite}
          title="Centrar en sitio principal"
        >
          🏠
        </button>
      </div>
    </div>
  )
}

export default MapControls