<template>
  <div v-if="isOpen" class="teams-dialog-overlay" @click="onClose">
    <div class="teams-dialog" @click.stop>
      <div class="teams-dialog-header">
        <h3>Gestión de Equipos</h3>
        <button class="close-btn" @click="onClose">×</button>
      </div>

      <div class="teams-dialog-content">
        <!-- Team count selector -->
        <div class="team-count-selector">
          <h4>Número de Equipos:</h4>
          <div class="team-count-buttons">
            <button
              v-for="count in [2, 3, 4]"
              :key="count"
              class="team-count-btn"
              :class="{ active: teamCount === count }"
              @click="handleTeamCountChange(count)"
            >
              {{ count }}
            </button>
          </div>
        </div>

        <!-- Players list -->
        <div class="players-list-section">
          <h4>Jugadores:</h4>
          <div class="players-list">
            <div v-if="isLoading" class="loading">Cargando jugadores...</div>
            <div v-else-if="playersData.length === 0" class="no-players">
              No hay jugadores en el juego
            </div>
            <div v-else class="player-rows">
              <div v-for="player in playersData" :key="player.id" class="player-row">
                <div class="player-name">
                  {{ player.user?.name || 'Jugador' }}
                </div>
                <div class="player-teams">
                  <button
                    v-for="team in teams"
                    :key="team"
                    class="team-btn"
                    :class="[team, { active: player.team === team }]"
                    @click="updatePlayerTeam(player.id, team)"
                  >
                    {{ team.toUpperCase() }}
                  </button>
                  <button
                    class="team-btn none"
                    :class="{ active: player.team === 'none' }"
                    @click="updatePlayerTeam(player.id, 'none')"
                  >
                    NONE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Player, TeamColor } from '../../types/index.js'

interface Props {
  isOpen: boolean
  players: Player[]
  currentGameId: number
  socket: any
  teamCount: number
}

interface Emits {
  (e: 'close'): void
  (e: 'teamCountChange', count: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const playersData = ref<Player[]>([])
const isLoading = ref(false)

const teams = computed(() => {
  const allTeams: TeamColor[] = ['blue', 'red', 'green', 'yellow']
  return allTeams.slice(0, props.teamCount)
})

// Load players data when dialog opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    loadPlayersData()
  }
})

// Update players data when props change
watch(() => props.players, (players) => {
  if (players) {
    playersData.value = [...players].sort((a, b) =>
      (a.user?.name || '').localeCompare(b.user?.name || '')
    )
  } else {
    playersData.value = []
  }
}, { immediate: true })



// Listen for player team updates via WebSocket
const setupSocketListeners = () => {
  if (!props.socket) return

  // Listen for game updates that might include player team changes
  props.socket.on('gameUpdate', (data: { game: any; type?: string }) => {
    if (data.game && data.game.players) {
      // Update local players data with the latest from server
      playersData.value = [...data.game.players].sort((a, b) =>
        (a.user?.name || '').localeCompare(b.user?.name || '')
      )
    } else {
      console.log('PlayersDialog - gameUpdate received but no players data:', data)
    }
  })

  // Listen for specific player team updated events
  props.socket.on('playerTeamUpdated', (data: { playerId: number; userId: number; team: TeamColor; userName?: string }) => {
    updatePlayerTeamInLocalData(data.playerId, data.team)
  })
}

const updatePlayerTeamInLocalData = (playerId: number, team: TeamColor) => {
  const playerIndex = playersData.value.findIndex(p => p.id === playerId)
  if (playerIndex !== -1) {
    playersData.value[playerIndex].team = team
    // Trigger reactivity by reassigning the array
    playersData.value = [...playersData.value]
  }
}

// Clean up socket listeners
const cleanupSocketListeners = () => {
  if (!props.socket) return
  
  props.socket.off('gameUpdate')
  props.socket.off('playerTeamUpdated')
}

onMounted(() => {
  setupSocketListeners()
})

onUnmounted(() => {
  cleanupSocketListeners()
})

// Re-setup listeners when socket changes
watch(() => props.socket, (newSocket, oldSocket) => {
  if (oldSocket) {
    cleanupSocketListeners()
  }
  if (newSocket) {
    setupSocketListeners()
  }
})

const loadPlayersData = () => {
  isLoading.value = true
  // In Vue version, we already have players data from props
  // This function is kept for consistency with the React system
  setTimeout(() => {
    isLoading.value = false
  }, 100)
}

const updatePlayerTeam = (playerId: number, team: TeamColor) => {
  if (props.socket && props.currentGameId) {
    props.socket.emit('gameAction', {
      gameId: props.currentGameId,
      action: 'updatePlayerTeam',
      data: {
        playerId,
        team
      }
    })
  }
}

const handleTeamCountChange = (count: number) => {
  emit('teamCountChange', count)
}

const onClose = () => {
  emit('close')
}
</script>

<style scoped>
.teams-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  pointer-events: none;
}

.teams-dialog {
  background: #000;
  border: 2px solid #333;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.teams-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #333;
  background: #1a1a1a;
}

.teams-dialog-header h3 {
  color: #fff;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #333;
  color: #fff;
}

.teams-dialog-content {
  padding: 1.5rem;
  max-height: calc(80vh - 80px);
  overflow-y: auto;
  background: #000;
}

.team-count-selector {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #333;
}

.team-count-selector h4 {
  color: #fff;
  font-size: 1rem;
  margin-bottom: 1rem;
  font-weight: 500;
}

.team-count-buttons {
  display: flex;
  gap: 0.5rem;
}

.team-count-btn {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #333;
  background: #1a1a1a;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.team-count-btn.active {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}

.team-count-btn:hover:not(.active) {
  background: #333;
}

.players-list-section h4 {
  color: #fff;
  font-size: 1rem;
  margin-bottom: 1rem;
  font-weight: 500;
}

.players-list {
  max-height: 300px;
  overflow-y: auto;
}

.loading, .no-players {
  text-align: center;
  padding: 2rem;
  color: #999;
  font-style: italic;
}

.player-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.player-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.player-row:hover {
  border-color: #1976d2;
}

.player-name {
  color: #fff;
  font-weight: 500;
  flex: 1;
}

.player-teams {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.team-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #333;
  background: #1a1a1a;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  transition: all 0.2s ease;
  min-width: 60px;
}

.team-btn.active {
  color: white;
  border-color: transparent;
}

.team-btn.blue.active {
  background: #3b82f6;
}

.team-btn.red.active {
  background: #ef4444;
}

.team-btn.green.active {
  background: #10b981;
}

.team-btn.yellow.active {
  background: #f59e0b;
}

.team-btn.none.active {
  background: #333;
  color: #fff;
}

.team-btn:hover:not(.active) {
  background: #333;
}

.team-btn.blue:hover:not(.active) {
  border-color: #3b82f6;
  color: #3b82f6;
}

.team-btn.red:hover:not(.active) {
  border-color: #ef4444;
  color: #ef4444;
}

.team-btn.green:hover:not(.active) {
  border-color: #10b981;
  color: #10b981;
}

.team-btn.yellow:hover:not(.active) {
  border-color: #f59e0b;
  color: #f59e0b;
}
</style>