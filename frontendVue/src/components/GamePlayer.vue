<template>
  <div class="game-player-container">
    <div v-if="isLoading" class="loading">
      Cargando juego...
    </div>

    <div v-else-if="!currentGame || !currentUser" class="loading">
      Error al cargar el juego
    </div>

    <div v-else class="game-content">
      <!-- GPS Manager - Handles GPS tracking independently -->
      <div class="gps-manager">
        <div class="gps-status">
          Estado GPS: {{ gpsStatus }}
        </div>
      </div>

      <!-- Map -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- Player Marker - Handles user marker updates independently -->
      <PlayerMarker
        :mapInstanceRef="mapInstanceRef"
        :userMarkerRef="userMarkerRef"
        :currentGame="currentGame"
        :currentUser="currentUser"
        :currentPosition="currentPosition"
      />

      <!-- Game Overlay -->
      <GameOverlay
        :currentUser="currentUser"
        :currentGame="currentGame"
        :socket="socket"
      />

      <!-- Location Info -->
      <LocationInfo
        :currentGame="currentGame"
      />

      <!-- Map Controls -->
      <MapControls
        :goBack="goBack"
        :reloadPage="reloadPage"
        :centerOnUser="centerOnUser"
        :centerOnSite="centerOnSite"
        :openResultsDialog="openGameResultsDialog"
        :showTeamSelection="showTeamSelectionManual"
        :gameStatus="currentGame?.status"
        :mapInstanceRef="mapInstanceRef"
      />

      <!-- Game Results Dialog -->
      <GameResultsDialog
        :isOpen="isGameResultsDialogOpen"
        :onClose="closeGameResultsDialog"
        :currentGame="currentGame"
        :gameId="gameId"
      />

      <!-- Team Selection -->
      <TeamSelection
        v-if="showTeamSelection && currentGame && currentUser && socket"
        :currentGame="currentGame"
        :currentUser="currentUser"
        :socket="socket"
        :onTeamSelected="hideTeamSelection"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Game } from '../types'
import { useGamePlayer } from '../composables/useGamePlayer'
import { useGPSTracking } from '../composables/useGPSTracking'
import { usePlayerMarkers } from '../composables/usePlayerMarkers'
import { useBombTimers } from '../composables/useBombTimers'
import { useMap } from '../composables/useMap'
import GameOverlay from './GamePlayer/GameOverlay.vue'
import LocationInfo from './GamePlayer/LocationInfo.vue'
import MapControls from './GamePlayer/MapControls.vue'
import GameResultsDialog from './GameResultsDialog.vue'
import TeamSelection from './TeamSelection.vue'
import PlayerMarker from './PlayerMarker.vue'
import '../styles/global.css'
import '../styles/game-player.css'

const route = useRoute()
const router = useRouter()
const gameId = computed(() => route.params.gameId as string)

// Game player logic
const {
  currentUser,
  currentGame,
  isLoading,
  mapRef,
  mapInstanceRef,
  userMarkerRef,
  playerMarkersRef,
  controlPointMarkersRef,
  socket,
  goBack,
  reloadPage,
  centerOnUser,
  centerOnSite,
  controlPointMarkers,
  positionCircles,
  pieCharts,
  isGameResultsDialogOpen,
  openGameResultsDialog,
  closeGameResultsDialog,
  showTeamSelection,
  hideTeamSelection,
  showTeamSelectionManual
} = useGamePlayer(gameId, router)

// GPS tracking
const { gpsStatus, currentPosition, startGPSTracking, stopGPSTracking } = useGPSTracking(
  currentGame,
  socket
)

// Player markers for other players
const {
  playerMarkers,
  updatePlayerMarkers,
  updatePlayerMarker
} = usePlayerMarkers({
  game: currentGame,
  map: mapInstanceRef,
  currentUser,
  socket,
  isOwner: false
})

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

// Map setup
const mapContainer = ref<HTMLElement | null>(null)
const { initializeMap } = useMap()

onMounted(() => {
  console.log('GamePlayer mounted - checking map container and game')
  if (mapContainer.value) {
    console.log('Map container found, initializing map')
    initializeMap(mapContainer.value, currentGame.value)
    
    // Setup bomb timer listeners
    if (socket.value) {
      setupBombTimerListeners(socket.value)
    }
    
    // Request active bomb timers
    if (currentGame.value) {
      requestActiveBombTimers(socket.value, currentGame.value.id)
    }
    
    // Update bomb timers after initial markers are rendered
    setTimeout(() => {
      updateAllBombTimerDisplays()
    }, 100)
  } else {
    console.log('Map container NOT found')
  }
})

onUnmounted(() => {
  console.log('GamePlayer unmounted, stopping GPS')
  stopGPSTracking()
})

// Watch for game and socket changes to start GPS tracking
import { watch } from 'vue'

watch([currentGame, socket], ([game, sock]) => {
  console.log('Game/socket changed:', { hasGame: !!game, hasSocket: !!sock })
  if (game && sock) {
    console.log('Starting GPS tracking...')
    startGPSTracking()
  }
}, { immediate: true })
</script>

<style scoped>
.game-player-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 18px;
  color: #666;
}

.game-content {
  position: relative;
  width: 100%;
  height: 100%;
}

.gps-manager {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.gps-status {
  font-weight: bold;
}

.map-container {
  width: 100%;
  height: 100%;
}
</style>