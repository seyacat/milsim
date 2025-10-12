import React, { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import GameOwnerMap from './GameOwner/GameOwnerMap'
import GameOverlay from './GameOwner/GameOverlay'
import LocationInfo from './GameOwner/LocationInfo'
import ControlPanel from './GameOwner/ControlPanel'
import MapControls from './GameOwner/MapControls'
import { useGameOwner } from '../hooks/useGameOwner'
import '../styles/game-owner.css'

const GameOwner: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { addToast: originalAddToast } = useToast()
  
  // Create a wrapper that matches the expected type
  const addToast = useCallback((toast: { message: string; type?: string }) => {
    originalAddToast({
      message: toast.message,
      type: toast.type as any
    })
  }, [originalAddToast])
  
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
    pieCharts
  } = useGameOwner(gameId, navigate, addToast)

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
        addTime={addTime}
        updateGameTime={updateGameTime}
        openTeamsDialog={openTeamsDialog}
      />

      {/* Control Panel */}
      <ControlPanel 
        currentGame={currentGame}
        startGame={startGame}
        pauseGame={pauseGame}
        resumeGame={resumeGame}
        endGame={endGame}
        restartGame={restartGame}
        addTime={addTime}
      />

      {/* Map Controls */}
      <MapControls 
        goBack={goBack}
        reloadPage={reloadPage}
        centerOnUser={centerOnUser}
        centerOnSite={centerOnSite}
      />
    </div>
  )
}

export default GameOwner