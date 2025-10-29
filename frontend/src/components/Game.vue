
<template>
  <div class="game-owner-container">
    <div v-if="isLoading" class="loading">
      Cargando juego...
    </div>
    <div v-else-if="!currentGame || !currentUser" class="loading">
      Error al cargar el juego
    </div>
    <div v-else class="game-owner-layout">
      <!-- Map -->
      <div class="map-container">
        <div ref="mapRef" class="map"></div>
      </div>

      <!-- Game Overlay - Top Left -->
      <GameOverlay
        v-if="!isPopupOpen"
        :current-user="currentUser"
        :current-game="currentGame"
        :gps-status="gpsStatusFromComposable"
        :is-owner="isOwner"
        @time-select="updateGameTime"
      />

      <!-- Location Info - Bottom Left -->
      <LocationInfoPanel
        v-if="!isPopupOpen"
        :gps-status="gpsStatusFromComposable"
        :current-position="currentPositionFromComposable"
      />

      <!-- Map Controls - Top Right -->
      <MapControlsPanel
        v-if="!isPopupOpen"
        :current-position="currentPositionFromComposable"
        :is-owner="isOwner"
        :current-game="currentGame"
        @center-on-user="centerOnUser"
        @center-on-site="centerOnSite"
        @show-players-dialog="showPlayersDialog = true"
        @show-results-dialog="showResultsDialog = true"
        @show-team-selection="showTeamSelection = true"
      />

      <!-- Control Panel - Bottom Right (Only for Owner) -->
      <ControlPanel
        v-if="isOwner && !isPopupOpen"
        :current-game="currentGame"
        @start-game="startGame"
        @pause-game="pauseGame"
        @end-game="endGame"
        @restart-game="restartGame"
        @resume-game="resumeGame"
      />


      <!-- Team Selection (Only for Players in stopped state) -->
      <TeamSelection
        v-if="!isOwner && showTeamSelection && currentGame?.status === 'stopped' && currentUser && webSocketManager?.socketRef"
        :currentGame="currentGame"
        :currentUser="currentUser"
        :socket="webSocketManager?.socketRef"
        :onTeamSelected="hideTeamSelection"
      />

      <!-- Players Dialog (Only for Owner) -->
      <PlayersDialog
        v-if="isOwner"
        :isOpen="showPlayersDialog"
        :players="currentGame.players || []"
        :currentGameId="currentGame.id"
        :socket="webSocketManager?.socketRef"
        :teamCount="teamCount"
        @close="showPlayersDialog = false"
        @teamCountChange="updateTeamCount"
      />

      <!-- Game Results Dialog -->
      <GameResultsDialog
        :isOpen="showResultsDialog"
        :onClose="() => showResultsDialog = false"
        :currentGame="currentGame"
        :gameId="gameId"
        :isGameInstance="false"
      />

      <!-- WebSocket Manager (invisible component) -->
      <WebSocketManager
        ref="webSocketManager"
        :game-id="gameId"
        :current-game="currentGame"
        :current-user="currentUser"
        :is-owner="isOwner"
        :map-instance="mapInstance"
        :player-markers-composable="playerMarkersComposable"
        :bomb-timers-composable="bombTimersComposable"
        :on-game-update="onGameUpdate"
        :on-control-point-created="onControlPointCreated"
        :on-control-point-updated="onControlPointUpdated"
        :on-control-point-deleted="onControlPointDeleted"
        :on-join-success="onJoinSuccess"
        :on-error="onError"
        :on-team-selection-change="(show) => showTeamSelection = show"
        :on-results-dialog-change="(show) => showResultsDialog = show"
        :on-position-challenge-update="updatePositionChallengePieChart"
        :update-control-point-times="updateControlPointTimes"
        :update-individual-control-point-time="updateIndividualControlPointTime"
        :handle-game-state-change="handleGameStateChange"
        :stop-control-point-timer-interval="stopControlPointTimerInterval"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AuthService } from '../services/auth.js'
import { GameService } from '../services/game.js'
import { User, Game, ControlPoint } from '../types/index.js'
import { useToast } from '../composables/useToast.js'
import { useMap } from '../composables/useMap'
import { useControlPoints } from '../composables/useControlPoints'
import { useControlPointTimers } from '../composables/useControlPointTimers'
import { useBombTimers } from '../composables/useBombTimers'
import { usePlayerMarkers } from '../composables/usePlayerMarkers'
import { useGPSTracking } from '../composables/useGPSTracking'
import GameOverlay from './shared/GameOverlay.vue'
import LocationInfoPanel from './shared/LocationInfoPanel.vue'
import MapControlsPanel from './shared/MapControlsPanel.vue'
import ControlPanel from './Game/ControlPanel.vue'
import PlayersDialog from './Game/PlayersDialog.vue'
import GameResultsDialog from './GameResultsDialog.vue'
import TeamSelection from './TeamSelection.vue'
import WebSocketManager from './WebSocketManager.vue'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'
// Import global styles including player markers
import '../styles/global.css'

const route = useRoute()
const router = useRouter()
const { addToast } = useToast()

// State
const currentUser = ref<User | null>(null)
const currentGame = ref<Game | null>(null)
const isLoading = ref(true)
const showPlayersDialog = ref(false)
const showResultsDialog = ref(false)
const showTeamSelection = ref(false)
const teamCount = ref(2)
const gpsStatus = ref('Desconectado')
const currentPosition = ref<any>(null)
const isOwner = ref(false)
const isDraggingControlPoint = ref(false)
const isPopupOpen = ref(false)

// Composables
const {
  mapInstance,
  mapRef,
  controlPointMarkers,
  initializeMap,
  setMapView,
  centerOnPosition,
  renderControlPoints,
  updateControlPointMarker,
  updatePositionChallengePieChart,
  enableControlPointDrag,
  disableControlPointDrag,
  closePopup,
  updatePopupTimerDisplay,
  destroyMap
} = useMap(currentGame, currentUser)

const {
  createControlPoint,
  handleControlPointUpdate,
  handleControlPointDelete,
  handleAssignTeam,
  handleToggleChallenge,
  handleUpdateChallenge,
  handleActivateBomb,
  handleDeactivateBomb,
  onControlPointCreated: onControlPointCreatedFromComposable,
  onControlPointUpdated: onControlPointUpdatedFromComposable,
  onControlPointDeleted: onControlPointDeletedFromComposable,
  onControlPointTeamAssigned: onControlPointTeamAssignedFromComposable,
  onControlPointTaken: onControlPointTakenFromComposable,
  onBombActivated: onBombActivatedFromComposable,
  onBombDeactivated: onBombDeactivatedFromComposable
} = useControlPoints()

const {
  controlPointTimes,
  updateControlPointTimes,
  updateIndividualControlPointTime,
  updateAllTimerDisplays,
  handleGameStateChange,
  stopControlPointTimerInterval
} = useControlPointTimers(updatePopupTimerDisplay)

// Bomb timers composable - will be initialized after currentGame is available
const bombTimersComposable = ref<any>(null)

// WebSocket manager ref
const webSocketManager = ref<any>(null)


// Player markers composable - will be initialized after map is ready
const playerMarkersComposable = ref<any>(null)

// GPS tracking for owner
const gpsTrackingComposable = useGPSTracking(currentGame, () => webSocketManager.value?.socketRef, (position) => {
  // Callback para actualizar el marcador del jugador local inmediatamente
  if (playerMarkersComposable.value && currentUser.value) {
    playerMarkersComposable.value.updatePlayerMarker({
      userId: currentUser.value.id,
      userName: currentUser.value.name,
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy
    })
  } else {
  }
})
const {
  gpsStatus: gpsStatusFromComposable,
  currentPosition: currentPositionFromComposable,
  startGPSTracking,
  stopGPSTracking
} = gpsTrackingComposable

// Watch for GPS position changes to update player marker
watch(() => currentPositionFromComposable.value, (position) => {
  if (position && playerMarkersComposable.value && currentUser.value) {
    // Update the current user's marker with GPS position
    playerMarkersComposable.value.updatePlayerMarker({
      userId: currentUser.value.id,
      userName: currentUser.value.name,
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy
    })
  }
})

// Watch for changes in currentGame.players to debug team count changes
watch(() => currentGame.value?.players, (players) => {
}, { deep: true })

// Watch for changes in current user's team to update popup button colors
watch(() => {
  // Check multiple sources for user team to ensure reactivity
  const currentPlayer = currentGame.value?.players?.find(p => p.user?.id === currentUser.value?.id)
  const userTeam = currentUser.value?.team
  const playerTeam = currentPlayer?.team
  
  
  // Return the most reliable team value
  return playerTeam || userTeam || 'none'
}, (newTeam, oldTeam) => {
  if (newTeam !== oldTeam) {
    
    // Update global window object for popup creation
    if ((window as any).currentUser) {
      (window as any).currentUser.team = newTeam
    }
    
    // Force update all control point markers to recreate popups with new team colors
    if (currentGame.value?.controlPoints) {
      const handlers = isOwner.value ? {
        handleControlPointMove,
        handleControlPointUpdate: handleControlPointUpdateWrapper,
        handleControlPointDelete: handleControlPointDeleteWrapper,
        handleAssignTeam: handleAssignTeamWrapper,
        handleTogglePositionChallenge: handleTogglePositionChallengeWrapper,
        handleToggleCodeChallenge: handleToggleCodeChallengeWrapper,
        handleToggleBombChallenge: handleToggleBombChallengeWrapper,
        handleUpdatePositionChallenge: handleUpdatePositionChallengeWrapper,
        handleUpdateCodeChallenge: handleUpdateCodeChallengeWrapper,
        handleUpdateBombChallenge: handleUpdateBombChallengeWrapper,
        handleActivateBomb: handleActivateBombWrapper,
        handleDeactivateBomb: handleDeactivateBombWrapper
      } : {}
      
      renderControlPoints(currentGame.value.controlPoints, handlers)
    }
  }
}, { deep: true, immediate: true })

// Watch for changes in currentGame to update defaultTimeValue
watch(() => currentGame.value, (game) => {
  if (game) {
    defaultTimeValue.value = game.totalTime
  }
}, { immediate: true })

const gameId = route.params.gameId as string
const defaultTimeValue = ref<number | null>(null)

// Map event handlers
const onMapClick = async (latlng: { lat: number; lng: number }) => {
  
  if (!mapInstance.value) return
  
  // Si estamos en modo de arrastre, no mostrar el popup
  if (isDraggingControlPoint.value) {
    isDraggingControlPoint.value = false
    return
  }
  
  // Only show "Crear Punto de Control" option if user is the owner
  if (!isOwner.value) {
    // For players, don't show any popup
    return
  }
  
  // Create menu content for owner
  const menuContent = `
    <div id="controlPointMenu">
      <div class="control-point-create-container">
        <button onclick="window.createControlPoint(${latlng.lat}, ${latlng.lng})" class="btn-create-control-point">Crear Punto de Control</button>
      </div>
    </div>
  `
  
  // Import Leaflet dynamically and create popup
  const L = await import('leaflet')
  if (!mapInstance.value) return
  
  // Create Leaflet popup that sticks to the map
  const popup = L.popup()
    .setLatLng([latlng.lat, latlng.lng])
    .setContent(menuContent)
    .openOn(mapInstance.value)
  
  // Configure the popup to not auto-close so our map handler can manage it
  popup.options.closeOnClick = false
  popup.options.autoClose = false
  
  // Add global function for the button
  ;(window as any).createControlPoint = (lat: number, lng: number) => {
    createControlPoint(webSocketManager.value?.socketRef, currentGame, lat, lng)
    mapInstance.value?.closePopup()
  }
}

// Navigation functions
const centerOnUser = async () => {
  if (currentPositionFromComposable.value) {
    await centerOnPosition(currentPositionFromComposable.value.lat, currentPositionFromComposable.value.lng, 16)
  }
}

const centerOnSite = async () => {
  if (currentGame.value?.controlPoints?.length) {
    // Find the first control point of type "site"
    const firstSite = currentGame.value.controlPoints.find(cp => cp.type === 'site')
    
    if (firstSite) {
      // Center on the specific site control point
      const lat = typeof firstSite.latitude === 'string' ? parseFloat(firstSite.latitude) : firstSite.latitude
      const lng = typeof firstSite.longitude === 'string' ? parseFloat(firstSite.longitude) : firstSite.longitude
      
      if (!isNaN(lat) && !isNaN(lng)) {
        await centerOnPosition(lat, lng, 16)
        return
      }
    }
    
    // Fallback: center on all control points if no site is found
    await setMapView(currentGame.value.controlPoints)
  }
}

// Game actions
const startGame = () => {
  if (!currentGame.value) return
  webSocketManager.value?.emitAction(currentGame.value.id, 'startGame')
  addToast({ message: 'Juego iniciado', type: 'success' })
}

const pauseGame = () => {
  if (!currentGame.value) return
  webSocketManager.value?.emitAction(currentGame.value.id, 'pauseGame')
  addToast({ message: 'Juego pausado', type: 'success' })
}

const endGame = () => {
  if (!currentGame.value) return
  webSocketManager.value?.emitAction(currentGame.value.id, 'endGame')
  addToast({ message: 'Juego finalizado', type: 'success' })
  // Show results dialog after a short delay to allow server to process results
  setTimeout(() => {
    showResultsDialog.value = true
  }, 1000)
}

const restartGame = () => {
  if (!currentGame.value) return
  webSocketManager.value?.emitAction(currentGame.value.id, 'restartGame')
  addToast({ message: 'Juego reiniciado', type: 'success' })
}

const resumeGame = () => {
  if (!currentGame.value) return
  webSocketManager.value?.emitAction(currentGame.value.id, 'resumeGame')
  addToast({ message: 'Juego reanudado', type: 'success' })
}

const updateGameTime = (timeInSeconds: number) => {
  if (!currentGame.value) return
  webSocketManager.value?.emitAction(currentGame.value.id, 'updateGameTime', { timeInSeconds })
  addToast({ message: 'Tiempo actualizado', type: 'success' })
}

const updateTeamCount = (count: number) => {
  teamCount.value = count
  if (currentGame.value) {
    webSocketManager.value?.emitAction(currentGame.value.id, 'updateTeamCount', { teamCount: count })
  }
}

// Team selection handler
const hideTeamSelection = () => {
  showTeamSelection.value = false
}

// Control point handlers
const handleControlPointMove = (controlPointId: number, markerId: number) => {
  enableControlPointDrag(controlPointId)
  closePopup()
  
  // Set dragging flag to true
  isDraggingControlPoint.value = true
  
  // Add dragend event listener to disable drag after move
  const marker = controlPointMarkers.value.get(controlPointId)
  if (marker) {
    marker.off('dragend') // Remove any existing listeners
    marker.on('dragend', (e) => {
      // Set dragging flag to false after a small delay to ensure the map click event is processed first
      setTimeout(() => {
        isDraggingControlPoint.value = false
      }, 100)
      
      disableControlPointDrag(controlPointId)
      
      // Get new position and update control point
      const newLatLng = marker.getLatLng()
      
      // Update control point position via WebSocket
      if (currentGame.value) {
        webSocketManager.value?.emitAction(currentGame.value.id, 'updateControlPointPosition', {
          controlPointId,
          latitude: newLatLng.lat,
          longitude: newLatLng.lng
        })
        addToast({ message: 'Punto de control movido', type: 'success' })
        
        // Remove the marker from the map after updating position
        // The backend will send a new control point update that will recreate the marker
        if (mapInstance.value && marker) {
          mapInstance.value.removeLayer(marker)
          controlPointMarkers.value.delete(controlPointId)
        }
      }
    })
  }
}

const handleControlPointUpdateWrapper = (controlPointId: number, markerId: number) => {
  
  if (!webSocketManager.value?.socketRef) {
    console.error('WebSocket not connected in handleControlPointUpdateWrapper')
    addToast({ message: 'Error: WebSocket no conectado', type: 'error' })
    return
  }
  
  handleControlPointUpdate(webSocketManager.value?.socketRef, currentGame, controlPointId, mapInstance)
}

const handleControlPointDeleteWrapper = (controlPointId: number, markerId: number) => {
  if (!webSocketManager.value?.socketRef) {
    console.error('WebSocket not connected in handleControlPointDeleteWrapper')
    addToast({ message: 'Error: WebSocket no conectado', type: 'error' })
    return
  }
  
  handleControlPointDelete(webSocketManager.value?.socketRef, currentGame, controlPointId, mapInstance)
}

const handleAssignTeamWrapper = (controlPointId: number, team: string) => {
  handleAssignTeam(webSocketManager.value?.socketRef, currentGame, controlPointId, team)
}

const handleTogglePositionChallengeWrapper = (controlPointId: number) => {
  handleToggleChallenge(webSocketManager.value?.socketRef, currentGame, controlPointId, 'position')
}

const handleToggleCodeChallengeWrapper = (controlPointId: number) => {
  handleToggleChallenge(webSocketManager.value?.socketRef, currentGame, controlPointId, 'code')
}

const handleToggleBombChallengeWrapper = (controlPointId: number) => {
  handleToggleChallenge(webSocketManager.value?.socketRef, currentGame, controlPointId, 'bomb')
}

const handleUpdatePositionChallengeWrapper = (controlPointId: number, radius: number) => {
  handleUpdateChallenge(webSocketManager.value?.socketRef, currentGame, controlPointId, 'position', radius)
}

const handleUpdateCodeChallengeWrapper = (controlPointId: number, code: string) => {
  handleUpdateChallenge(webSocketManager.value?.socketRef, currentGame, controlPointId, 'code', code)
}

const handleUpdateBombChallengeWrapper = (controlPointId: number, time: number) => {
  handleUpdateChallenge(webSocketManager.value?.socketRef, currentGame, controlPointId, 'bomb', time)
}

const createControlPointWrapper = (lat: number, lng: number) => {
  if (!webSocketManager.value?.socketRef) {
    console.error('WebSocket not connected in createControlPointWrapper')
    addToast({ message: 'Error: WebSocket no conectado', type: 'error' })
    return
  }
  
  createControlPoint(webSocketManager.value?.socketRef, currentGame, lat, lng)
}

const handleActivateBombWrapper = (controlPointId: number) => {
  if (!webSocketManager.value?.socketRef) {
    console.error('WebSocket not connected in handleActivateBombWrapper')
    addToast({ message: 'Error: WebSocket no conectado', type: 'error' })
    return
  }
  
  handleActivateBomb(webSocketManager.value?.socketRef, currentGame, controlPointId)
}

const handleDeactivateBombWrapper = (controlPointId: number) => {
  if (!webSocketManager.value?.socketRef) {
    console.error('WebSocket not connected in handleDeactivateBombWrapper')
    addToast({ message: 'Error: WebSocket no conectado', type: 'error' })
    return
  }
  
  handleDeactivateBomb(webSocketManager.value?.socketRef, currentGame, controlPointId)
}

// WebSocket callbacks
const onGameUpdate = (game: Game) => {
  const previousStatus = currentGame.value?.status
  
  // STRONG LOGGING FOR PLAYER DATA
  
  // STRONG LOGGING FOR GAME FINISHED STATE
  if (game.status === 'finished') {
    console.log('[GAME_UPDATE] *** GAME FINISHED DETECTED *** - Showing results dialog for all users')
  }
  
  // Force update the game state to ensure reactivity
  // Always use server values for game state
  currentGame.value = { ...game }
  // handleGameStateChange is now called by WebSocketManager to avoid duplicates
  bombTimersComposable.value?.handleGameStateChange(game)
  
  
  // Force UI update for player controls to ensure pause state is respected
  // This is especially important after restart to ensure the player respects pause state
  if (!isOwner.value && game.status === 'paused') {
    // Force reactivity by reassigning the object
    currentGame.value = { ...currentGame.value }
    
    // Additional check: ensure the timer is stopped when game is paused
    webSocketManager.value?.stopLocalTimer()
    
    // Force a small delay to ensure Vue reactivity updates the UI
    setTimeout(() => {
      if (currentGame.value && currentGame.value.status === 'paused') {
        currentGame.value = { ...currentGame.value }
      }
    }, 100)
  }
  
  // Always render control points when game state changes to ensure markers are properly restored
  // This is especially important when transitioning between paused and running states
  const oldControlPoints = currentGame.value?.controlPoints || []
  const newControlPoints = game.controlPoints || []
  
  
  // Check if control points actually changed (added, removed, or modified)
  const oldIds = new Set(oldControlPoints.map(cp => cp.id))
  const newIds = new Set(newControlPoints.map(cp => cp.id))
  
  const controlPointsChanged =
    oldControlPoints.length !== newControlPoints.length ||
    Array.from(oldIds).some(id => !newIds.has(id)) ||
    Array.from(newIds).some(id => !oldIds.has(id))
  
  // Always render control points when game state changes or control points change
  // This ensures markers are properly restored after state transitions
  const shouldRenderControlPoints =
    controlPointsChanged ||
    currentGame.value?.status !== game.status
  
  
  if (shouldRenderControlPoints) {
    // Only pass handlers for owners, players should get empty handlers
    const handlers = isOwner.value ? {
      handleControlPointMove,
      handleControlPointUpdate: handleControlPointUpdateWrapper,
      handleControlPointDelete: handleControlPointDeleteWrapper,
      handleAssignTeam: handleAssignTeamWrapper,
      handleTogglePositionChallenge: handleTogglePositionChallengeWrapper,
      handleToggleCodeChallenge: handleToggleCodeChallengeWrapper,
      handleToggleBombChallenge: handleToggleBombChallengeWrapper,
      handleUpdatePositionChallenge: handleUpdatePositionChallengeWrapper,
      handleUpdateCodeChallenge: handleUpdateCodeChallengeWrapper,
      handleUpdateBombChallenge: handleUpdateBombChallengeWrapper,
      handleActivateBomb: handleActivateBombWrapper,
      handleDeactivateBomb: handleDeactivateBombWrapper
    } : {}
    
    renderControlPoints(newControlPoints, handlers)
  }
  
  // Player markers are automatically updated by the composable via WebSocket events
  // No need to manually call updatePlayerMarkers() here as it would clear existing markers
  // Timer displays are updated by the local timer interval in useControlPointTimers
  // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
  // Bomb timer displays are updated by the bomb timers composable

  // Show results dialog automatically when game is finished for all users
  if (game.status === 'finished') {
    showResultsDialog.value = true
  }

  // Close results dialog when game transitions from finished to stopped (restart)
  if (previousStatus === 'finished' && game.status === 'stopped') {
    showResultsDialog.value = false
    
    // Clear all bomb timers completely when game transitions from finished to stopped
    bombTimersComposable.value?.clearAllBombTimers()
    
    // Timer displays are updated by the local timer interval in useControlPointTimers
    // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
  }

  // Show team selection when game transitions to stopped state and player doesn't have a team
  if (!isOwner.value && game.status === 'stopped') {
    const currentPlayer = game.players?.find(p => p.user?.id === currentUser.value?.id)
    const hasTeam = currentPlayer?.team && currentPlayer.team !== 'none'
    
    if (!hasTeam) {
      showTeamSelection.value = true
    }
  } else if (game.status !== 'stopped') {
    // Hide team selection when game is not in stopped state
    showTeamSelection.value = false
  }

  // Clear bomb timers when game transitions to stopped state (not from finished)
  if (game.status === 'stopped' && previousStatus !== 'finished') {
    bombTimersComposable.value?.clearAllBombTimers()
  }

  // Close team selection dialog when game transitions from stopped to running
  if (previousStatus === 'stopped' && game.status === 'running') {
    showTeamSelection.value = false
    
    // Ensure all bomb timers are cleared when new game starts
    bombTimersComposable.value?.clearAllBombTimers()
  }
}

const onControlPointCreated = (controlPoint: ControlPoint) => {
  
  if (currentGame.value) {
    // Check if control point already exists to avoid duplicates
    const existingControlPoint = currentGame.value.controlPoints?.find(cp => cp.id === controlPoint.id)
    if (!existingControlPoint) {
      currentGame.value.controlPoints = [...(currentGame.value.controlPoints || []), controlPoint]
      // Only pass handlers for owners, players should get empty handlers
      const handlers = isOwner.value ? {
        handleControlPointMove,
        handleControlPointUpdate: handleControlPointUpdateWrapper,
        handleControlPointDelete: handleControlPointDeleteWrapper,
        handleAssignTeam: handleAssignTeamWrapper,
        handleTogglePositionChallenge: handleTogglePositionChallengeWrapper,
        handleToggleCodeChallenge: handleToggleCodeChallengeWrapper,
        handleToggleBombChallenge: handleToggleBombChallengeWrapper,
        handleUpdatePositionChallenge: handleUpdatePositionChallengeWrapper,
        handleUpdateCodeChallenge: handleUpdateCodeChallengeWrapper,
        handleUpdateBombChallenge: handleUpdateBombChallengeWrapper,
        handleActivateBomb: handleActivateBombWrapper,
        handleDeactivateBomb: handleDeactivateBombWrapper
      } : {}
      
      renderControlPoints(currentGame.value.controlPoints, handlers)
      // Timer displays are updated by the local timer interval in useControlPointTimers
      // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
    }
  }
}

const onControlPointUpdated = (controlPoint: ControlPoint) => {
  
  if (currentGame.value) {
    currentGame.value.controlPoints = (currentGame.value.controlPoints || []).map(cp =>
      cp.id === controlPoint.id ? controlPoint : cp
    )
    // Only pass handlers for owners, players should get empty handlers
    const handlers = isOwner.value ? {
      handleControlPointMove,
      handleControlPointUpdate: handleControlPointUpdateWrapper,
      handleControlPointDelete: handleControlPointDeleteWrapper,
      handleAssignTeam: handleAssignTeamWrapper,
      handleTogglePositionChallenge: handleTogglePositionChallengeWrapper,
      handleToggleCodeChallenge: handleToggleCodeChallengeWrapper,
      handleToggleBombChallenge: handleToggleBombChallengeWrapper,
      handleUpdatePositionChallenge: handleUpdatePositionChallengeWrapper,
      handleUpdateCodeChallenge: handleUpdateCodeChallengeWrapper,
      handleUpdateBombChallenge: handleUpdateBombChallengeWrapper,
      handleActivateBomb: handleActivateBombWrapper,
      handleDeactivateBomb: handleDeactivateBombWrapper
    } : {}
    
    // Update the specific control point marker instead of re-rendering all
    updateControlPointMarker(controlPoint, handlers)
    // Timer displays are updated by the local timer interval in useControlPointTimers
    // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
  }
}

const onControlPointDeleted = (controlPointId: number) => {
  if (currentGame.value) {
    currentGame.value.controlPoints = (currentGame.value.controlPoints || []).filter(cp =>
      cp.id !== controlPointId
    )
    // Only pass handlers for owners, players should get empty handlers
    const handlers = isOwner.value ? {
      handleControlPointMove,
      handleControlPointUpdate: handleControlPointUpdateWrapper,
      handleControlPointDelete: handleControlPointDeleteWrapper,
      handleAssignTeam: handleAssignTeamWrapper,
      handleTogglePositionChallenge: handleTogglePositionChallengeWrapper,
      handleToggleCodeChallenge: handleToggleCodeChallengeWrapper,
      handleToggleBombChallenge: handleToggleBombChallengeWrapper,
      handleUpdatePositionChallenge: handleUpdatePositionChallengeWrapper,
      handleUpdateCodeChallenge: handleUpdateCodeChallengeWrapper,
      handleUpdateBombChallenge: handleUpdateBombChallengeWrapper,
      handleActivateBomb: handleActivateBombWrapper,
      handleDeactivateBomb: handleDeactivateBombWrapper
    } : {}
    
    renderControlPoints(currentGame.value.controlPoints, handlers)
    // Timer displays are updated by the local timer interval in useControlPointTimers
    // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
  }
}

const onJoinSuccess = (user: User) => {
  currentUser.value = user
}

const onError = (error: string) => {
  console.error('WebSocket error:', error)
}

// Global functions for control point popup buttons
const setupGlobalFunctions = () => {
  
  // Check if WebSocketManager is connected
  if (!webSocketManager.value?.socketRef) {
    console.warn('WebSocketManager not connected yet, retrying in 500ms...')
    setTimeout(setupGlobalFunctions, 500)
    return
  }
  
  ;(window as any).socketRef = () => {
    return webSocketManager.value?.socketRef
  }
  
  ;(window as any).createControlPoint = (lat: number, lng: number) => {
    createControlPoint(webSocketManager.value?.socketRef, currentGame, lat, lng)
    if (mapInstance.value) {
      mapInstance.value.closePopup()
    }
  }
  
  ;(window as any).editControlPoint = (controlPointId: number) => {
    addToast({ message: 'Funcionalidad de edición en desarrollo', type: 'info' })
  }
  
  ;(window as any).deleteControlPoint = (controlPointId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este punto de control?')) {
      handleControlPointDeleteWrapper(controlPointId, 0)
    }
  }
  
  // Global function to show team change toast
  ;(window as any).showTeamChangeToast = (message: string) => {
    addToast({ message, type: 'success' })
  }
  ;(window as any).currentGame = currentGame.value
  ;(window as any).emitGameAction = (gameId: number, action: string, data?: any) => {
    webSocketManager.value?.emitAction(gameId, action, data)
  }
  
  // Control point action functions for popupUtils
  ;(window as any).handleControlPointMove = (controlPointId: number, markerId: number) => {
    handleControlPointMove(controlPointId, markerId)
  }
  ;(window as any).handleControlPointUpdate = (controlPointId: number, markerId: number) => {
    handleControlPointUpdateWrapper(controlPointId, markerId)
  }
  ;(window as any).handleControlPointDelete = (controlPointId: number, markerId: number) => {
    handleControlPointDeleteWrapper(controlPointId, markerId)
  }
  ;(window as any).handleAssignTeam = (controlPointId: number, team: string) => {
    handleAssignTeamWrapper(controlPointId, team)
  }
  ;(window as any).handleTogglePositionChallenge = (controlPointId: number) => {
    handleTogglePositionChallengeWrapper(controlPointId)
  }
  ;(window as any).handleToggleCodeChallenge = (controlPointId: number) => {
    handleToggleCodeChallengeWrapper(controlPointId)
  }
  ;(window as any).handleToggleBombChallenge = (controlPointId: number) => {
    handleToggleBombChallengeWrapper(controlPointId)
  }
  ;(window as any).handleUpdatePositionChallenge = (controlPointId: number, radius: number) => {
    handleUpdatePositionChallengeWrapper(controlPointId, radius)
  }
  ;(window as any).handleUpdateCodeChallenge = (controlPointId: number, code: string) => {
    handleUpdateCodeChallengeWrapper(controlPointId, code)
  }
  ;(window as any).handleUpdateBombChallenge = (controlPointId: number, time: number) => {
    handleUpdateBombChallengeWrapper(controlPointId, time)
  }
  ;(window as any).handleActivateBomb = (controlPointId: number) => {
    handleActivateBombWrapper(controlPointId)
  }
  ;(window as any).handleDeactivateBomb = (controlPointId: number) => {
    handleDeactivateBombWrapper(controlPointId)
  }
  
}

// Popup event listeners
const setupPopupListeners = () => {
  if (!mapInstance.value) {
    setTimeout(setupPopupListeners, 500)
    return
  }

  // Listen for popup open events
  mapInstance.value.on('popupopen', () => {
    isPopupOpen.value = true
  })

  // Listen for popup close events
  mapInstance.value.on('popupclose', () => {
    isPopupOpen.value = false
  })
}

// Lifecycle
onMounted(async () => {
  try {
    const user = await AuthService.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!gameId) {
      addToast({ message: 'ID de juego no válido', type: 'error' })
      router.push('/dashboard')
      return
    }

    const game = await GameService.getGame(parseInt(gameId))
    if (!game) {
      addToast({ message: 'Juego no encontrado', type: 'error' })
      router.push('/dashboard')
      return
    }

    // Check if user is owner or player
    isOwner.value = game.owner.id === user.id
    
    // Show team selection for players in stopped state who don't have a team
    if (!isOwner.value) {
      const currentPlayer = game.players?.find(p => p.user?.id === user.id)
      const hasTeam = currentPlayer?.team && currentPlayer.team !== 'none'
      
      // Show team selection if:
      // 1. Game is in stopped state AND player doesn't have a team
      // 2. OR player is not in the players list at all
      if ((game.status === 'stopped' && !hasTeam) || !currentPlayer) {
        showTeamSelection.value = true
      }
    }

    currentUser.value = user
    currentGame.value = game
    teamCount.value = game.teamCount || 2
    defaultTimeValue.value = game.totalTime


    // Initialize map after component is mounted and data is loaded
    await nextTick()
    setTimeout(async () => {
      await initializeMap(onMapClick)
      await setMapView(currentGame.value?.controlPoints || [])
      // Only pass handlers for owners, players should get empty handlers
      const handlers = isOwner.value ? {
        handleControlPointMove,
        handleControlPointUpdate: handleControlPointUpdateWrapper,
        handleControlPointDelete: handleControlPointDeleteWrapper,
        handleAssignTeam: handleAssignTeamWrapper,
        handleTogglePositionChallenge: handleTogglePositionChallengeWrapper,
        handleToggleCodeChallenge: handleToggleCodeChallengeWrapper,
        handleToggleBombChallenge: handleToggleBombChallengeWrapper,
        handleUpdatePositionChallenge: handleUpdatePositionChallengeWrapper,
        handleUpdateCodeChallenge: handleUpdateCodeChallengeWrapper,
        handleUpdateBombChallenge: handleUpdateBombChallengeWrapper,
        handleActivateBomb: handleActivateBombWrapper,
        handleDeactivateBomb: handleDeactivateBombWrapper
      } : {}
      
      await renderControlPoints(currentGame.value?.controlPoints || [], handlers)
      
      // Set global variables for player popup access
      ;(window as any).mapInstance = mapInstance.value
      ;(window as any).currentGame = currentGame.value
      ;(window as any).emitGameAction = (gameId: number, action: string, data?: any) => {
        webSocketManager.value?.emitAction(gameId, action, data)
      }
      
      // Initialize player markers AFTER map is ready
      playerMarkersComposable.value = usePlayerMarkers({
        game: currentGame,
        map: mapInstance,
        currentUser,
        socket: () => webSocketManager.value?.socketRef,
        isOwner: isOwner.value
      })
      
      // Actualizar marcador local después de inicializar player markers
      gpsTrackingComposable.updateLocalMarker()
      
      // Start GPS tracking for owner
      startGPSTracking()
      
      // Player markers are automatically updated by the composable when initialized
      // No need to call updatePlayerMarkers() manually here
      
      // Initialize bomb timers composable after currentGame is available
      bombTimersComposable.value = useBombTimers(currentGame)
      
      // Setup bomb timer listeners
      if (webSocketManager.value?.socketRef) {
        bombTimersComposable.value.setupBombTimerListeners(webSocketManager.value.socketRef)
      }
      
      // Request active bomb timers
      if (currentGame.value) {
        bombTimersComposable.value.requestActiveBombTimers(webSocketManager.value?.socketRef, currentGame.value.id)
      }
      
      // Timer displays are updated by the local timer interval in useControlPointTimers
      // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
    }, 100)

    // Wait for WebSocketManager to connect before setting up global functions
    setTimeout(() => {
      setupGlobalFunctions()
    }, 1000)

    // Set up popup event listeners
    setTimeout(() => {
      setupPopupListeners()
    }, 1500)

  } catch (error) {
    console.error('Error initializing game:', error)
    addToast({ message: 'Error al cargar el juego', type: 'error' })
    router.push('/dashboard')
  } finally {
    isLoading.value = false
  }
})


onUnmounted(() => {
  
  // Stop GPS tracking first
  stopGPSTracking()
  
  // Disconnect WebSocket
  webSocketManager.value?.disconnect()
  
  // Clean up player markers if composable exists
  if (playerMarkersComposable.value) {
    try {
      // Clear player markers from map
      playerMarkersComposable.value.playerMarkers.forEach((marker: any) => {
        if (mapInstance.value && marker) {
          mapInstance.value.removeLayer(marker as unknown as L.Layer)
        }
      })
      playerMarkersComposable.value.playerMarkers.clear()
    } catch (error) {
      console.error('Error cleaning up player markers:', error)
    }
  }
  
  // Clean up bomb timers if composable exists
  if (bombTimersComposable.value) {
    try {
      bombTimersComposable.value.cleanup()
    } catch (error) {
      console.error('Error cleaning up bomb timers:', error)
    }
  }
  
  // Destroy map last
  destroyMap()
  
  // Clean up global functions
  delete (window as any).socketRef
  delete (window as any).createControlPoint
  delete (window as any).editControlPoint
  delete (window as any).deleteControlPoint
  delete (window as any).showTeamChangeToast
  delete (window as any).emitGameAction
  delete (window as any).currentGame
  delete (window as any).handleControlPointMove
  delete (window as any).handleControlPointUpdate
  delete (window as any).handleControlPointDelete
  delete (window as any).handleAssignTeam
  delete (window as any).handleTogglePositionChallenge
  delete (window as any).handleToggleCodeChallenge
  delete (window as any).handleToggleBombChallenge
  delete (window as any).handleUpdatePositionChallenge
  delete (window as any).handleUpdateCodeChallenge
  delete (window as any).handleUpdateBombChallenge
  delete (window as any).handleActivateBomb
  delete (window as any).handleDeactivateBomb
  
})

</script>

<style scoped>
/* Game Owner Styles - Matching Original Design */
.game-owner-container {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

/* Map Container */
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

.map {
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

/* Loading State */
.loading {
  text-align: center;
  color: #ccc;
  font-style: italic;
  padding: 20px;
}
</style>
