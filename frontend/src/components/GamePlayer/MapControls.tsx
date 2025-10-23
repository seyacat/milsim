import React, { memo } from 'react'

interface MapControlsProps {
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  openResultsDialog?: () => void
  showTeamSelection?: () => void
  gameStatus?: string
  currentPosition?: { lat: number; lng: number; accuracy: number } | null
  mapInstanceRef?: React.MutableRefObject<any>
}

const MapControls: React.FC<MapControlsProps> = ({
  goBack,
  reloadPage,
  centerOnUser,
  centerOnSite,
  openResultsDialog,
  showTeamSelection,
  gameStatus,
  currentPosition,
  mapInstanceRef
}) => {
  return (
    <div className="map-controls-panel">
      <button className="btn btn-secondary" onClick={goBack} title="Volver al dashboard">←</button>
      <button className="btn btn-secondary" onClick={reloadPage} title="Recargar página">⟳</button>
      <button
        className="btn btn-secondary"
        onClick={() => {
          if (mapInstanceRef?.current && currentPosition) {
            mapInstanceRef.current.setView([currentPosition.lat, currentPosition.lng], 16);
          } else {
            centerOnUser();
          }
        }}
        title="Centrar en usuario"
        disabled={!currentPosition}
      >📍</button>
      <button className="btn btn-secondary" onClick={centerOnSite} title="Centrar en Site">🏠</button>
      {showTeamSelection && gameStatus === 'stopped' && (
        <button className="btn btn-secondary" onClick={showTeamSelection} title="Seleccionar equipo">⚔️</button>
      )}
      {openResultsDialog && (
        <button className="btn btn-secondary" onClick={openResultsDialog} title="Ver resultados">📊</button>
      )}
    </div>
  )
}

export default memo(MapControls)