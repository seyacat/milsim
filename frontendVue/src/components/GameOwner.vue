
<template>
  <div class="game-owner-container">
    <div style="background: yellow; padding: 10px; margin: 10px;">
      GAME OWNER COMPONENT LOADED - CHECKING PLAYER MARKERS
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
        :default-time-value="defaultTimeValue"
        @time-select="updateGameTime"
      />

      <!-- Map Controls - Top Right -->
      <MapControlsPanel
        :current-position="currentPositionFromComposable"
        @center-on-user="centerOnUser"
        @center-on-site="centerOnSite"
        @show-players-dialog="showPlayersDialog = true"
      />

      <!-- Control Panel - Bottom Right -->
      <ControlPanel
        :current-game="currentGame"
        @start-game="startGame"
        @pause-game="pauseGame"
        @end-game="endGame"
        @restart-game="restartGame"
        @resume-game="resumeGame"
      />

      <!-- Players Dialog -->
      <PlayersDialog
        :isOpen="showPlayersDialog"
        :players="currentGame.players || []"
        :currentGameId="currentGame.id"
        :socket="socketRef"
        :teamCount="teamCount"
        @close="showPlayersDialog = false"
        @teamCountChange="updateTeamCount"
      />

      <!-- Control Point Menu -->
      <ControlPointMenu
        v-if="showControlPointMenu"
        :position="controlPointMenuPosition"
        @close="showControlPointMenu = false"
        @createControlPoint="createControlPoint"
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
import { usePlayerMarkers } from '../composables/usePlayerMarkers'
import { useGPSTracking } from '../composables/useGPSTracking'
import GameOverlay from './GameOwner/GameOverlay.vue'
import LocationInfoPanel from './GameOwner/LocationInfoPanel.vue'
import MapControlsPanel from './GameOwner/MapControlsPanel.vue'
import ControlPanel from './GameOwner/ControlPanel.vue'
import PlayersDialog from './GameOwner/PlayersDialog.vue'
import ControlPointMenu from './GameOwner/ControlPointMenu.vue'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'
// Import player marker styles
import '../styles/game-player.css'

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
  showControlPointMenu,
  controlPointMenuPosition,
  createControlPoint,
  handleControlPointUpdate,
  handleControlPointDelete,
  handleAssignTeam,
  handleToggleChallenge,
  handleUpdateChallenge
} = useControlPoints()

const {
  controlPointTimes,
  updateControlPointTimes,
  updateAllTimerDisplays,
  handleGameStateChange,
  stopControlPointTimerInterval
} = useControlPointTimers()

// State
const currentUser = ref<User | null>(null)
const currentGame = ref<Game | null>(null)
const isLoading = ref(true)
const showPlayersDialog = ref(false)
const teamCount = ref(2)
const gpsStatus = ref('Desconectado')
const currentPosition = ref<any>(null)

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
const onMapClick = (latlng: { lat: number; lng: number }) => {
  controlPointMenuPosition.value = latlng
  showControlPointMenu.value = true
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
  createControlPoint(socketRef, currentGame, lat, lng)
}

// WebSocket callbacks
const onGameUpdate = (game: Game) => {
  console.log('GameOwner - onGameUpdate called')
  currentGame.value = game
  handleGameStateChange(game)
  renderControlPoints(game.controlPoints || [], {
    handleControlPointMove,
    handleControlPointUpdate: handleControlPointUpdateWrapper,
    handleControlPointDelete: handleControlPointDeleteWrapper,
    handleAssignTeam: handleAssignTeamWrapper,
    handleTogglePositionChallenge: handleTogglePositionChallengeWrapper,
    handleToggleCodeChallenge: handleToggleCodeChallengeWrapper,
    handleToggleBombChallenge: handleToggleBombChallengeWrapper,
    handleUpdatePositionChallenge: handleUpdatePositionChallengeWrapper,
    handleUpdateCodeChallenge: handleUpdateCodeChallengeWrapper,
    handleUpdateBombChallenge: handleUpdateBombChallengeWrapper
  })
  // Update player markers if composable is ready
  if (playerMarkersComposable.value) {
    playerMarkersComposable.value.updatePlayerMarkers()
  }
  // Update timers after markers are rendered
  setTimeout(() => {
    updateAllTimerDisplays(game)
  }, 100)
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
      handleUpdateBombChallenge: handleUpdateBombChallengeWrapper
    })
    // Update timers after markers are rendered
    setTimeout(() => {
      updateAllTimerDisplays(currentGame.value)
    }, 100)
  }
}

const onControlPointUpdated = (controlPoint: ControlPoint) => {
  if (currentGame.value) {
    currentGame.value.controlPoints = (currentGame.value.controlPoints || []).map(cp =>
      cp.id === controlPoint.id ? controlPoint : cp
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
      handleUpdateBombChallenge: handleUpdateBombChallengeWrapper
    })
    // Update timers after markers are rendered
    setTimeout(() => {
      updateAllTimerDisplays(currentGame.value)
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
      handleUpdateBombChallenge: handleUpdateBombChallengeWrapper
    })
    // Update timers after markers are rendered
    setTimeout(() => {
      updateAllTimerDisplays(currentGame.value)
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

    if (game.owner.id !== user.id) {
      addToast({ message: 'No tienes permisos para ver este juego', type: 'error' })
      router.push('/dashboard')
      return
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
        console.log('Game time data received:', data)
        // Handle control point timer updates from server
        if (data.controlPointTimes && Array.isArray(data.controlPointTimes)) {
          console.log('Control point times received:', data.controlPointTimes)
          updateControlPointTimes(data.controlPointTimes, currentGame.value)
          // Update timers after markers are rendered
          setTimeout(() => {
            updateAllTimerDisplays(currentGame.value)
          }, 100)
        }
      },
      onPlayerPosition: (data: any) => {
        console.log('GameOwner - Player position received:', data)
        // This callback is handled by usePlayerMarkers composable
        // No need to duplicate the logic here
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
        handleUpdateBombChallenge: handleUpdateBombChallengeWrapper
      })
      
      // Initialize player markers AFTER map is ready
      console.log('GameOwner - initializing player markers after map is ready')
      playerMarkersComposable.value = usePlayerMarkers({
        game: currentGame,
        map: mapInstance,
        currentUser,
        socket: socketRef,
        isOwner: true
      })
      
      // Start GPS tracking for owner
      console.log('GameOwner - starting GPS tracking')
      startGPSTracking()
      
      // Update player markers with current game data
      if (playerMarkersComposable.value) {
        playerMarkersComposable.value.updatePlayerMarkers()
      }
      
      // Update timers after initial markers are rendered
      setTimeout(() => {
        updateAllTimerDisplays(currentGame.value)
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
  disconnectWebSocket()
  destroyMap()
  stopGPSTracking()
  
  // Clean up global functions
  delete (window as any).editControlPoint
  delete (window as any).deleteControlPoint
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

<style>
/* Leaflet Popup Styles */
.leaflet-popup-content-wrapper {
  background: black;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  padding: 0;
}

.leaflet-popup-content {
  margin: 0;
  padding: 0;
  min-width: 280px;
  max-width: 320px;
}

.leaflet-popup-tip {
  background: black;
}

/* Control Point Edit Menu Styles */
.control-point-edit-menu {
  min-width: 280px;
  max-width: 320px;
  background: black;
}

.control-point-edit-content {
  padding: 10px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.edit-title {
  margin: 0;
  color: white;
  font-size: 16px;
  font-weight: bold;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #ccc;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.btn-close:hover {
  color: white;
}

.form-group {
  margin-bottom: 12px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #ccc;
  font-weight: bold;
}

.form-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 12px;
  box-sizing: border-box;
  background: #333;
  color: white;
}

.team-buttons {
  display: flex;
  gap: 5px;
  margin-top: 5px;
  flex-wrap: wrap;
}

.challenge-toggle {
  margin-bottom: 8px;
}

.challenge-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #ccc;
}

.challenge-toggle input[type="checkbox"] {
  margin: 0;
}

.action-buttons {
  margin-top: 15px;
  display: flex;
  gap: 5px;
  justify-content: space-between;
}

.btn {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn:hover {
  opacity: 0.8;
}
</style>
