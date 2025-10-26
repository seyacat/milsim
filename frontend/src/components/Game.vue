
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

      <!-- Team Selection (Only for Players) -->
      <TeamSelection
        v-if="!isOwner && showTeamSelection && currentGame && currentUser && socketRef"
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
  disconnectWebSocket
} = useWebSocket()

const {
  createControlPoint,
  handleControlPointUpdate,
  handleControlPointDelete,
  handleAssignTeam,
  handleToggleChallenge,
  handleUpdateChallenge,
  handleActivateBomb,
  handleDeactivateBomb
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

// Player markers composable - will be initialized after map is ready
const playerMarkersComposable = ref<any>(null)

// GPS tracking for owner
const {
  gpsStatus: gpsStatusFromComposable,
  currentPosition: currentPositionFromComposable,
  startGPSTracking,
  stopGPSTracking
} = useGPSTracking(currentGame, socketRef)

// Watch for GPS position changes to update user marker
watch(() => currentPositionFromComposable.value, (position) => {
  if (position && playerMarkersComposable.value) {
    console.log('GameOwner - updating user marker with GPS position:', position)
    playerMarkersComposable.value.updateUserMarkerPosition(position)
  }
})

const gameId = route.params.gameId as string
const defaultTimeValue = 1200 // 20 minutes

// Map event handlers
const onMapClick = async (latlng: { lat: number; lng: number }) => {
  console.log('Map clicked at:', latlng)
  
  if (!mapInstance.value) return
  
  // Close any existing popup first
  mapInstance.value.closePopup()
  
  // Create menu content similar to React implementation
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
      // Increment played time
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

const updateLocalTimerFromServer = (data: any) => {
  // Update last time update timestamp
  lastTimeUpdate.value = new Date()
  
  // Update game state with server data
  if (currentGame.value) {
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
  console.log('GameOwner - onGameUpdate called with control points:', game.controlPoints?.length || 0)
  currentGame.value = game
  console.log('Game update - calling handleGameStateChange for status:', game.status)
  handleGameStateChange(game)
  
  // Handle local timer based on game status
  if (game.status === 'running') {
    startLocalTimer()
  } else {
    stopLocalTimer()
  }
  
  // Always render control points when game state changes to ensure markers are properly restored
  // This is especially important when transitioning between paused and running states
  const oldControlPoints = currentGame.value?.controlPoints || []
  const newControlPoints = game.controlPoints || []
  
  console.log('Control points - old:', oldControlPoints.length, 'new:', newControlPoints.length)
  
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
  
  console.log('Should render control points:', shouldRenderControlPoints, 'changed:', controlPointsChanged, 'status changed:', currentGame.value?.status !== game.status)
  
  if (shouldRenderControlPoints) {
    renderControlPoints(newControlPoints, {
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
    })
  }
  
  // Player markers are automatically updated by the composable via WebSocket events
  // No need to manually call updatePlayerMarkers() here as it would clear existing markers
  // Update timers after markers are rendered and game state changes
  // Use currentGame.value instead of game parameter to ensure we have the latest control points
  setTimeout(() => {
    console.log('Game update - updating all timers for game status:', game.status, 'with control points:', currentGame.value?.controlPoints?.length || 0)
    updateAllTimerDisplays(currentGame.value)
    updateAllBombTimerDisplays()
  }, 100)

  // Show results dialog automatically when game is finished for all users
  if (game.status === 'finished') {
    console.log('Game finished, showing results dialog for all users')
    showResultsDialog.value = true
    stopLocalTimer()
  }

  // Show team selection when game transitions to stopped state and player doesn't have a team
  if (!isOwner.value && game.status === 'stopped') {
    const currentPlayer = game.players?.find(p => p.user?.id === currentUser.value?.id)
    const hasTeam = currentPlayer?.team && currentPlayer.team !== 'none'
    
    if (!hasTeam) {
      console.log('Game stopped, showing team selection for player without team')
      showTeamSelection.value = true
    }
  }
}

const onControlPointCreated = (controlPoint: ControlPoint) => {
  if (currentGame.value) {
    currentGame.value.controlPoints = [...(currentGame.value.controlPoints || []), controlPoint]
    renderControlPoints(currentGame.value.controlPoints, {
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
    })
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
    // Update the specific control point marker instead of re-rendering all
    updateControlPointMarker(controlPoint, {
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
    })
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
    renderControlPoints(currentGame.value.controlPoints, {
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
    })
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
}

// Lifecycle
onMounted(async () => {
  console.log('GameOwner - onMounted called')
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
    console.log('GameOwner - Initializing WebSocket connection')
    connectWebSocket(parseInt(gameId), {
      onGameUpdate,
      onControlPointCreated,
      onControlPointUpdated,
      onControlPointDeleted,
      onJoinSuccess,
      onError,
      onGameTime: (data: any) => {
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
      onTimeUpdate: (data: any) => {
        // Handle time updates from server (broadcast every 20 seconds)
        console.log('GameOwner - Time update received:', data)
        
        // Update local timer with server data
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
        console.log('GameOwner - Active bomb timers received:', data)
        handleActiveBombTimers(data)
      },
      onPositionChallengeUpdate: (data: any) => {
        console.log('GameOwner - Position challenge update received:', data)
        if (data.controlPointId && data.teamPoints) {
          updatePositionChallengePieChart(data.controlPointId, data.teamPoints)
        }
      },
      onControlPointUpdated: (controlPoint: ControlPoint) => {
        console.log('GameOwner - Control point updated received:', controlPoint)
        if (controlPoint) {
          updateControlPointMarker(controlPoint, {
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
          })
        }
      },
      onControlPointTeamAssigned: (data: any) => {
        console.log('GameOwner - Control point team assigned received:', data)
        if (data.controlPoint) {
          updateControlPointMarker(data.controlPoint, {
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
          })
        }
      },
      onPlayerTeamUpdated: (data: any) => {
        console.log('GameOwner - Player team updated received:', data)
        if (data && data.team) {
          // Get team name for toast message
          const teamNames: Record<string, string> = {
            'red': 'Rojo',
            'blue': 'Azul',
            'green': 'Verde',
            'yellow': 'Amarillo',
            'none': 'Sin Equipo'
          }
          const teamName = teamNames[data.team] || data.team
          
          // Show toast only if it's the current user
          if (data.userId === currentUser.value?.id) {
            addToast({
              message: `Te has unido al equipo ${teamName}`,
              type: 'success'
            })
          }
          
          // Update the current game players data to reflect the team change
          if (currentGame.value && currentGame.value.players) {
            const playerIndex = currentGame.value.players.findIndex(p => p.id === data.playerId)
            if (playerIndex !== -1) {
              currentGame.value.players[playerIndex].team = data.team
              // Trigger reactivity by reassigning the array
              currentGame.value.players = [...currentGame.value.players]
            }
          }
        }
      }
    })

    // Initialize map after component is mounted and data is loaded
    await nextTick()
    setTimeout(async () => {
      await initializeMap(onMapClick)
      await setMapView(currentGame.value?.controlPoints || [])
      await renderControlPoints(currentGame.value?.controlPoints || [], {
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
      })
      
      // Initialize player markers AFTER map is ready
      console.log('GameOwner - initializing player markers after map is ready')
      playerMarkersComposable.value = usePlayerMarkers({
        game: currentGame,
        map: mapInstance,
        currentUser,
        socket: socketRef,
        isOwner: isOwner.value
      })
      
      // Start GPS tracking for owner
      console.log('GameOwner - starting GPS tracking')
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
    

  } catch (error) {
    console.error('Error initializing game:', error)
    addToast({ message: 'Error al cargar el juego', type: 'error' })
    router.push('/dashboard')
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  console.log('GameOwner - onUnmounted called, cleaning up resources')
  
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
      
      // Remove user marker
      if (playerMarkersComposable.value.userMarker && mapInstance.value) {
        mapInstance.value.removeLayer(playerMarkersComposable.value.userMarker as unknown as L.Layer)
      }
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

