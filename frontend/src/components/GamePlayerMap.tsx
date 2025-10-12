import React, { useEffect } from 'react'
import { User, Game } from '../types'
import { useControlPointTimers } from '../hooks/useControlPointTimers'
import { useBombTimers } from '../hooks/useBombTimers'

interface GamePlayerMapProps {
  currentUser: User
  currentGame: Game
  mapRef: React.RefObject<HTMLDivElement>
  mapInstanceRef: React.MutableRefObject<any>
  userMarkerRef: React.MutableRefObject<any>
  playerMarkersRef: React.MutableRefObject<any>
  controlPointMarkersRef: React.MutableRefObject<any>
  gpsStatus: string
  currentPosition: { lat: number; lng: number; accuracy: number } | null
  socket: any
}

const GamePlayerMap: React.FC<GamePlayerMapProps> = ({
  currentUser,
  currentGame,
  mapRef,
  mapInstanceRef,
  userMarkerRef,
  playerMarkersRef,
  controlPointMarkersRef,
  gpsStatus,
  currentPosition,
  socket
}) => {
  // Initialize control point timers
  const { updateControlPointTimerDisplay, updateAllTimerDisplays } = useControlPointTimers(currentGame, socket)
  
  // Initialize bomb timers
  const { updateBombTimerDisplay, updateAllBombTimerDisplays } = useBombTimers(currentGame, socket)

  useEffect(() => {
    // Initialize map when component mounts
    const initializeMap = async () => {
      if (!mapRef.current) return

      try {
        // Dynamically import Leaflet to avoid SSR issues
        const L = await import('leaflet')
        
        // Initialize map
        const map = L.map(mapRef.current, {
          zoomControl: true,
          maxZoom: 22,
          minZoom: 1
        }).setView([0, 0], 13)

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 22,
          minZoom: 1
        }).addTo(map)

        // Add scale control
        L.control.scale().addTo(map)

        // Store map instance
        mapInstanceRef.current = map

        // Initialize player markers
        playerMarkersRef.current = {}

        // Initialize control point markers
        controlPointMarkersRef.current = {}

        // Set initial view to user position if available
        if (currentPosition) {
          map.setView([currentPosition.lat, currentPosition.lng], 16)
        }

        // Load control points
        loadControlPoints(map, currentGame, L)

      } catch (error) {
        console.error('Error initializing map:', error)
      }
    }

    initializeMap()

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [mapRef, mapInstanceRef, playerMarkersRef, controlPointMarkersRef, currentGame, currentPosition])

  const loadControlPoints = (map: any, game: Game, L: any) => {
    if (!game.controlPoints || !Array.isArray(game.controlPoints)) return

    // Clear existing control point markers
    if (controlPointMarkersRef.current) {
      Object.values(controlPointMarkersRef.current).forEach((marker: any) => {
        if (marker && map.hasLayer(marker)) {
          map.removeLayer(marker)
        }
      })
      controlPointMarkersRef.current = {}
    }

    // Add control points to map
    game.controlPoints.forEach(controlPoint => {
      addPlayerControlPointMarker(controlPoint, map, L)
    })
  }

  const addPlayerControlPointMarker = (controlPoint: any, map: any, L: any) => {
    const marker = L.marker([controlPoint.lat, controlPoint.lng], {
      icon: L.divIcon({
        className: `control-point-marker player ${controlPoint.ownedByTeam || 'neutral'}`,
        iconSize: [32, 32],
        html: `
          <div class="control-point-icon">
            <div class="control-point-label">${controlPoint.name}</div>
            <!-- Timer display above marker (dynamically shown/hidden based on ownership) -->
            <div class="control-point-timer"
                 id="timer_${controlPoint.id}"
                 style="display: none; position: absolute; top: -25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: monospace; white-space: nowrap;">
              00:00
            </div>
            <!-- Bomb timer display below marker (dynamically shown/hidden based on bomb status) -->
            <div class="bomb-timer"
                 id="bomb_timer_${controlPoint.id}"
                 style="display: none; position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: rgba(255,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: monospace; white-space: nowrap;">
              00:00
            </div>
            ${controlPoint.hasPositionChallenge ? '<div class="position-challenge-indicator">P</div>' : ''}
            ${controlPoint.hasBombChallenge ? '<div class="bomb-challenge-indicator">B</div>' : ''}
          </div>
        `
      })
    }).addTo(map)

    // Store control point data
    marker.controlPointData = controlPoint

    // Create popup for player view
    const popupContent = createPlayerControlPointPopup(controlPoint)
    marker.bindPopup(popupContent)

    // Store marker reference
    controlPointMarkersRef.current[controlPoint.id] = marker

    // Update timer display for this control point
    updateControlPointTimerDisplay(controlPoint.id)
    
    // Update bomb timer display for this control point
    updateBombTimerDisplay(controlPoint.id)
  }

  const createPlayerControlPointPopup = (controlPoint: any) => {
    const ownedByTeam = controlPoint.ownedByTeam || 'none'
    const teamInfo = ownedByTeam !== 'none' ? `<p>Controlado por: <strong>${ownedByTeam.toUpperCase()}</strong></p>` : '<p>Punto neutral</p>'
    
    const positionChallengeInfo = controlPoint.hasPositionChallenge ? '<p>✅ Desafío de posición activo</p>' : ''
    const bombChallengeInfo = controlPoint.hasBombChallenge ? '<p>💣 Desafío de bomba activo</p>' : ''

    return `
      <div class="control-point-popup player">
        <h3>${controlPoint.name}</h3>
        ${teamInfo}
        ${positionChallengeInfo}
        ${bombChallengeInfo}
        <div class="popup-actions">
          <button class="btn btn-primary" onclick="window.captureControlPoint(${controlPoint.id})">
            Tomar Punto
          </button>
        </div>
      </div>
    `
  }

  return (
    <div className="game-map-container">
      <div ref={mapRef} className="game-map" />
    </div>
  )
}

export default GamePlayerMap