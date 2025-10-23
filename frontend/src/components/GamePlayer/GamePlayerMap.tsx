import React, { useEffect, memo } from 'react'
import { Game, User } from '../../types'
import { useGPS } from '../GPSManager'

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
  pieCharts
}) => {
  const { currentPosition } = useGPS();
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

  // User marker is now handled by the PlayerMarker component

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

const arePropsEqual = (prevProps: GamePlayerMapProps, nextProps: GamePlayerMapProps) => {
  // This component only initializes the map once and doesn't depend on game state changes
  // Only re-render if the map ref or game object reference changes
  return (
    prevProps.mapRef === nextProps.mapRef &&
    prevProps.currentGame === nextProps.currentGame &&
    prevProps.currentUser === nextProps.currentUser
  );
};

export default memo(GamePlayerMap, arePropsEqual)