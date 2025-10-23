import React, { useEffect, memo } from 'react'
import { Game, User } from '../../types'

interface GameOwnerMapProps {
  mapRef: React.RefObject<HTMLDivElement>
  currentGame: Game
  currentUser: User
  mapInstanceRef: React.MutableRefObject<any>
  userMarkerRef: React.MutableRefObject<any>
  playerMarkersRef: React.MutableRefObject<any>
  controlPointMarkersRef: React.MutableRefObject<any>
  handleMapClick: (latlng: { lat: number; lng: number }) => void
  controlPointMarkers: Map<number, any>
  positionCircles: Map<number, any>
  pieCharts: Map<number, any>
  playerMarkers: Map<number, any>
}

const GameOwnerMap: React.FC<GameOwnerMapProps> = ({
  mapRef,
  currentGame,
  currentUser,
  mapInstanceRef,
  userMarkerRef,
  playerMarkersRef,
  controlPointMarkersRef,
  handleMapClick,
  controlPointMarkers,
  positionCircles,
  pieCharts,
  playerMarkers
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

        // Add click handler for creating control points
        mapInstanceRef.current.on('click', (e: any) => {
          handleMapClick(e.latlng)
        })

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

export default memo(GameOwnerMap)