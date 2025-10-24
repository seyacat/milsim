<template>
  <div class="game-player-container">
    <div v-if="isLoading" class="loading">
      Cargando juego...
    </div>
    <div v-else-if="!currentGame || !currentUser" class="loading">
      Error al cargar el juego
    </div>
    <div v-else>
      <!-- Simplified Game Player Interface -->
      <div class="game-header">
        <h1>{{ currentGame.name }}</h1>
        <div class="game-status">
          Status: {{ currentGame.status }}
        </div>
      </div>
      
      <div class="game-info">
        <div class="info-card">
          <h3>Your Team</h3>
          <div class="team-display">{{ getPlayerTeam() || 'No team assigned' }}</div>
        </div>
        <div class="info-card">
          <h3>Players Online</h3>
          <div class="player-count">{{ currentGame.activeConnections || 0 }}</div>
        </div>
        <div class="info-card">
          <h3>Control Points</h3>
          <div class="control-point-count">{{ currentGame.controlPoints.length }}</div>
        </div>
      </div>
      
      <div v-if="showTeamSelection && currentGame.status === 'stopped'" class="team-selection">
        <h3>Select Your Team</h3>
        <div class="team-buttons">
          <button 
            v-for="team in availableTeams" 
            :key="team" 
            class="btn team-btn" 
            :class="`team-${team}`"
            @click="selectTeam(team)"
          >
            {{ team.toUpperCase() }}
          </button>
        </div>
      </div>
      
      <div class="game-controls">
        <button class="btn btn-secondary" @click="goBack">
          Back to Dashboard
        </button>
        <button class="btn btn-info" @click="reloadPage">
          Reload
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AuthService } from '../services/auth.js'
import { GameService } from '../services/game.js'
import { User, Game, TeamColor } from '../types/index.js'
import { useToast } from '../composables/useToast.js'
import { io, Socket } from 'socket.io-client'

const route = useRoute()
const router = useRouter()
const { addToast } = useToast()

const currentUser = ref<User | null>(null)
const currentGame = ref<Game | null>(null)
const isLoading = ref(true)
const socketRef = ref<Socket | null>(null)
const showTeamSelection = ref(false)

const gameId = route.params.gameId as string

const availableTeams = computed(() => {
  if (!currentGame.value) return []
  const teams: TeamColor[] = ['blue', 'red', 'green', 'yellow']
  return teams.slice(0, currentGame.value.teamCount || 2)
})

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

    currentUser.value = user
    currentGame.value = game

    // Check if player needs to select a team
    const player = game.players?.find(p => p.user?.id === user.id)
    if (!player?.team || player.team === 'none') {
      showTeamSelection.value = true
    }

    // Initialize WebSocket connection
    const token = AuthService.getToken()
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`
    
    const socket = io(wsUrl, {
      auth: {
        token: token
      }
    })
    socketRef.value = socket

    socket.on('connect', () => {
      socket.emit('joinGame', { gameId: parseInt(gameId) })
    })

    socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
      if (data.game) {
        currentGame.value = data.game
        
        // Update team selection visibility
        const player = data.game.players?.find(p => p.user?.id === currentUser.value?.id)
        if (player?.team && player.team !== 'none') {
          showTeamSelection.value = false
        }
      }
    })

    socket.on('joinSuccess', (data: { user: User }) => {
      if (data.user) {
        currentUser.value = data.user
      }
    })

    socket.on('gameActionError', (data: { action: string; error: string }) => {
      console.error(`Game action error (${data.action}):`, data.error)
      addToast({ message: `Error: ${data.error}`, type: 'error' })
    })

    socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error)
    })

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect' || reason === 'transport close') {
        addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
      }
    })

  } catch (error) {
    console.error('Error initializing game:', error)
    addToast({ message: 'Error al cargar el juego', type: 'error' })
    router.push('/dashboard')
  } finally {
    isLoading.value = false
  }
})

const getPlayerTeam = () => {
  if (!currentGame.value || !currentUser.value) return null
  const player = currentGame.value.players?.find(p => p.user?.id === currentUser.value?.id)
  return player?.team
}

const selectTeam = (team: TeamColor) => {
  if (!socketRef.value || !currentGame.value) return
  
  socketRef.value.emit('gameAction', {
    gameId: currentGame.value.id,
    action: 'selectTeam',
    data: {
      team: team
    }
  })
  
  addToast({ message: `Te has unido al equipo ${team.toUpperCase()}`, type: 'success' })
  showTeamSelection.value = false
}

const goBack = () => {
  router.push('/dashboard')
}

const reloadPage = () => {
  window.location.reload()
}
</script>

<style scoped>
.game-player-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  font-size: 18px;
  color: var(--text);
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.game-header h1 {
  color: var(--text);
  font-size: 2rem;
  font-weight: 600;
}

.game-status {
  padding: 0.5rem 1rem;
  background: var(--info);
  color: white;
  border-radius: 4px;
  font-weight: 500;
}

.game-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.info-card {
  background: var(--card-background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.info-card h3 {
  color: var(--text-muted);
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.team-display, .player-count, .control-point-count {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
}

.team-selection {
  background: var(--card-background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  text-align: center;
}

.team-selection h3 {
  color: var(--text);
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.team-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.team-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
  min-width: 100px;
}

.team-blue {
  background: #3498db;
}

.team-blue:hover {
  background: #2980b9;
}

.team-red {
  background: #e74c3c;
}

.team-red:hover {
  background: #c0392b;
}

.team-green {
  background: #2ecc71;
}

.team-green:hover {
  background: #27ae60;
}

.team-yellow {
  background: #f1c40f;
  color: #333;
}

.team-yellow:hover {
  background: #f39c12;
}

.game-controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: var(--secondary);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--secondary-dark);
}

.btn-info {
  background: var(--info);
  color: white;
}

.btn-info:hover {
  background: var(--info-dark);
}
</style>