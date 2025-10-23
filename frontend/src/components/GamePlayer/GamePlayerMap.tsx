import React, { useEffect, memo } from 'react'
import { Game, User } from '../../types'

interface GamePlayerMapProps {
  mapRef: React.RefObject<HTMLDivElement>
  currentGame: Game
  currentUser: User
  mapInstanceRef: React.MutableRefObject<any>
  userMarkerRef: React.MutableRefObject<any>
  playerMarkersRef: React.MutableRefObject<any>
  controlPointMarkersRef: React.MutableRefObject<any>
  controlPointMarkers: Map<number, any>
  positionCircles: Map<number, any>
  pieCharts: Map<number, any>
  currentPosition?: { lat: number; lng: number; accuracy: number } | null
}

const GamePlayerMap: React.FC<GamePlayerMapProps> = ({
  mapRef,
  currentGame,
  currentUser,
  mapInstanceRef,
  userMarkerRef,
  playerMarkersRef,
  controlPointMarkersRef,
  controlPointMarkers,
  positionCircles,
  pieCharts,
  currentPosition
}) => {
  useEffect(() => {
    let isMounted = true

    const initializeMap = async () => {
      try {
        const L = await import('leaflet')
        
        if (!mapRef.current || !isMounted) return
        
        // Initialize map
        mapInstanceRef.current = L.map(mapRef.current, {
          zoomControl: true,
          maxZoom: 22,
          minZoom: 1
        }).setView([0, 0], 13)

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstanceRef.current)

        // Initialize markers collections
        playerMarkersRef.current = {}
        controlPointMarkersRef.current = {}

        // Control points are now handled by the useControlPoints hook
        // The markers are automatically created and managed by the hook

        // Set initial view to a default location if no control points
        if (currentGame.controlPoints.length === 0 || !currentGame.controlPoints.some(cp => cp.latitude && cp.longitude)) {
          mapInstanceRef.current.setView([0, 0], 2)
        }

      } catch (error) {
        console.error('Error initializing map:', error)
      }
    }

    if (mapRef.current && !mapInstanceRef.current) {
      initializeMap()
    }

    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // Empty dependency array to run only once

  // Update user marker when position changes
  useEffect(() => {
    if (!mapInstanceRef.current || !currentPosition) return

    const updateUserMarker = async () => {
      const L = await import('leaflet')
      
      // Find the current player in the game to get the correct team
      const currentPlayer = currentGame?.players?.find(p => p.user?.id === currentUser?.id);
      const teamClass = currentPlayer?.team || currentUser?.team || 'none';
      
      // If marker exists, update its position
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);
        
        // Update icon if team changed
        const currentIcon = userMarkerRef.current.getIcon();
        if (!currentIcon.options.className?.includes(teamClass)) {
          const newIcon = L.divIcon({
            className: `user-marker ${teamClass}`,
            html: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          userMarkerRef.current.setIcon(newIcon);
        }
      } else {
        // Create new marker if it doesn't exist
        userMarkerRef.current = L.marker([currentPosition.lat, currentPosition.lng], {
          icon: L.divIcon({
            className: `user-marker ${teamClass}`,
            html: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(mapInstanceRef.current)
        
        // Create popup with custom class for positioning
        const popup = L.popup({
          className: 'user-marker-popup'
        }).setContent('<strong>Tú.</strong>')
        
        userMarkerRef.current.bindPopup(popup).openPopup()
      }
    }

    updateUserMarker()
  }, [currentPosition, currentGame, currentUser])

  return (
    <div
      ref={mapRef}
      className="map-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1
      }}
    />
  )
}

export default memo(GamePlayerMap)