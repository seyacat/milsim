import { createSignal, Show } from 'solid-js'
import { useToast } from '../contexts/ToastContext'
import { useGamePlayer } from '../hooks/useGamePlayer'
import '../styles/game-player.css'

interface GamePlayerProps {
  gameId: string
}

export default function GamePlayer(props: GamePlayerProps) {
  const { addToast: originalAddToast } = useToast()
  
  // Create a wrapper that matches the expected type
  const addToast = (toast: { message: string; type?: string }) => {
    originalAddToast({
      message: toast.message,
      type: toast.type as any
    })
  }

  const {
    currentUser,
    currentGame,
    isLoading,
    mapRef,
    mapInstanceRef,
    userMarkerRef,
    playerMarkersRef,
    controlPointMarkersRef,
    socket,
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite,
    controlPointMarkers,
    positionCircles,
    pieCharts,
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog,
    showTeamSelection,
    hideTeamSelection,
    showTeamSelectionManual
  } = useGamePlayer(props.gameId, addToast)

  if (isLoading()) {
    return (
      <div class="loading">
        Cargando juego...
      </div>
    )
  }

  if (!currentGame() || !currentUser()) {
    return (
      <div class="loading">
        Error al cargar el juego
      </div>
    )
  }

  return (
    <div class="game-player-container">
      {/* Map - To be implemented */}
      <div ref={mapRef} class="map-container" />
      
      {/* GPS Manager - To be implemented */}
      <div>
        {/* Player Marker - To be implemented */}
        <div />
        
        {/* Timer Manager - To be implemented */}
        <div>
          {/* Game Overlay - To be implemented */}
          <div class="game-overlay">
            <h3>{currentGame()?.name}</h3>
            <p>Estado: {currentGame()?.status}</p>
            <p>Jugadores: {currentGame()?.activeConnections}</p>
          </div>

          {/* Location Info - To be implemented */}
          <div class="location-info">
            <p>Información de ubicación</p>
          </div>
        </div>

        {/* Map Controls - To be implemented */}
        <div class="map-controls">
          <button onClick={goBack}>Volver</button>
          <button onClick={reloadPage}>Recargar</button>
          <button onClick={centerOnUser}>Centrar en mí</button>
          <button onClick={centerOnSite}>Centrar en sitio</button>
          <button onClick={showTeamSelectionManual}>Cambiar equipo</button>
          <button onClick={openGameResultsDialog}>Resultados</button>
        </div>
      </div>

      {/* Team Selection Dialog - To be implemented */}
      <Show when={showTeamSelection()}>
        <div class="team-selection-dialog">
          <h3>Seleccionar Equipo</h3>
          <p>Diálogo de selección de equipo en desarrollo</p>
          <button onClick={hideTeamSelection}>Cerrar</button>
        </div>
      </Show>

      {/* Game Results Dialog - To be implemented */}
      <Show when={isGameResultsDialogOpen()}>
        <div class="game-results-dialog">
          <h3>Resultados del Juego</h3>
          <p>Diálogo de resultados en desarrollo</p>
          <button onClick={closeGameResultsDialog}>Cerrar</button>
        </div>
      </Show>
    </div>
  )
}