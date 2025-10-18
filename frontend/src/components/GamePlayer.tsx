import React, { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import GamePlayerMap from './GamePlayer/GamePlayerMap'
import GameOverlay from './GamePlayer/GameOverlay'
import LocationInfo from './GamePlayer/LocationInfo'
import MapControls from './GamePlayer/MapControls'
import GameResultsDialog from './GameResultsDialog'
import { useGamePlayer } from '../hooks/useGamePlayer'
import '../styles/game-player.css'

const GamePlayer: React.FC = () => {
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
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite,
    controlPointTimes,
    controlPointMarkers,
    positionCircles,
    pieCharts,
    activeBombTimers,
    isGameResultsDialogOpen,
    openGameResultsDialog,
    closeGameResultsDialog
  } = useGamePlayer(gameId, navigate, addToast)

  // Expose active bomb timers globally for popup access
  React.useEffect(() => {
    ;(window as any).activeBombTimers = activeBombTimers;
  }, [activeBombTimers]);

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
      <GamePlayerMap
        mapRef={mapRef}
        currentGame={currentGame}
        currentUser={currentUser}
        mapInstanceRef={mapInstanceRef}
        userMarkerRef={userMarkerRef}
        playerMarkersRef={playerMarkersRef}
        controlPointMarkersRef={controlPointMarkersRef}
        controlPointMarkers={controlPointMarkers}
        positionCircles={positionCircles}
        pieCharts={pieCharts}
      />

      {/* Game Overlay */}
      <GameOverlay
        currentUser={currentUser}
        currentGame={currentGame}
        gpsStatus={gpsStatus}
        socket={socket}
      />

      {/* Location Info */}
      <LocationInfo
        currentPosition={currentPosition}
        currentGame={currentGame}
      />

      {/* Map Controls */}
      <MapControls
        goBack={goBack}
        reloadPage={reloadPage}
        centerOnUser={centerOnUser}
        centerOnSite={centerOnSite}
        openResultsDialog={openGameResultsDialog}
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

export default GamePlayer