import { ref, watch, onUnmounted, type Ref } from 'vue'
import type { Game, Player, TeamColor } from '../types'
import * as L from 'leaflet'

interface UsePlayerMarkersProps {
  game: Ref<Game | null>
  map: Ref<L.Map | null>
  currentUser: Ref<any>
  socket: any
  isOwner: boolean
}

export const usePlayerMarkers = ({ game, map, currentUser, socket, isOwner }: UsePlayerMarkersProps) => {
  
  const playerMarkers = ref<Map<number, L.Marker>>(new Map())
  const userMarker = ref<L.Marker | null>(null)
  const playerMarkersRef = ref<Map<number, L.Marker>>(new Map())

  // Create player marker icon
  const createPlayerMarkerIcon = (team: TeamColor, isUser: boolean = false) => {
    const className = isUser ? 'user-marker' : 'player-marker'

    return L.divIcon({
      className: `${className} ${team}`,
      html: '', // Empty HTML - CSS handles the display
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }

  // Create user marker
  const createUserMarker = (lat: number, lng: number) => {
    if (!map.value) return

    // Remove existing user marker
    if (userMarker.value) {
      map.value.removeLayer(userMarker.value as unknown as L.Layer)
    }

    const currentPlayer = game.value?.players?.find(p => p.user?.id === currentUser.value?.id)
    const team = currentPlayer?.team || 'none'
    
    const icon = createPlayerMarkerIcon(team, true)

    const marker = L.marker([lat, lng], { icon }).addTo(map.value)
    
    // Create popup with custom class for positioning
    const popup = L.popup({
      className: 'user-marker-popup'
    }).setContent('<strong>Tú.</strong>')
    
    marker.bindPopup(popup)
    
    userMarker.value = marker
    return marker
  }

  // Update player markers
  const updatePlayerMarkers = () => {
    if (!map.value || !game.value || !currentUser.value) {
      return
    }

    // Clear ALL existing markers including user's own marker
    playerMarkersRef.value.forEach((marker, playerId) => {
      if (marker) {
        map.value!.removeLayer(marker as unknown as L.Layer)
      }
    })
    playerMarkersRef.value.clear()

    // Check if we have valid game and players data
    if (!game.value.players || !Array.isArray(game.value.players)) {
      return
    }

    // Add markers for all players (will be updated with real positions via WebSocket)
    game.value.players.forEach(player => {
      // Skip if player data is incomplete
      if (!player || !player.user || !player.user.id) {
        return
      }
      
      // All players can see all other players (including themselves)
      // No team-based filtering

      // Don't create initial marker - wait for real GPS position data via WebSocket
      // This prevents markers from appearing at map center before actual positions arrive
    })

    // Only update state if markers actually changed
    const currentMarkers = playerMarkersRef.value
    const shouldUpdate = !playerMarkers.value || playerMarkers.value.size !== currentMarkers.size ||
      Array.from(currentMarkers.entries()).some(([id, marker]) =>
        !playerMarkers.value.has(id) || playerMarkers.value.get(id) !== marker
      )
    
    if (shouldUpdate) {
      playerMarkers.value = new Map(currentMarkers)
    }
  }

  // Update individual player marker with real position data
  const updatePlayerMarker = (positionData: {
    userId: number
    userName: string
    lat: number
    lng: number
    accuracy: number
  }) => {
    const { userId, userName, lat, lng, accuracy } = positionData
    
    
    if (!map.value || !game.value || !currentUser.value) {
      return
    }
    
    // All players can see all other players
    // No team-based filtering

    let marker = playerMarkersRef.value.get(userId)
    const targetPlayer = game.value.players?.find(p => p.user?.id === userId)
    
    
    if (!marker) {
      // Create new marker if it doesn't exist
      const targetIsOwner = game.value.owner && userId === game.value.owner.id
      const team = targetPlayer?.team || 'none'
      const icon = createPlayerMarkerIcon(team, false)
      
      marker = L.marker([lat, lng], { icon }).addTo(map.value)
      playerMarkersRef.value.set(userId, marker)
    } else {
      // Update existing marker position
      marker.setLatLng([lat, lng])
    }
    
    // Store accuracy for popup info only
    (marker as any).accuracy = accuracy
    
    // Update popup with position info
    const targetIsOwner = game.value.owner && userId === game.value.owner.id
    const teamInfo = targetPlayer?.team && targetPlayer.team !== 'none' ? `<br>Equipo: ${targetPlayer.team.toUpperCase()}` : ''
    
    marker.bindPopup(`
      <strong>${userName || 'Jugador'}</strong><br>
      ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
      <small>Precisión: ${Math.round(accuracy)}m</small>
    `)

    // Only update state if markers actually changed
    const currentMarkers = playerMarkersRef.value
    const shouldUpdate = !playerMarkers.value || playerMarkers.value.size !== currentMarkers.size ||
      Array.from(currentMarkers.entries()).some(([id, marker]) =>
        !playerMarkers.value.has(id) || playerMarkers.value.get(id) !== marker
      )
    
    if (shouldUpdate) {
      playerMarkers.value = new Map(currentMarkers)
    }
  }

  // Update user marker team
  const updateUserMarkerTeam = () => {
    if (!userMarker.value || !map.value) return

    const currentPosition = userMarker.value.getLatLng()
    createUserMarker(currentPosition.lat, currentPosition.lng)
  }

  // Update player marker with new team
  const updatePlayerMarkerTeam = (playerId: number, team: TeamColor) => {
    
    // Find the player by playerId to get the userId
    const targetPlayer = game.value?.players?.find(p => p.id === playerId)
    if (!targetPlayer) {
      // Also try to find by userId if playerId doesn't match
      const playerByUserId = game.value?.players?.find(p => p.user?.id === playerId)
      if (!playerByUserId) {
        return
      }
      return updatePlayerMarkerTeamByUserId(playerByUserId.user.id, team)
    }
    
    const userId = targetPlayer?.user?.id
    if (!userId) {
      return
    }

    updatePlayerMarkerTeamByUserId(userId, team)
  }

  // Update player marker with new team by userId
  const updatePlayerMarkerTeamByUserId = (userId: number, team: TeamColor) => {
    const marker = playerMarkersRef.value.get(userId)
    if (marker) {
      // Update the existing marker's icon instead of recreating it
      const newIcon = createPlayerMarkerIcon(team, false)
      marker.setIcon(newIcon)
      
      // Update popup with current info
      const targetPlayer = game.value?.players?.find(p => p.user?.id === userId)
      const targetIsOwner = game.value?.owner && userId === game.value.owner.id
      const teamInfo = team && team !== 'none' ? `<br>Equipo: ${team.toUpperCase()}` : ''
      const currentAccuracy = (marker as any).accuracy || 0
      
      marker.bindPopup(`
        <strong>${targetPlayer?.user?.name || 'Jugador'}</strong><br>
        ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
        <small>Precisión: ${Math.round(currentAccuracy)}m</small>
      `)
      
      // Only update state if the marker actually changed
      // This prevents unnecessary re-renders when only updating icon
      const currentMarkers = playerMarkersRef.value
      const shouldUpdate = !playerMarkers.value || playerMarkers.value.size !== currentMarkers.size ||
        Array.from(currentMarkers.entries()).some(([id, marker]) =>
          !playerMarkers.value.has(id) || playerMarkers.value.get(id) !== marker
        )
      
      if (shouldUpdate) {
        playerMarkers.value = new Map(currentMarkers)
      }
    } else {
      // No existing marker found for this user
    }
  }

  // Listen for WebSocket events
  watch(socket, (newSocket, oldSocket, onCleanup) => {
    if (!newSocket) return

    const handlePositionUpdate = (data: any) => {
      if (data.action === 'positionUpdate' && data.data) {
        // Show all players including themselves
        updatePlayerMarker(data.data)
      }
    }

    // Handle player positions response (for owner view)
    const handlePlayerPositionsResponse = (data: any) => {
      if (data.action === 'playerPositionsResponse' && data.data.positions) {
        data.data.positions.forEach((position: any) => {
          updatePlayerMarker(position)
        })
      }
    }

    // Listen for game updates that might include player team changes
    const handleGameUpdate = (data: any) => {
      if (data.game && data.game.players) {
        // Only update markers if there are significant changes to player data
        // Avoid full updates for minor changes like team colors
        if (data.type === 'playerTeamChanged' || data.type === 'playerJoined' || data.type === 'playerLeft') {
          // For team changes, we handle them separately via playerTeamUpdated events
          // Only do full update for major player changes
          updatePlayerMarkers()
        } else if (!data.type || data.type === 'gameStateChanged') {
          // Full update for game state changes
          updatePlayerMarkers()
        }
        // Skip update for other minor changes to prevent unnecessary re-renders
      }
    }


    // Handle player inactive notifications
    const handlePlayerInactive = (data: any) => {
      if (data.action === 'playerInactive') {
        removePlayerMarker(data.data.userId)
      }
    }

    // Handle player team updates
    const handlePlayerTeamUpdated = (data: any) => {
      if (data.action === 'playerTeamUpdated' && data.data) {
        const { playerId, team } = data.data
        if (playerId && team) {
          updatePlayerMarkerTeam(playerId, team)
        }
      }
    }

    newSocket.on('gameAction', handlePositionUpdate)
    newSocket.on('gameUpdate', handleGameUpdate)
    newSocket.on('gameAction', handlePlayerPositionsResponse)
    newSocket.on('gameAction', handlePlayerInactive)
    newSocket.on('gameAction', handlePlayerTeamUpdated)

    // Clean up socket listeners when composable is destroyed
    onCleanup(() => {
      if (newSocket) {
        newSocket.off('gameAction', handlePositionUpdate)
        newSocket.off('gameUpdate', handleGameUpdate)
        newSocket.off('gameAction', handlePlayerPositionsResponse)
        newSocket.off('gameAction', handlePlayerInactive)
        newSocket.off('gameAction', handlePlayerTeamUpdated)
      }
    })
  }, { immediate: true })

  // Update markers when game changes
  watch([game, currentUser], () => {
    updatePlayerMarkers()
  }, { immediate: true })

  // Remove player marker from map
  const removePlayerMarker = (userId: number) => {
    if (!map.value) return
    
    const marker = playerMarkersRef.value.get(userId)
    if (marker) {
      map.value.removeLayer(marker as unknown as L.Layer)
      playerMarkersRef.value.delete(userId)
      // Only update state if markers actually changed
      const currentMarkers = playerMarkersRef.value
      const shouldUpdate = !playerMarkers.value || playerMarkers.value.size !== currentMarkers.size ||
        Array.from(currentMarkers.entries()).some(([id, marker]) =>
          !playerMarkers.value.has(id) || playerMarkers.value.get(id) !== marker
        )
      
      if (shouldUpdate) {
        playerMarkers.value = new Map(currentMarkers)
      }
    }
  }

  // Update user marker with GPS position
  const updateUserMarkerPosition = (position: { lat: number; lng: number; accuracy: number }) => {
    if (!userMarker.value || !map.value) return
    
    userMarker.value.setLatLng([position.lat, position.lng])
    
    // Update popup with accuracy info
    const popup = L.popup({
      className: 'user-marker-popup'
    }).setContent(`<strong>Tú.</strong><br><small>Precisión: ${Math.round(position.accuracy)}m</small>`)
    
    userMarker.value.bindPopup(popup)
  }

  return {
    playerMarkers: playerMarkersRef,
    userMarker,
    updatePlayerMarkers,
    updatePlayerMarker,
    updateUserMarkerTeam,
    updatePlayerMarkerTeam,
    updatePlayerMarkerTeamByUserId,
    createUserMarker,
    removePlayerMarker,
    updateUserMarkerPosition
  }
}