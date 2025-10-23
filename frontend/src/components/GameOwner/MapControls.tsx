import React, { memo } from 'react'

interface MapControlsProps {
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  openTeamsDialog: () => void
  openResultsDialog: () => void
  mapInstanceRef?: React.MutableRefObject<any>
}

const MapControls: React.FC<MapControlsProps> = ({
  goBack,
  reloadPage,
  centerOnUser,
  centerOnSite,
  openTeamsDialog,
  openResultsDialog,
  mapInstanceRef
}) => {
  return (
    <div className="map-controls-panel">
      <button className="btn btn-secondary" onClick={goBack} title="Volver al dashboard">←</button>
      <button className="btn btn-secondary" onClick={reloadPage} title="Recargar página">⟳</button>
      <button
        className="btn btn-secondary"
        onClick={() => {
          if (mapInstanceRef?.current) {
            // For owner, center on a default location or use the existing centerOnUser function
            centerOnUser();
          } else {
            centerOnUser();
          }
        }}
        title="Centrar en usuario"
      >📍</button>
      <button className="btn btn-secondary" onClick={centerOnSite} title="Centrar en Site">🏠</button>
      <button className="btn btn-secondary" onClick={openTeamsDialog} title="Gestionar equipos">👥</button>
      <button className="btn btn-secondary" onClick={openResultsDialog} title="Ver resultados">📊</button>
    </div>
  )
}

export default memo(MapControls)