<template>
  <div class="team-selection-overlay">
    <div class="team-selection-dialog">
      <div class="dialog-header">
        <h2>Seleccionar Equipo</h2>
        <button @click="onTeamSelected(null)" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <p>Haz clic en un equipo para unirte:</p>
        
        <div class="teams-grid">
          <button
            v-for="team in availableTeams"
            :key="team.id"
            @click="selectTeam(team.id)"
            class="team-btn"
          >
            <div class="team-color" :class="`team-${team.id}`"></div>
            <div class="team-info">
              <div class="team-name">{{ team.name }}</div>
              <div class="team-count">{{ team.playerCount }} jugadores</div>
            </div>
          </button>
        </div>

        <div class="no-team-option">
          <button
            @click="selectTeam('none')"
            class="team-btn no-team"
          >
            <div class="team-color team-none"></div>
            <div class="team-info">
              <div class="team-name">Sin Equipo</div>
              <div class="team-count">Espectador</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Game, User } from '../types'
import { useToast } from '../composables/useToast.js'

interface Props {
  currentGame: Game | null
  currentUser: User | null
  socket: any
  onTeamSelected: (team: string | null) => void
}

const props = defineProps<Props>()
const selectedTeam = ref<string | null>(null)
const { addToast } = useToast()
const currentGameData = ref<Game | null>(props.currentGame)

// Definir todos los equipos posibles
const allTeams = [
  { id: 'red', name: 'Equipo Rojo', color: '#f44336', playerCount: 0 },
  { id: 'blue', name: 'Equipo Azul', color: '#2196f3', playerCount: 0 },
  { id: 'green', name: 'Equipo Verde', color: '#4caf50', playerCount: 0 },
  { id: 'yellow', name: 'Equipo Amarillo', color: '#ffeb3b', playerCount: 0 }
]

// Computed property para equipos disponibles basados en teamCount del juego
const availableTeams = computed(() => {
  const teamCount = currentGameData.value?.teamCount || 2
  const teams = allTeams.slice(0, teamCount)
  
  // Calcular número de jugadores por equipo
  teams.forEach(team => {
    team.playerCount = currentGameData.value?.players?.filter(p => p.team === team.id).length || 0
  })
  
  return teams
})

const selectTeam = (teamId: string) => {
  console.log('TeamSelection - selectTeam called with:', teamId)
  console.log('TeamSelection - props.socket:', props.socket)
  console.log('TeamSelection - currentGameData:', currentGameData.value)
  
  // Get the socket value (it's a ref)
  const socket = props.socket?.value || props.socket
  const currentGame = currentGameData.value
  
  console.log('TeamSelection - Extracted socket:', socket)
  console.log('TeamSelection - Extracted currentGame:', currentGame)
  
  if (!socket) {
    console.error('TeamSelection - Socket not available')
    addToast({ message: 'Error: Conexión no disponible', type: 'error' })
    return
  }
  
  if (!currentGame) {
    console.error('TeamSelection - Current game not available')
    addToast({ message: 'Error: Juego no disponible', type: 'error' })
    return
  }
  
  // Validar que el equipo seleccionado esté disponible según el teamCount
  const teamCount = currentGame.teamCount || 2
  const availableTeamIds = ['red', 'blue', 'green', 'yellow'].slice(0, teamCount)
  
  if (teamId !== 'none' && !availableTeamIds.includes(teamId)) {
    console.error('TeamSelection - Invalid team selection:', teamId)
    addToast({ message: 'Error: Equipo no disponible', type: 'error' })
    return
  }
  
  // Get team name for toast message
  const teamNames: Record<string, string> = {
    'red': 'Rojo',
    'blue': 'Azul',
    'green': 'Verde',
    'yellow': 'Amarillo',
    'none': 'Sin Equipo'
  }
  const teamName = teamNames[teamId] || teamId
  
  // Enviar selección de equipo al servidor
  console.log('TeamSelection - Sending team selection to server')
  console.log('TeamSelection - Game ID:', currentGame.id)
  console.log('TeamSelection - Team ID:', teamId)
  
  try {
    // Find current player to get playerId
    const currentPlayer = currentGame.players?.find(p => p.user?.id === props.currentUser?.id)
    const playerId = currentPlayer?.id
    
    console.log('TeamSelection - Current player:', currentPlayer)
    console.log('TeamSelection - Player ID:', playerId)
    console.log('TeamSelection - User ID:', props.currentUser?.id)
    
    socket.emit('gameAction', {
      gameId: currentGame.id,
      action: 'updatePlayerTeam',
      data: {
        team: teamId,
        userId: props.currentUser?.id,
        playerId: playerId
      }
    })
    console.log('TeamSelection - Socket emit successful')
  } catch (error) {
    console.error('TeamSelection - Socket emit error:', error)
    addToast({ message: 'Error al enviar selección', type: 'error' })
    return
  }
  
  // Cerrar el diálogo inmediatamente después de la selección
  console.log('TeamSelection - Closing dialog')
  props.onTeamSelected(teamId)
  
  // Wait for the backend to confirm the team change via WebSocket
  // The marker will be updated when the playerTeamUpdated event is received
}

// Listen for WebSocket updates
const setupSocketListeners = () => {
  const socket = props.socket?.value || props.socket
  if (!socket) return

  // Listen for game updates that might include team count changes
  socket.on('gameUpdate', (data: { game: any; type?: string }) => {
    if (data.game) {
      console.log('TeamSelection - Game update received:', data.game)
      currentGameData.value = data.game
    }
  })

  // Listen for team count updates
  socket.on('gameAction', (data: { action: string; data: any }) => {
    if (data.action === 'teamCountUpdated' && data.data.game) {
      console.log('TeamSelection - Team count updated:', data.data.game)
      currentGameData.value = data.data.game
    }
  })
}

// Clean up socket listeners
const cleanupSocketListeners = () => {
  const socket = props.socket?.value || props.socket
  if (!socket) return
  
  socket.off('gameUpdate')
  socket.off('gameAction')
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

// Update currentGameData when props change
watch(() => props.currentGame, (newGame) => {
  if (newGame) {
    currentGameData.value = newGame
  }
}, { immediate: true })
</script>

<style scoped>
.team-selection-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.team-selection-dialog {
  background: #000;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #333;
}

.dialog-header h2 {
  margin: 0;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.dialog-content {
  padding: 20px;
}

.dialog-content p {
  margin: 0 0 20px 0;
  color: #ccc;
  text-align: center;
}

.teams-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.team-btn {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 2px solid #333;
  border-radius: 8px;
  background: #1a1a1a;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.team-btn:hover {
  border-color: #1976d2;
  background: #2a2a2a;
  transform: translateY(-2px);
}

.team-btn.selected {
  border-color: #1976d2;
  background: #2a2a2a;
}

.team-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 12px;
  border: 2px solid rgba(0, 0, 0, 0.1);
}

.team-info {
  flex: 1;
}

.team-name {
  font-weight: bold;
  color: #fff;
  margin-bottom: 2px;
}

.team-count {
  font-size: 12px;
  color: #999;
}

.no-team-option {
  border-top: 1px solid #333;
  padding-top: 20px;
}

.no-team .team-color {
  background: linear-gradient(45deg, #ccc 25%, transparent 25%), 
              linear-gradient(-45deg, #ccc 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #ccc 75%), 
              linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 4px 4px;
  background-position: 0 0, 0 2px, 2px -2px, -2px 0px;
}

</style>