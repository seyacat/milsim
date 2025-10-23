import React, { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import GameOwnerMap from './GameOwner/GameOwnerMap'
import GameOverlay from './GameOwner/GameOverlay'
import LocationInfo from './GameOwner/LocationInfo'
import ControlPanel from './GameOwner/ControlPanel'
import MapControls from './GameOwner/MapControls'
import PlayersDialog from './GameOwner/PlayersDialog'
import GameResultsDialog from './GameResultsDialog'
import { useGameOwner } from '../hooks/useGameOwner'
import { TimerManager } from './TimerManager'
import { GPSManager } from './GPSManager'
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
  } = useGameOwner(gameId, navigate, addToast)

  const handleTeamCountChange = useCallback((count: number) => {
    updateTeamCount(count)
  }, [updateTeamCount])

  // Memoize handlers to prevent re-renders
  const memoizedStartGame = useCallback(async () => {
    await startGame()
  }, [startGame])

  const memoizedPauseGame = useCallback(async () => {
    await pauseGame()
  }, [pauseGame])

  const memoizedResumeGame = useCallback(async () => {
    await resumeGame()
  }, [resumeGame])

  const memoizedEndGame = useCallback(async () => {
    await endGame()
  }, [endGame])

  const memoizedRestartGame = useCallback(async () => {
    await restartGame()
  }, [restartGame])

  const memoizedUpdateGameTime = useCallback(async (timeInSeconds: number) => {
    await updateGameTime(timeInSeconds)
  }, [updateGameTime])

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

      {/* GPS Manager - Handles GPS tracking independently */}
      <GPSManager currentGame={currentGame} socket={socket}>
        {/* Timer Manager - Handles all timer functionality independently */}
        <TimerManager currentGame={currentGame} socket={socket}>
          {/* Game Overlay */}
          <GameOverlay
            currentGame={currentGame}
            currentUser={currentUser}
            enableGameNameEdit={enableGameNameEdit}
            socket={socket}
          />

          {/* Location Info */}
          <LocationInfo
            currentGame={currentGame}
            updateGameTime={memoizedUpdateGameTime}
            openTeamsDialog={openTeamsDialog}
          />
        </TimerManager>

        {/* Map Controls */}
        <MapControls
          goBack={goBack}
          reloadPage={reloadPage}
          centerOnUser={centerOnUser}
          centerOnSite={centerOnSite}
          openTeamsDialog={handleOpenTeamsDialog}
          openResultsDialog={openGameResultsDialog}
          mapInstanceRef={mapInstanceRef}
        />
      </GPSManager>

      {/* Control Panel */}
      <ControlPanel
        currentGame={currentGame}
        startGame={memoizedStartGame}
        pauseGame={memoizedPauseGame}
        resumeGame={memoizedResumeGame}
        endGame={memoizedEndGame}
        restartGame={memoizedRestartGame}
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
      {/* Game Results Dialog */}
      <GameResultsDialog
        isOpen={isGameResultsDialogOpen}
        onClose={closeGameResultsDialog}
        currentGame={currentGame}
        gameId={gameId}
      />
    </div>
  )
}

export default React.memo(GameOwner)