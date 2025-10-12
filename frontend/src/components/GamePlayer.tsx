import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGamePlayer } from '../hooks/useGamePlayer'
import { useToast } from '../hooks/useToast'
import GamePlayerMap from './GamePlayerMap'
import GameOverlay from './GameOverlay'
import LocationInfo from './LocationInfo'
import MapControls from './MapControls'

const GamePlayer: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

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
    goBack,
    reloadPage,
    centerOnUser,
    centerOnSite
  } = useGamePlayer(gameId, navigate, addToast)

  if (isLoading) {
    return (
      <div className="game-player">
        <div className="loading">Cargando juego...</div>
      </div>
    )
  }

  if (!currentUser || !currentGame) {
    return (
      <div className="game-player">
        <div className="error">Error al cargar el juego</div>
      </div>
    )
  }

  return (
    <div className="game-player">
      <div className="game-container">
        <GamePlayerMap
          currentUser={currentUser}
          currentGame={currentGame}
          mapRef={mapRef}
          mapInstanceRef={mapInstanceRef}
          userMarkerRef={userMarkerRef}
          playerMarkersRef={playerMarkersRef}
          controlPointMarkersRef={controlPointMarkersRef}
          gpsStatus={gpsStatus}
          currentPosition={currentPosition}
        />
        
        <GameOverlay
          currentUser={currentUser}
          currentGame={currentGame}
          isOwner={false}
          goBack={goBack}
        />
        
        <LocationInfo
          currentUser={currentUser}
          currentGame={currentGame}
          gpsStatus={gpsStatus}
          currentPosition={currentPosition}
          isOwner={false}
        />
        
        <MapControls
          reloadPage={reloadPage}
          centerOnUser={centerOnUser}
          centerOnSite={centerOnSite}
        />
      </div>
    </div>
  )
}

export default GamePlayer