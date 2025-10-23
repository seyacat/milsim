import { createSignal, Show } from 'solid-js'
import { useToast } from '../contexts/ToastContext'
import { useGameOwner } from '../hooks/useGameOwner'
import '../styles/game-owner.css'

interface GameOwnerProps {
  gameId: string
}

export default function GameOwner(props: GameOwnerProps) {
  const { addToast: originalAddToast } = useToast()
  const [isTeamsDialogOpen, setIsTeamsDialogOpen] = createSignal(false)
  
  // Create a wrapper that matches the expected type
  const addToast = (toast: { message: string; type?: string }) => {
    originalAddToast({
      message: toast.message,
      type: toast.type as any
    })
  }

  const handleOpenTeamsDialog = () => {
    setIsTeamsDialogOpen(true)
  }

  const handleCloseTeamsDialog = () => {
    setIsTeamsDialogOpen(false)
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
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    restartGame,
    addTime,
    updateGameTime,
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite,
    openTeamsDialog,
    enableGameNameEdit,
    handleMapClick,
    controlPointMarkers,
    positionCircles,
    pieCharts,
    updateTeamCount,
    playerMarkers,
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog
  } = useGameOwner(props.gameId, addToast)

  const handleTeamCountChange = (count: number) => {
    updateTeamCount(count)
  }

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
    <div class="game-owner-container">
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
          <button onClick={handleOpenTeamsDialog}>Equipos</button>
          <button onClick={openGameResultsDialog}>Resultados</button>
        </div>
      </div>

      {/* Control Panel - To be implemented */}
      <div class="control-panel">
        <button onClick={startGame}>Iniciar</button>
        <button onClick={pauseGame}>Pausar</button>
        <button onClick={resumeGame}>Reanudar</button>
        <button onClick={endGame}>Finalizar</button>
        <button onClick={restartGame}>Reiniciar</button>
        <button onClick={() => addTime(300)}>+5 min</button>
      </div>

      {/* Players Dialog - To be implemented */}
      <Show when={isTeamsDialogOpen()}>
        <div class="players-dialog">
          <h3>Gestión de Equipos</h3>
          <p>Diálogo de equipos en desarrollo</p>
          <button onClick={handleCloseTeamsDialog}>Cerrar</button>
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