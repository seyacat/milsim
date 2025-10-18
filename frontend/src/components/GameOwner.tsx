import React, { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import GameOwnerMap from './GameOwner/GameOwnerMap'
import GameOverlay from './GameOwner/GameOverlay'
import LocationInfo from './GameOwner/LocationInfo'
import ControlPanel from './GameOwner/ControlPanel'
import MapControls from './GameOwner/MapControls'
import PlayersDialog from './GameOwner/PlayersDialog'
import { useGameOwner } from '../hooks/useGameOwner'
import '../styles/game-owner.css'

const GameOwner: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { addToast: originalAddToast } = useToast()
  const [isTeamsDialogOpen, setIsTeamsDialogOpen] = useState(false)
  
  // Create a wrapper that matches the expected type
  const addToast = useCallback((toast: { message: string; type?: string }) => {
    originalAddToast({
      message: toast.message,
      type: toast.type as any
    })
  }, [originalAddToast])

  const handleOpenTeamsDialog = useCallback(() => {
    setIsTeamsDialogOpen(true)
  }, [])

  const handleCloseTeamsDialog = useCallback(() => {
    setIsTeamsDialogOpen(false)
  }, [])
  
  const {
    currentUser,
    currentGame,
    isLoading,
    gpsStatus,
    currentPosition,
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
    playerMarkers
  } = useGameOwner(gameId, navigate, addToast)

  const handleTeamCountChange = useCallback((count: number) => {
    updateTeamCount(count)
  }, [updateTeamCount])

  if (isLoading) {
    return (
      <div className="loading">
        Cargando juego...
      </div>
    )
  }

  if (!currentGame || !currentUser) {
    return (
      <div className="loading">
        Error al cargar el juego
      </div>
    )
  }

  return (
    <div className="game-owner-container">
      {/* Map */}
      <GameOwnerMap
        mapRef={mapRef}
        currentGame={currentGame}
        currentUser={currentUser}
        mapInstanceRef={mapInstanceRef}
        userMarkerRef={userMarkerRef}
        playerMarkersRef={playerMarkersRef}
        controlPointMarkersRef={controlPointMarkersRef}
        handleMapClick={handleMapClick}
        controlPointMarkers={controlPointMarkers}
        positionCircles={positionCircles}
        pieCharts={pieCharts}
        playerMarkers={playerMarkers}
      />

      {/* Game Overlay */}
      <GameOverlay
        currentGame={currentGame}
        currentUser={currentUser}
        gpsStatus={gpsStatus}
        enableGameNameEdit={enableGameNameEdit}
        socket={socket}
      />

      {/* Location Info */}
      <LocationInfo
        currentPosition={currentPosition}
        currentGame={currentGame}
        updateGameTime={async (timeInSeconds: number) => {
          await updateGameTime(timeInSeconds)
        }}
        openTeamsDialog={openTeamsDialog}
      />

      {/* Control Panel */}
      <ControlPanel
        currentGame={currentGame}
        startGame={async () => {
          await startGame()
        }}
        pauseGame={async () => {
          await pauseGame()
        }}
        resumeGame={async () => {
          await resumeGame()
        }}
        endGame={async () => {
          await endGame()
        }}
        restartGame={async () => {
          await restartGame()
        }}
      />

      {/* Map Controls */}
      <MapControls
        goBack={goBack}
        reloadPage={reloadPage}
        centerOnUser={centerOnUser}
        centerOnSite={centerOnSite}
        openTeamsDialog={handleOpenTeamsDialog}
      />

      {/* Players Dialog */}
      <PlayersDialog
        isOpen={isTeamsDialogOpen}
        onClose={handleCloseTeamsDialog}
        players={currentGame.players}
        currentGameId={currentGame.id}
        socket={socket}
        teamCount={currentGame.teamCount}
        onTeamCountChange={handleTeamCountChange}
      />
    </div>
  )
}

export default GameOwner