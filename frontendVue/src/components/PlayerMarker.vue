<template>
  <!-- This component doesn't render anything visible, it only manages the user marker -->
</template>

<script setup lang="ts">
import { watch } from 'vue'
import * as L from 'leaflet'
import type { Game, User } from '../types'

interface Props {
  mapInstanceRef: any
  userMarkerRef: any
  currentGame: Game | null
  currentUser: User | null
  currentPosition: { lat: number; lng: number; accuracy: number } | null
}

const props = defineProps<Props>()

// Update user marker when position changes
watch(() => props.currentPosition, (position) => {
  if (!props.mapInstanceRef || !position) return

  // Find the current player in the game to get the correct team
  const currentPlayer = props.currentGame?.players?.find(p => p.user?.id === props.currentUser?.id)
  const teamClass = currentPlayer?.team || props.currentUser?.team || 'none'
  
  // If marker exists, update its position
  if (props.userMarkerRef) {
    props.userMarkerRef.setLatLng([position.lat, position.lng])
    
    // Update icon if team changed
    const currentIcon = props.userMarkerRef.getIcon()
    if (!currentIcon.options.className?.includes(teamClass)) {
      const newIcon = L.divIcon({
        className: `user-marker ${teamClass}`,
        html: '🧍‍♂️',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
      props.userMarkerRef.setIcon(newIcon)
    }
  } else {
    // Create new marker if it doesn't exist
    props.userMarkerRef = L.marker([position.lat, position.lng], {
      icon: L.divIcon({
        className: `user-marker ${teamClass}`,
        html: '🧍‍♂️',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(props.mapInstanceRef)
    
    // Create popup with custom class for positioning
    const popup = L.popup({
      className: 'user-marker-popup'
    }).setContent('<strong>Tú.</strong>')
    
    props.userMarkerRef.bindPopup(popup).openPopup()
  }
})
</script>