import React, { useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import GamePlayerMap from './GamePlayer/GamePlayerMap'
import GameOverlay from './GamePlayer/GameOverlay'
import LocationInfo from './GamePlayer/LocationInfo'
import MapControls from './GamePlayer/MapControls'
import GameResultsDialog from './GameResultsDialog'
import TeamSelection from './TeamSelection'
import { useGamePlayer } from '../hooks/useGamePlayer'
import { TimerManager } from './TimerManager'
import { GPSManager } from './GPSManager'
import PlayerMarker from './PlayerMarker'
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
  } = useGamePlayer(gameId, navigate, addToast)

  // Timer and GPS functionality is now handled by isolated managers

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
      {/* GPS Manager - Handles GPS tracking independently */}
      <GPSManager currentGame={currentGame} socket={socket}>
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

        {/* Player Marker - Handles user marker updates independently */}
        <PlayerMarker
          mapInstanceRef={mapInstanceRef}
          userMarkerRef={userMarkerRef}
          currentGame={currentGame}
          currentUser={currentUser}
        />

        {/* Timer Manager - Handles all timer functionality independently */}
        <TimerManager currentGame={currentGame} socket={socket}>
          {/* Game Overlay */}
          <GameOverlay
            currentUser={currentUser}
            currentGame={currentGame}
            socket={socket}
          />
        </TimerManager>

        {/* Location Info */}
        <LocationInfo
          currentGame={currentGame}
        />

        {/* Map Controls */}
        <MapControls
          goBack={goBack}
          reloadPage={reloadPage}
          centerOnUser={centerOnUser}
          centerOnSite={centerOnSite}
          openResultsDialog={openGameResultsDialog}
          showTeamSelection={showTeamSelectionManual}
          gameStatus={currentGame?.status}
          mapInstanceRef={mapInstanceRef}
        />
      </GPSManager>

      {/* Game Results Dialog */}
      <GameResultsDialog
        isOpen={isGameResultsDialogOpen}
        onClose={closeGameResultsDialog}
        currentGame={currentGame}
        gameId={gameId}
      />

      {/* Team Selection */}
      {showTeamSelection && currentGame && currentUser && socket && (
        <TeamSelection
          currentGame={currentGame}
          currentUser={currentUser}
          socket={socket}
          onTeamSelected={hideTeamSelection}
        />
      )}
    </div>
  )
}

const arePropsEqual = () => {
  // GamePlayer doesn't receive any props, so it should never re-render
  // All state is managed internally via hooks
  return true;
};

export default React.memo(GamePlayer, arePropsEqual)