import React, { useEffect } from 'react'
import { Game, User } from '../../types'

interface GameOwnerMapProps {
  mapRef: React.RefObject<HTMLDivElement>
  currentGame: Game
  currentUser: User
  mapInstanceRef: React.MutableRefObject<any>
  userMarkerRef: React.MutableRefObject<any>
  playerMarkersRef: React.MutableRefObject<any>
  controlPointMarkersRef: React.MutableRefObject<any>
}

const GameOwnerMap: React.FC<GameOwnerMapProps> = ({
  mapRef,
  currentGame,
  currentUser,
  mapInstanceRef,
  userMarkerRef,
  playerMarkersRef,
  controlPointMarkersRef
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

        // Add control points to map
        currentGame.controlPoints.forEach(controlPoint => {
          // Verificar que las coordenadas sean válidas
          if (controlPoint.lat && controlPoint.lng) {
            const marker = L.marker([controlPoint.lat, controlPoint.lng])
              .addTo(mapInstanceRef.current)
            
            controlPointMarkersRef.current[controlPoint.id] = marker
          }
        })

        // Add click handler for creating control points
        mapInstanceRef.current.on('click', (e: any) => {
          console.log('Map clicked at:', e.latlng)
          // TODO: Implement control point creation
        })

        // Set initial view to a default location if no control points
        if (currentGame.controlPoints.length === 0 || !currentGame.controlPoints.some(cp => cp.lat && cp.lng)) {
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

export default GameOwnerMap