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
      <button className="btn btn-secondary" onClick={goBack} title="Volver al dashboard">←</button>
      <button className="btn btn-secondary" onClick={reloadPage} title="Recargar página">⟳</button>
      <button className="btn btn-secondary" onClick={centerOnUser} title="Centrar en usuario">📍</button>
      <button className="btn btn-secondary" onClick={centerOnSite} title="Centrar en Site">🏠</button>
    </div>
  )
}

export default MapControls