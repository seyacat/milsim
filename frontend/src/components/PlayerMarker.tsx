import React, { useEffect, memo } from 'react'
import { useGPS } from './GPSManager'

interface PlayerMarkerProps {
  mapInstanceRef: React.MutableRefObject<any>
  userMarkerRef: React.MutableRefObject<any>
  currentGame: any
  currentUser: any
}

const PlayerMarker: React.FC<PlayerMarkerProps> = memo(({
  mapInstanceRef,
  userMarkerRef,
  currentGame,
  currentUser
}) => {
  const { currentPosition } = useGPS()

  // Update user marker when position changes
  useEffect(() => {
    if (!mapInstanceRef.current || !currentPosition) return

    const updateUserMarker = async () => {
      const L = await import('leaflet')
      
      // Find the current player in the game to get the correct team
      const currentPlayer = currentGame?.players?.find((p: any) => p.user?.id === currentUser?.id);
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
  }, [currentPosition, currentGame, currentUser, mapInstanceRef, userMarkerRef])

  // This component doesn't render anything visible
  return null
})

export default PlayerMarker