<template>
  <div class="game-owner-container">
    <div class="debug-info player">
      GAME PLAYER COMPONENT LOADED - PLAYER VIEW
    </div>
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
      />

      <!-- Location Info - Bottom Left -->
      <LocationInfoPanel
        :gps-status="gpsStatusFromComposable"
        :current-position="currentPositionFromComposable"
        :default-time-value="300"
        @time-select="handleTimeSelect"
      />

      <!-- Map Controls - Top Right -->
      <MapControlsPanel
        :current-position="currentPositionFromComposable"
        @center-on-user="centerOnUser"
        @center-on-site="centerOnSite"
        @show-results-dialog="showResultsDialog = true"
      />

      <!-- Game Results Dialog -->
      <GameResultsDialog
        :isOpen="showResultsDialog"
        :onClose="() => showResultsDialog = false"
        :currentGame="currentGame"
        :gameId="gameId"
      />

      <!-- Team Selection -->
      <TeamSelection
        v-if="showTeamSelection && currentGame && currentUser && socketRef"
        :currentGame="currentGame"
        :currentUser="currentUser"
        :socket="socketRef"
        :onTeamSelected="hideTeamSelection"
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
import { usePlayerMarkers } from '../composables/usePlayerMarkers'
import { useGPSTracking } from '../composables/useGPSTracking'
import { useBombTimers } from '../composables/useBombTimers'
import GameOverlay from './shared/GameOverlay.vue'
import LocationInfoPanel from './shared/LocationInfoPanel.vue'
import MapControlsPanel from './shared/MapControlsPanel.vue'
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
  destroyMap
} = useMap()

const {
  socketRef,
  connectWebSocket,
  emitGameAction,
  disconnectWebSocket
} = useWebSocket()

// State
const currentUser = ref<User | null>(null)
const currentGame = ref<Game | null>(null)
const isLoading = ref(true)
const showResultsDialog = ref(false)
const showTeamSelection = ref(false)

// Player markers composable - will be initialized after map is ready
const playerMarkersComposable = ref<any>(null)

// GPS tracking for player
const {
  gpsStatus: gpsStatusFromComposable,
  currentPosition: currentPositionFromComposable,
  startGPSTracking,
  stopGPSTracking
} = useGPSTracking(currentGame, socketRef)

// Watch for GPS position changes to update user marker
watch(() => currentPositionFromComposable.value, (position) => {
  if (position && playerMarkersComposable.value) {
    console.log('GamePlayer - updating user marker with GPS position:', position)
    playerMarkersComposable.value.updateUserMarkerPosition(position)
  }
})

const gameId = route.params.gameId as string

// Map event handlers
const onMapClick = async (latlng: { lat: number; lng: number }) => {
  console.log('Player map clicked at:', latlng)
  // Players can't create control points, just show info
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

// Team selection functions
const hideTeamSelection = () => {
  showTeamSelection.value = false
}

const showTeamSelectionManual = () => {
  showTeamSelection.value = true
}

// Time selection handler
const handleTimeSelect = (timeInSeconds: number) => {
  console.log('Time selected:', timeInSeconds)
  // For player, this might not be needed but keeping for consistency
}

// WebSocket callbacks
const onGameUpdate = (game: Game) => {
  console.log('GamePlayer - onGameUpdate called')
  currentGame.value = game
  // Render control points for player view (no edit handlers)
  renderControlPoints(game.controlPoints || [], {})
  // Update player markers if composable is ready
  if (playerMarkersComposable.value) {
    playerMarkersComposable.value.updatePlayerMarkers()
  }
}

const onControlPointCreated = (controlPoint: ControlPoint) => {
  if (currentGame.value) {
    currentGame.value.controlPoints = [...(currentGame.value.controlPoints || []), controlPoint]
    renderControlPoints(currentGame.value.controlPoints, {})
  }
}

const onControlPointUpdated = (controlPoint: ControlPoint) => {
  if (currentGame.value) {
    currentGame.value.controlPoints = (currentGame.value.controlPoints || []).map(cp =>
      cp.id === controlPoint.id ? controlPoint : cp
    )
    renderControlPoints(currentGame.value.controlPoints, {})
  }
}

const onControlPointDeleted = (controlPointId: number) => {
  if (currentGame.value) {
    currentGame.value.controlPoints = (currentGame.value.controlPoints || []).filter(cp =>
      cp.id !== controlPointId
    )
    renderControlPoints(currentGame.value.controlPoints, {})
  }
}

const onJoinSuccess = (user: User) => {
  currentUser.value = user
}

const onError = (error: string) => {
  console.error('WebSocket error:', error)
}

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

// Lifecycle
onMounted(async () => {
  console.log('GamePlayer - onMounted called')
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

    currentUser.value = user
    currentGame.value = game

    // Initialize WebSocket
    console.log('GamePlayer - Initializing WebSocket connection')
    connectWebSocket(parseInt(gameId), {
      onGameUpdate,
      onControlPointCreated,
      onControlPointUpdated,
      onControlPointDeleted,
      onJoinSuccess,
      onError,
      onGameTime: (data: any) => {
        console.log('Game time data received:', data)
      },
      onPlayerPosition: (data: any) => {
        console.log('GamePlayer - Player position received:', data)
        // This callback is handled by usePlayerMarkers composable
      },
      onBombTimeUpdate: (data: any) => {
        console.log('GamePlayer - Bomb time update received:', data)
        handleBombTimeUpdate(data)
      },
      onActiveBombTimers: (data: any) => {
        console.log('GamePlayer - Active bomb timers received:', data)
        handleActiveBombTimers(data)
      },
      onPositionChallengeUpdate: (data: any) => {
        console.log('GamePlayer - Position challenge update received:', data)
        if (data.controlPointId && data.teamPoints) {
          updatePositionChallengePieChart(data.controlPointId, data.teamPoints)
        }
      },
      onControlPointUpdated: (controlPoint: ControlPoint) => {
        console.log('GamePlayer - Control point updated received:', controlPoint)
        if (controlPoint) {
          updateControlPointMarker(controlPoint)
        }
      },
      onControlPointTeamAssigned: (data: any) => {
        console.log('GamePlayer - Control point team assigned received:', data)
        if (data.controlPoint) {
          updateControlPointMarker(data.controlPoint)
        }
      }
    })

    // Initialize map after component is mounted and data is loaded
    await nextTick()
    setTimeout(async () => {
      await initializeMap(onMapClick)
      await setMapView(currentGame.value?.controlPoints || [])
      await renderControlPoints(currentGame.value?.controlPoints || [], {})
      
      // Initialize player markers AFTER map is ready
      console.log('GamePlayer - initializing player markers after map is ready')
      playerMarkersComposable.value = usePlayerMarkers({
        game: currentGame,
        map: mapInstance,
        currentUser,
        socket: socketRef,
        isOwner: false
      })
      
      // Start GPS tracking for player
      console.log('GamePlayer - starting GPS tracking')
      startGPSTracking()
      
      // Setup bomb timer listeners
      if (socketRef.value) {
        setupBombTimerListeners(socketRef.value)
      }
      
      // Request active bomb timers
      if (currentGame.value) {
        requestActiveBombTimers(socketRef.value, currentGame.value.id)
      }
      
      // Update bomb timers after initial markers are rendered
      setTimeout(() => {
        updateAllBombTimerDisplays()
      }, 100)
    }, 100)

  } catch (error) {
    console.error('Error initializing game:', error)
    addToast({ message: 'Error al cargar el juego', type: 'error' })
    router.push('/dashboard')
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  console.log('GamePlayer - onUnmounted called, cleaning up resources')
  
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
  
  console.log('GamePlayer - cleanup completed')
})
</script>

<style scoped>
/* Game Player Styles - Matching Original Design */
.game-player-container {
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