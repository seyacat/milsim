
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
        :current-user="currentUser"
        :current-game="currentGame"
        :gps-status="gpsStatusFromComposable"
        :default-time-value="defaultTimeValue"
        :is-owner="isOwner"
        @time-select="updateGameTime"
      />

      <!-- Location Info - Bottom Left -->
      <LocationInfoPanel
        :gps-status="gpsStatusFromComposable"
        :current-position="currentPositionFromComposable"
      />

      <!-- Map Controls - Top Right -->
      <MapControlsPanel
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
        v-if="isOwner"
        :current-game="currentGame"
        @start-game="startGame"
        @pause-game="pauseGame"
        @end-game="endGame"
        @restart-game="restartGame"
        @resume-game="resumeGame"
      />


      <!-- Team Selection (Only for Players in stopped state) -->
      <TeamSelection
        v-if="!isOwner && showTeamSelection && currentGame?.status === 'stopped' && currentUser && socketRef"
        :currentGame="currentGame"
        :currentUser="currentUser"
        :socket="socketRef"
        :onTeamSelected="hideTeamSelection"
      />

      <!-- Players Dialog (Only for Owner) -->
      <PlayersDialog
        v-if="isOwner"
        :isOpen="showPlayersDialog"
        :players="currentGame.players || []"
        :currentGameId="currentGame.id"
        :socket="socketRef"
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
import {
  ControlPointTakenEvent,
  BombActivatedEvent,
  BombDeactivatedEvent,
  ControlPointTeamAssignedEvent,
  TimeUpdateEvent,
  GameTimeEvent
} from '../types/websocket-events.js'
import { useToast } from '../composables/useToast.js'
import { useMap } from '../composables/useMap'
import { useWebSocket } from '../composables/useWebSocket'
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

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'
// Import global styles including player markers
import '../styles/global.css'

const route = useRoute()
const router = useRouter()
const { addToast } = useToast()

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
  destroyMap
} = useMap()

const {
  socketRef,
  connectWebSocket,
  emitGameAction,
  disconnectWebSocket,
  checkConnection,
  forceReconnect
} = useWebSocket()

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
  updateAllTimerDisplays,
  handleGameStateChange,
  stopControlPointTimerInterval
} = useControlPointTimers()

// Bomb timers composable
const {
  activeBombTimers,
  handleBombTimeUpdate,
  handleActiveBombTimers,
  updateBombTimerDisplay,
  updateAllBombTimerDisplays,
  requestActiveBombTimers,
  setupBombTimerListeners
} = useBombTimers()

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
const localTimerInterval = ref<NodeJS.Timeout | null>(null)
const lastTimeUpdate = ref<Date | null>(null)
const connectionHealthInterval = ref<NodeJS.Timeout | null>(null)

// Player markers composable - will be initialized after map is ready
const playerMarkersComposable = ref<any>(null)

// GPS tracking for owner
const {
  gpsStatus: gpsStatusFromComposable,
  currentPosition: currentPositionFromComposable,
  startGPSTracking,
  stopGPSTracking
} = useGPSTracking(currentGame, socketRef)

// Watch for GPS position changes to update player marker
watch(() => currentPositionFromComposable.value, (position) => {
  if (position && playerMarkersComposable.value && currentUser.value) {
    console.log('GameOwner - updating player marker with GPS position:', position)
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
  console.log('Game.vue - currentGame.players changed:', players?.length || 0, 'players')
}, { deep: true })

const gameId = route.params.gameId as string
const defaultTimeValue = 1200 // 20 minutes

// Map event handlers
const onMapClick = async (latlng: { lat: number; lng: number }) => {
  console.log('Map clicked at:', latlng)
  
  if (!mapInstance.value) return
  
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
    console.log('Creating control point at:', lat, lng)
    createControlPoint(socketRef, currentGame, lat, lng)
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
    await setMapView(currentGame.value.controlPoints)
  }
}

// Game actions
const startGame = () => {
  if (!currentGame.value) return
  emitGameAction(currentGame.value.id, 'startGame')
  addToast({ message: 'Juego iniciado', type: 'success' })
}

const pauseGame = () => {
  if (!currentGame.value) return
  emitGameAction(currentGame.value.id, 'pauseGame')
  addToast({ message: 'Juego pausado', type: 'success' })
}

const endGame = () => {
  if (!currentGame.value) return
  emitGameAction(currentGame.value.id, 'endGame')
  addToast({ message: 'Juego finalizado', type: 'success' })
  // Show results dialog after a short delay to allow server to process results
  setTimeout(() => {
    showResultsDialog.value = true
  }, 1000)
}

const restartGame = () => {
  if (!currentGame.value) return
  emitGameAction(currentGame.value.id, 'restartGame')
  addToast({ message: 'Juego reiniciado', type: 'success' })
}

const resumeGame = () => {
  if (!currentGame.value) return
  emitGameAction(currentGame.value.id, 'resumeGame')
  addToast({ message: 'Juego reanudado', type: 'success' })
}

const updateGameTime = (timeInSeconds: number) => {
  if (!currentGame.value) return
  emitGameAction(currentGame.value.id, 'updateGameTime', { timeInSeconds })
  addToast({ message: 'Tiempo actualizado', type: 'success' })
}

const updateTeamCount = (count: number) => {
  teamCount.value = count
  if (currentGame.value) {
    emitGameAction(currentGame.value.id, 'updateTeamCount', { teamCount: count })
  }
}

// Team selection handler
const hideTeamSelection = () => {
  showTeamSelection.value = false
}

// Local timer functions
const startLocalTimer = () => {
  stopLocalTimer()
  
  localTimerInterval.value = setInterval(() => {
    if (currentGame.value && currentGame.value.status === 'running') {
      // Always increment played time locally by 1 second
      // Server updates will override this value when received
      if (currentGame.value.playedTime !== undefined) {
        currentGame.value.playedTime += 1
      }
      
      // Decrement remaining time if it exists
      if (currentGame.value.remainingTime !== undefined && currentGame.value.remainingTime !== null) {
        currentGame.value.remainingTime = Math.max(0, currentGame.value.remainingTime - 1)
      }
      
      // Force reactivity by reassigning the object
      currentGame.value = { ...currentGame.value }
    }
  }, 1000)
}

const stopLocalTimer = () => {
  if (localTimerInterval.value) {
    clearInterval(localTimerInterval.value)
    localTimerInterval.value = null
  }
}

const updateLocalTimerFromServer = (data: TimeUpdateEvent | GameTimeEvent) => {
  // Update last time update timestamp
  lastTimeUpdate.value = new Date()
  
  // Update game state with server data - ALWAYS use server values directly
  if (currentGame.value) {
    console.log('Game.vue - Updating timer from server:', {
      playedTime: data.playedTime,
      remainingTime: data.remainingTime,
      totalTime: data.totalTime
    })
    
    // Always use server values when provided
    if (data.remainingTime !== undefined) {
      currentGame.value.remainingTime = data.remainingTime
    }
    if (data.totalTime !== undefined) {
      currentGame.value.totalTime = data.totalTime
    }
    if (data.playedTime !== undefined) {
      currentGame.value.playedTime = data.playedTime
    }
    // Force reactivity by reassigning the object
    currentGame.value = { ...currentGame.value }
  }
}

// Control point handlers
const handleControlPointMove = (controlPointId: number, markerId: number) => {
  console.log('Move control point:', controlPointId, markerId)
  enableControlPointDrag(controlPointId)
  closePopup()
  
  // Add dragend event listener to disable drag after move
  const marker = controlPointMarkers.value.get(controlPointId)
  if (marker) {
    marker.off('dragend') // Remove any existing listeners
    marker.on('dragend', () => {
      console.log('Control point drag ended:', controlPointId)
      disableControlPointDrag(controlPointId)
      
      // Get new position and update control point
      const newLatLng = marker.getLatLng()
      console.log('New position:', newLatLng)
      
      // Update control point position via WebSocket
      if (currentGame.value) {
        emitGameAction(currentGame.value.id, 'updateControlPointPosition', {
          controlPointId,
          latitude: newLatLng.lat,
          longitude: newLatLng.lng
        })
        addToast({ message: 'Punto de control movido', type: 'success' })
      }
    })
  }
}

const handleControlPointUpdateWrapper = (controlPointId: number, markerId: number) => {
  handleControlPointUpdate(socketRef, currentGame, controlPointId, mapInstance)
}

const handleControlPointDeleteWrapper = (controlPointId: number, markerId: number) => {
  handleControlPointDelete(socketRef, currentGame, controlPointId, mapInstance)
}

const handleAssignTeamWrapper = (controlPointId: number, team: string) => {
  handleAssignTeam(socketRef, currentGame, controlPointId, team)
}

const handleTogglePositionChallengeWrapper = (controlPointId: number) => {
  handleToggleChallenge(socketRef, currentGame, controlPointId, 'position')
}

const handleToggleCodeChallengeWrapper = (controlPointId: number) => {
  handleToggleChallenge(socketRef, currentGame, controlPointId, 'code')
}

const handleToggleBombChallengeWrapper = (controlPointId: number) => {
  handleToggleChallenge(socketRef, currentGame, controlPointId, 'bomb')
}

const handleUpdatePositionChallengeWrapper = (controlPointId: number, radius: number) => {
  handleUpdateChallenge(socketRef, currentGame, controlPointId, 'position', radius)
}

const handleUpdateCodeChallengeWrapper = (controlPointId: number, code: string) => {
  handleUpdateChallenge(socketRef, currentGame, controlPointId, 'code', code)
}

const handleUpdateBombChallengeWrapper = (controlPointId: number, time: number) => {
  handleUpdateChallenge(socketRef, currentGame, controlPointId, 'bomb', time)
}

const createControlPointWrapper = (lat: number, lng: number) => {
  console.log('Creating control point at:', lat, lng)
  createControlPoint(socketRef, currentGame, lat, lng)
  showControlPointMenu.value = false
}

const handleActivateBombWrapper = (controlPointId: number) => {
  handleActivateBomb(socketRef, currentGame, controlPointId)
}

const handleDeactivateBombWrapper = (controlPointId: number) => {
  handleDeactivateBomb(socketRef, currentGame, controlPointId)
}

// WebSocket callbacks
const onGameUpdate = (game: Game) => {
  const previousStatus = currentGame.value?.status
  console.log('[GAME_UPDATE] Received game update:', {
    previousStatus,
    newStatus: game.status,
    gameId: game.id,
    instanceId: game.instanceId,
    playersCount: game.players?.length || 0,
    controlPointsCount: game.controlPoints?.length || 0,
    playedTime: game.playedTime,
    remainingTime: game.remainingTime
  })
  
  // Force update the game state to ensure reactivity
  // Always use server values for game state
  currentGame.value = { ...game }
  handleGameStateChange(game)
  
  // Handle local timer based on game status
  if (game.status === 'running') {
    console.log('[GAME_UPDATE] Starting local timer for running game')
    startLocalTimer()
  } else {
    console.log('[GAME_UPDATE] Stopping local timer for non-running game, status:', game.status)
    stopLocalTimer()
  }
  
  // Force UI update for player controls to ensure pause state is respected
  // This is especially important after restart to ensure the player respects pause state
  if (!isOwner.value && game.status === 'paused') {
    console.log('[GAME_UPDATE] Player detected pause state, forcing UI update')
    // Force reactivity by reassigning the object
    currentGame.value = { ...currentGame.value }
    
    // Additional check: ensure the timer is stopped when game is paused
    stopLocalTimer()
    
    // Force a small delay to ensure Vue reactivity updates the UI
    setTimeout(() => {
      if (currentGame.value && currentGame.value.status === 'paused') {
        console.log('[GAME_UPDATE] Confirming pause state is still active after delay')
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
  // Update timers after markers are rendered and game state changes
  // Use currentGame.value instead of game parameter to ensure we have the latest control points
  setTimeout(() => {
    updateAllTimerDisplays(currentGame.value)
    updateAllBombTimerDisplays()
  }, 100)

  // Show results dialog automatically when game is finished for all users
  if (game.status === 'finished') {
    console.log('Game finished, showing results dialog for all users')
    showResultsDialog.value = true
    stopLocalTimer()
  }

  // Close results dialog when game transitions from finished to stopped (restart)
  if (previousStatus === 'finished' && game.status === 'stopped') {
    console.log('Game restarted, closing results dialog')
    showResultsDialog.value = false
  }

  // Show team selection when game transitions to stopped state and player doesn't have a team
  if (!isOwner.value && game.status === 'stopped') {
    const currentPlayer = game.players?.find(p => p.user?.id === currentUser.value?.id)
    const hasTeam = currentPlayer?.team && currentPlayer.team !== 'none'
    
    if (!hasTeam) {
      console.log('Game stopped, showing team selection for player without team')
      showTeamSelection.value = true
    }
  } else if (game.status !== 'stopped') {
    // Hide team selection when game is not in stopped state
    showTeamSelection.value = false
  }

  // Close team selection dialog when game transitions from stopped to running
  if (previousStatus === 'stopped' && game.status === 'running') {
    console.log('Game started, closing team selection dialog')
    showTeamSelection.value = false
  }
}

const onControlPointCreated = (controlPoint: ControlPoint) => {
  console.log('onControlPointCreated - Received control point:', controlPoint)
  console.log('onControlPointCreated - Control point coordinates:', {
    id: controlPoint.id,
    name: controlPoint.name,
    latitude: controlPoint.latitude,
    longitude: controlPoint.longitude,
    hasLatitude: 'latitude' in controlPoint,
    hasLongitude: 'longitude' in controlPoint
  })
  
  if (currentGame.value) {
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
    // Update timers after markers are rendered
    setTimeout(() => {
      console.log('Control point created - updating all timers')
      updateAllTimerDisplays(currentGame.value)
      updateAllBombTimerDisplays()
    }, 100)
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
    // Update timers after marker is updated
    setTimeout(() => {
      console.log('Control point updated - updating all timers')
      updateAllTimerDisplays(currentGame.value)
      updateAllBombTimerDisplays()
    }, 100)
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
    // Update timers after markers are rendered
    setTimeout(() => {
      console.log('Control point deleted - updating all timers')
      updateAllTimerDisplays(currentGame.value)
      updateAllBombTimerDisplays()
    }, 100)
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
  ;(window as any).createControlPoint = (lat: number, lng: number) => {
    console.log('Creating control point at:', lat, lng)
    createControlPoint(socketRef, currentGame, lat, lng)
    if (mapInstance.value) {
      mapInstance.value.closePopup()
    }
  }
  
  ;(window as any).editControlPoint = (controlPointId: number) => {
    console.log('Edit control point:', controlPointId)
    addToast({ message: 'Funcionalidad de edición en desarrollo', type: 'info' })
  }
  
  ;(window as any).deleteControlPoint = (controlPointId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este punto de control?')) {
      handleControlPointDeleteWrapper(controlPointId, 0)
    }
  }
  
  // Global function to show team change toast
  ;(window as any).showTeamChangeToast = (message: string) => {
    console.log('Game.vue - showTeamChangeToast called:', message)
    addToast({ message, type: 'success' })
  }
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

    // Initialize WebSocket
    connectWebSocket(parseInt(gameId), {
      onGameUpdate,
      onControlPointCreated,
      onControlPointUpdated,
      onControlPointDeleted,
      onJoinSuccess,
      onError,
      onGameTime: (data: GameTimeEvent) => {
        // Update local timer with server data
        updateLocalTimerFromServer(data)
        
        // Handle control point timer updates from server
        if (data.controlPointTimes && Array.isArray(data.controlPointTimes)) {
          updateControlPointTimes(data.controlPointTimes, currentGame.value)
          // Update timers after markers are rendered
          setTimeout(() => {
            console.log('Game time update - updating all timers')
            updateAllTimerDisplays(currentGame.value)
          }, 100)
        }
      },
      onTimeUpdate: (data: TimeUpdateEvent) => {
        // Handle time updates from server (broadcast every 20 seconds)
        console.log('GameOwner - Time update received:', data)
        
        // Update local timer with server data - ALWAYS use server values
        updateLocalTimerFromServer(data)
        
        // Handle control point timer updates from server
        if (data.controlPointTimes && Array.isArray(data.controlPointTimes)) {
          updateControlPointTimes(data.controlPointTimes, currentGame.value)
          // Update timers after markers are rendered
          setTimeout(() => {
            console.log('Time update - updating all timers')
            updateAllTimerDisplays(currentGame.value)
          }, 100)
        }
      },
      onPlayerPosition: (data: any) => {
        console.log('GameOwner - Player position received:', data)
        // This callback is handled by usePlayerMarkers composable
        // No need to duplicate the logic here
      },
      onBombTimeUpdate: (data: any) => {
        console.log('GameOwner - Bomb time update received:', data)
        handleBombTimeUpdate(data)
      },
      onActiveBombTimers: (data: any) => {
        handleActiveBombTimers(data)
      },
      onPositionChallengeUpdate: (data: any) => {
        if (data.controlPointId && data.teamPoints) {
          updatePositionChallengePieChart(data.controlPointId, data.teamPoints)
        }
      },
      onControlPointUpdated: (controlPoint: ControlPoint) => {
        console.log('GameOwner - Control point updated received:', controlPoint)
        if (controlPoint) {
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
          
          updateControlPointMarker(controlPoint, handlers)
        }
      },
      onControlPointTeamAssigned: (data: ControlPointTeamAssignedEvent) => {
        console.log('DEBUG: Control point team assigned received - full data:', data)
        console.log('DEBUG: Control point team assigned - controlPoint data:', data.controlPoint)
        console.log('DEBUG: Control point team assigned - controlPoint details:', {
          id: data.controlPoint?.id,
          name: data.controlPoint?.name,
          ownedByTeam: data.controlPoint?.ownedByTeam,
          hasCodeChallenge: data.controlPoint?.hasCodeChallenge,
          hasBombChallenge: data.controlPoint?.hasBombChallenge,
          bombStatus: data.controlPoint?.bombStatus,
          isOwner: isOwner.value
        })
        console.log('GameOwner - Control point team assigned received:', data)
        if (data.controlPoint) {
          console.log('GameOwner - Control point team assigned - updating marker for control point:', data.controlPoint.id)
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
          
          updateControlPointMarker(data.controlPoint, handlers)
        } else {
          console.log('GameOwner - Control point team assigned - no controlPoint in data')
        }
      },
      // Add direct listener for playerTeamUpdated events
      onGameAction: (data: any) => {
        console.log('GameOwner - Game action received:', data.action, data)
        if (data.action === 'playerTeamUpdated' && data.data) {
          console.log('GameOwner - Direct gameAction playerTeamUpdated received:', data.data)
        }
      },
      // Handle player team updates
      onPlayerTeamUpdated: (data: any) => {
        console.log('GameOwner - Direct playerTeamUpdated event received:', data)
        // This callback is handled by usePlayerMarkers composable
        // No need to duplicate the logic here
      },
      // Handle control point taken events
      onControlPointTaken: (data: ControlPointTakenEvent) => {
        console.log('DEBUG: Control point taken received - full data:', data)
        console.log('DEBUG: Control point taken received - controlPoint data:', data.controlPoint)
        
        // Extract the actual control point data from the nested structure
        const eventData = data.controlPoint
        const actualControlPoint = eventData?.controlPoint
        
        console.log('DEBUG: Control point taken received:', {
          controlPointId: eventData?.controlPointId,
          userId: eventData?.userId,
          userName: eventData?.userName,
          team: eventData?.team,
          controlPointName: actualControlPoint?.name,
          ownedByTeam: actualControlPoint?.ownedByTeam,
          hasCodeChallenge: actualControlPoint?.hasCodeChallenge,
          hasBombChallenge: actualControlPoint?.hasBombChallenge,
          bombStatus: actualControlPoint?.bombStatus,
          isOwner: isOwner.value
        })
        console.log('GameOwner - Control point taken received:', data)
        console.log('GameOwner - Control point taken - isOwner:', isOwner.value)
        
        if (!actualControlPoint) {
          console.log('GameOwner - Control point taken - no actual controlPoint in data')
          return
        }

        // Convert the control point data to the expected ControlPoint interface with strong typing
        const controlPointData = actualControlPoint
        
        // Validate required fields
        if (!controlPointData.id || !controlPointData.name || !controlPointData.latitude || !controlPointData.longitude) {
          console.error('GameOwner - Invalid control point data received:', controlPointData)
          return
        }

        // Convert team string to TeamColor with validation
        const validTeams: TeamColor[] = ['blue', 'red', 'green', 'yellow', 'none']
        const teamColor: TeamColor | undefined = eventData?.team && validTeams.includes(eventData.team as TeamColor)
          ? eventData.team as TeamColor
          : undefined

        const controlPoint: ControlPoint = {
          id: controlPointData.id,
          name: controlPointData.name,
          description: controlPointData.description || undefined,
          latitude: parseFloat(controlPointData.latitude.toString()),
          longitude: parseFloat(controlPointData.longitude.toString()),
          type: controlPointData.type as 'site' | 'control_point',
          ownedByTeam: teamColor && teamColor !== 'none' ? teamColor : undefined,
          hasBombChallenge: Boolean(controlPointData.hasBombChallenge),
          hasPositionChallenge: Boolean(controlPointData.hasPositionChallenge),
          hasCodeChallenge: Boolean(controlPointData.hasCodeChallenge),
          bombTimer: undefined,
          bombStatus: controlPointData.bombStatus ? {
            isActive: controlPointData.bombStatus.isActive,
            remainingTime: controlPointData.bombStatus.remainingTime || 0,
            totalTime: controlPointData.bombTime || 0,
            activatedByUserId: controlPointData.bombStatus.activatedByUserId,
            activatedByUserName: controlPointData.bombStatus.activatedByUserName,
            activatedByTeam: controlPointData.bombStatus.activatedByTeam
          } : undefined,
          currentTeam: undefined,
          currentHoldTime: undefined,
          displayTime: undefined,
          lastTimeUpdate: undefined,
          minDistance: controlPointData.minDistance || undefined,
          minAccuracy: controlPointData.minAccuracy || undefined,
          code: controlPointData.code || undefined,
          bombTime: controlPointData.bombTime || undefined,
          armedCode: controlPointData.armedCode || undefined,
          disarmedCode: controlPointData.disarmedCode || undefined
        }

        console.log('GameOwner - Control point taken - updating marker for control point:', controlPoint.id)
        
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
        
        console.log('GameOwner - Control point taken - handlers object keys:', Object.keys(handlers))
        updateControlPointMarker(controlPoint, handlers)
      },
      // Handle bomb activated events
      onBombActivated: (data: BombActivatedEvent) => {
        console.log('DEBUG: Bomb activated received - full data:', data)
        console.log('DEBUG: Bomb activated received - controlPoint data:', data.controlPoint)
        console.log('DEBUG: Bomb activated received:', {
          controlPointId: data.controlPointId,
          userId: data.userId,
          userName: data.userName,
          controlPointName: data.controlPoint?.name,
          ownedByTeam: data.controlPoint?.ownedByTeam,
          hasCodeChallenge: data.controlPoint?.hasCodeChallenge,
          hasBombChallenge: data.controlPoint?.hasBombChallenge,
          bombStatus: data.controlPoint?.bombStatus,
          isOwner: isOwner.value
        })
        console.log('GameOwner - Bomb activated received:', data)
        console.log('GameOwner - Bomb activated - isOwner:', isOwner.value)
        
        // Find the control point in the current game
        const controlPointData = currentGame.value?.controlPoints?.find(cp => cp.id === data.controlPointId)
        
        if (!controlPointData) {
          console.log('GameOwner - Bomb activated - control point not found:', data.controlPointId)
          return
        }

        // Update the control point with bomb activation status
        const controlPoint: ControlPoint = {
          ...controlPointData,
          bombStatus: {
            isActive: true,
            remainingTime: data.controlPoint?.bombStatus?.remainingTime || controlPointData.bombTime || 300,
            totalTime: controlPointData.bombTime || 300,
            activatedByUserId: data.userId,
            activatedByUserName: data.userName,
            activatedByTeam: data.controlPoint?.ownedByTeam || controlPointData.ownedByTeam
          }
        }

        console.log('GameOwner - Bomb activated - updating marker for control point:', controlPoint.id)
        
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
        
        console.log('GameOwner - Bomb activated - handlers object keys:', Object.keys(handlers))
        updateControlPointMarker(controlPoint, handlers)
      },
      // Handle bomb deactivated events
      onBombDeactivated: (data: BombDeactivatedEvent) => {
        console.log('DEBUG: Bomb deactivated received - full data:', data)
        console.log('DEBUG: Bomb deactivated received - controlPoint data:', data.controlPoint)
        console.log('DEBUG: Bomb deactivated received:', {
          controlPointId: data.controlPointId,
          userId: data.userId,
          userName: data.userName,
          controlPointName: data.controlPoint?.name,
          ownedByTeam: data.controlPoint?.ownedByTeam,
          hasCodeChallenge: data.controlPoint?.hasCodeChallenge,
          hasBombChallenge: data.controlPoint?.hasBombChallenge,
          bombStatus: data.controlPoint?.bombStatus,
          isOwner: isOwner.value
        })
        console.log('GameOwner - Bomb deactivated received:', data)
        console.log('GameOwner - Bomb deactivated - isOwner:', isOwner.value)
        
        // Find the control point in the current game
        const controlPointData = currentGame.value?.controlPoints?.find(cp => cp.id === data.controlPointId)
        
        if (!controlPointData) {
          console.log('GameOwner - Bomb deactivated - control point not found:', data.controlPointId)
          return
        }

        // Update the control point with bomb deactivation status
        const controlPoint: ControlPoint = {
          ...controlPointData,
          bombStatus: undefined // Clear bomb status when deactivated
        }

        console.log('GameOwner - Bomb deactivated - updating marker for control point:', controlPoint.id)
        
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
        
        console.log('GameOwner - Bomb deactivated - handlers object keys:', Object.keys(handlers))
        updateControlPointMarker(controlPoint, handlers)
      }
    })

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
      ;(window as any).socketRef = socketRef.value
      ;(window as any).currentGame = currentGame.value
      
      // Initialize player markers AFTER map is ready
      console.log('Game.vue - Initializing usePlayerMarkers with isOwner:', isOwner.value, 'currentUser:', currentUser.value?.id)
      playerMarkersComposable.value = usePlayerMarkers({
        game: currentGame,
        map: mapInstance,
        currentUser,
        socket: socketRef,
        isOwner: isOwner.value
      })
      
      // Start GPS tracking for owner
      startGPSTracking()
      
      // Player markers are automatically updated by the composable when initialized
      // No need to call updatePlayerMarkers() manually here
      
      // Setup bomb timer listeners
      if (socketRef.value) {
        setupBombTimerListeners(socketRef.value)
      }
      
      // Request active bomb timers
      if (currentGame.value) {
        requestActiveBombTimers(socketRef.value, currentGame.value.id)
      }
      
      // Update timers after initial markers are rendered
      setTimeout(() => {
        console.log('Initial setup - updating all timers')
        updateAllTimerDisplays(currentGame.value)
        updateAllBombTimerDisplays()
      }, 100)
    }, 100)

    setupGlobalFunctions()
    
    // Start connection health check
    startConnectionHealthCheck()

  } catch (error) {
    console.error('Error initializing game:', error)
    addToast({ message: 'Error al cargar el juego', type: 'error' })
    router.push('/dashboard')
  } finally {
    isLoading.value = false
  }
})

// Connection health check with enhanced reconnection logic
const startConnectionHealthCheck = () => {
  stopConnectionHealthCheck()
  connectionHealthInterval.value = setInterval(() => {
    if (socketRef.value && !socketRef.value.connected) {
      console.log('Connection health check: WebSocket disconnected, attempting to reconnect...')
      
      // Force a full reconnection instead of just checking
      forceReconnect()
      
      // Also try to refresh the game state after reconnection
      setTimeout(() => {
        if (socketRef.value?.connected && currentGame.value) {
          console.log('Connection health check: Requesting fresh game state after reconnection')
          // Request fresh game state to ensure synchronization
          socketRef.value.emit('getGameState', { gameId: currentGame.value.id })
        }
      }, 2000)
    }
  }, 15000) // Check every 15 seconds
}

const stopConnectionHealthCheck = () => {
  if (connectionHealthInterval.value) {
    clearInterval(connectionHealthInterval.value)
    connectionHealthInterval.value = null
  }
}

onUnmounted(() => {
  console.log('GameOwner - onUnmounted called, cleaning up resources')
  
  // Stop connection health check first
  stopConnectionHealthCheck()
  
  // Stop local timer first
  stopLocalTimer()
  
  // Stop GPS tracking first
  stopGPSTracking()
  
  // Disconnect WebSocket
  disconnectWebSocket()
  
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
  
  // Destroy map last
  destroyMap()
  
  // Clean up global functions
  delete (window as any).createControlPoint
  delete (window as any).editControlPoint
  delete (window as any).deleteControlPoint
  delete (window as any).showTeamChangeToast
  
  console.log('GameOwner - cleanup completed')
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
