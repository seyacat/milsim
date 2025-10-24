<template>
  <div class="container">
    <div class="header flex justify-between items-center">
      <h1>Dashboard - Milsim Games</h1>
      <div class="flex gap-2">
        <button class="btn btn-success" @click="createGame">
          Create Game
        </button>
        <button class="btn btn-danger" @click="logout">
          Logout
        </button>
      </div>
    </div>
    
    <div class="card">
      <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap">
        <div style="flex: 1; min-width: 250px">
          <input
            type="text"
            placeholder="Search by name..."
            class="form-input"
            style="width: 100%"
            v-model="searchTerm"
          />
        </div>
        <div style="display: flex; gap: 10px; align-items: center">
          <label class="checkbox-label" style="display: flex; align-items: center; gap: 5px">
            <input
              type="checkbox"
              v-model="showOnlyOwnGames"
            />
            <span style="font-size: 12px">Show only my games</span>
          </label>
        </div>
      </div>
      
      <div style="height: 1px; background: var(--border); margin: 15px 0"></div>
      
      <div class="games-grid">
        <div v-if="filteredGames.length === 0" class="empty-state">
          No games match the filters
        </div>
        <div
          v-else
          v-for="game in filteredGames"
          :key="game.id"
          class="game-card"
          @click="enterGame(game)"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-muted)">
            <span style="font-weight: 600; font-size: 14px">{{ game.name }}</span>
            <span>Owner: {{ game.owner?.name || 'Unknown' }}</span>
            <span :class="`status-${game.status}`">Status: {{ game.status }}</span>
            <span>Players: {{ game.activeConnections || 0 }}</span>
            <button
              v-if="isGameOwner(game)"
              class="btn btn-danger btn-sm"
              @click.stop="deleteGame(game.id)"
              title="Delete game"
            >
              🗑️
            </button>
            <span v-else></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { GameService } from '../services/game.js'
import { Game, User } from '../types/index.js'
import { useToast } from '../composables/useToast.js'
import { AuthService } from '../services/auth.js'

const router = useRouter()
const { addToast } = useToast()

const allGames = ref<Game[]>([])
const loading = ref(true)
const searchTerm = ref('')
const showOnlyOwnGames = ref(false)

const currentUser = computed(() => AuthService.getCurrentUser())

const filteredGames = computed(() => {
  const filtered = allGames.value.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         (game.description && game.description.toLowerCase().includes(searchTerm.value.toLowerCase()))
    
    const matchesOwnGames = !showOnlyOwnGames.value || isGameOwner(game)
    
    return matchesSearch && matchesOwnGames
  })
  
  filtered.sort((a, b) => {
    const connectionsA = a.activeConnections || 0
    const connectionsB = b.activeConnections || 0
    return connectionsB - connectionsA
  })
  
  return filtered.slice(0, 10)
})

onMounted(() => {
  loadGames()
})

const loadGames = async () => {
  try {
    const gamesData = await GameService.getGames()
    allGames.value = gamesData
  } catch (error) {
    addToast({ message: 'Error loading games: ' + (error as Error).message, type: 'error' })
  } finally {
    loading.value = false
  }
}

const isGameOwner = (game: Game) => {
  if (!game.owner || !currentUser.value) {
    return false
  }
  return game.owner.id === currentUser.value.id
}

const deleteGame = async (gameId: number) => {
  if (!confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
    return
  }

  try {
    await GameService.deleteGame(gameId)
    addToast({ message: 'Game deleted successfully', type: 'success' })
    loadGames()
  } catch (error) {
    addToast({ message: 'Error deleting game: ' + (error as Error).message, type: 'error' })
  }
}

const enterGame = (game: Game) => {
  if (isGameOwner(game)) {
    router.push(`/owner/${game.id}`)
  } else {
    router.push(`/player/${game.id}`)
  }
}

const createGame = () => {
  router.push('/create-game')
}

const logout = () => {
  AuthService.logout()
  // Forzar recarga para limpiar completamente el estado
  window.location.href = '/login'
}
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  color: var(--text);
  font-size: 1.8rem;
  font-weight: 600;
}

.flex {
  display: flex;
}

.justify-between {
  justify-content: space-between;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 0.5rem;
}

.card {
  background: var(--card-background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form-input {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--text);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

.checkbox-label {
  color: var(--text);
  cursor: pointer;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-success {
  background: var(--success);
  color: white;
}

.btn-success:hover {
  background: var(--success-dark);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover {
  background: var(--danger-dark);
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.game-card {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.game-card:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem;
  font-style: italic;
}

.status-running {
  color: var(--success);
}

.status-stopped {
  color: var(--danger);
}

.status-paused {
  color: var(--warning);
}

.status-finished {
  color: var(--info);
}
</style>