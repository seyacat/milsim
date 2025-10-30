<template>
  <div
    class="container"
    :class="{ dragging: isDragging }"
    :style="{ transform: `translateY(${pullDistance}px)` }"
    ref="containerRef"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
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
    
    <div class="refresh-indicator" :class="{ active: isRefreshing }">
      <div class="refresh-spinner">⟳</div>
      <span>{{ isRefreshing ? 'Actualizando...' : 'Soltar para actualizar' }}</span>
    </div>
    
    <div class="card">
      <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap">
        <div style="flex: 1; min-width: 250px">
          <input
            type="text"
            placeholder="Search by name, description or owner..."
            class="form-input"
            style="width: 100%"
            v-model="searchTerm"
          />
        </div>
        <div style="display: flex; gap: 10px; align-items: center">
          <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px">
            <input
              type="checkbox"
              v-model="showOnlyOwnGames"
              style="width: 20px; height: 20px"
            />
            <span>Mostrar solo mis juegos</span>
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
          <div class="game-card-header">
            <div class="game-info-column">
              <div class="game-info-row">
                <span class="game-name">{{ game.name }}</span>
                <span class="game-owner">Propietario: {{ game.owner?.name || 'Unknown' }}</span>
              </div>
              <div class="game-info-row">
                <span :class="`status-${game.status}`">Estado: {{ game.status }}</span>
                <span>Jugadores: {{ game.activeConnections || 0 }}</span>
              </div>
            </div>
            <div class="game-card-actions">
              <button
                class="btn btn-primary"
                @click.stop="enterGame(game)"
                title="Entrar al juego"
              >
                🚪
              </button>
              <button
                class="btn btn-success"
                @click.stop="viewGameHistory(game.id)"
                title="View Game History"
              >
                🕒
              </button>
              <button
                v-if="isGameOwner(game)"
                class="btn btn-danger"
                @click.stop="deleteGame(game.id)"
                title="Delete game"
              >
                🗑️
              </button>
            </div>
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

// Swipe refresh variables
const containerRef = ref<HTMLElement>()
const touchStartY = ref(0)
const touchCurrentY = ref(0)
const isDragging = ref(false)
const isRefreshing = ref(false)
const pullDistance = ref(0)

const currentUser = computed(() => AuthService.getCurrentUser())

const filteredGames = computed(() => {
  const filtered = allGames.value.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         (game.description && game.description.toLowerCase().includes(searchTerm.value.toLowerCase())) ||
                         (game.owner?.name && game.owner.name.toLowerCase().includes(searchTerm.value.toLowerCase()))
    
    const matchesOwnGames = !showOnlyOwnGames.value || isGameOwner(game)
    
    return matchesSearch && matchesOwnGames
  })
  
  filtered.sort((a, b) => {
    const connectionsA = a.activeConnections || 0
    const connectionsB = b.activeConnections || 0
    return connectionsB - connectionsA
  })
  
  return filtered.slice(0, 25)
})

onMounted(() => {
  loadGames()
})

// Swipe refresh handlers
const handleTouchStart = (e: TouchEvent) => {
  // Only activate swipe refresh when at the very top of the games grid
  const gamesGrid = document.querySelector('.games-grid') as HTMLElement
  const isAtTop = gamesGrid && gamesGrid.scrollTop === 0
  
  if (isAtTop) {
    touchStartY.value = e.touches[0].clientY
    isDragging.value = true
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return
  
  touchCurrentY.value = e.touches[0].clientY
  const rawDistance = Math.max(0, touchCurrentY.value - touchStartY.value)
  
  // Apply extremely strong spring resistance: almost no movement after threshold
  const MAX_PULL = 80
  const RESISTANCE_FACTOR = 0.1 // Extremely strong resistance
  
  if (rawDistance <= MAX_PULL) {
    pullDistance.value = rawDistance
  } else {
    // Apply extremely strong resistance after MAX_PULL
    const extraDistance = rawDistance - MAX_PULL
    pullDistance.value = MAX_PULL + (extraDistance * RESISTANCE_FACTOR)
  }
  
  // Prevent scrolling when pulling down to refresh
  if (pullDistance.value > 10) {
    e.preventDefault()
  }
}

const handleTouchEnd = () => {
  if (!isDragging.value) return
  
  isDragging.value = false
  
  // Trigger refresh if pulled down enough
  if (pullDistance.value > 80) {
    isRefreshing.value = true
    loadGames().finally(() => {
      setTimeout(() => {
        isRefreshing.value = false
        pullDistance.value = 0
      }, 500)
    })
  } else {
    // Spring back animation
    const startDistance = pullDistance.value
    const startTime = Date.now()
    const duration = 300 // ms
    
    const animateSpringBack = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Ease out cubic function for smooth spring back
      const easeOutCubic = 1 - Math.pow(1 - progress, 3)
      pullDistance.value = startDistance * (1 - easeOutCubic)
      
      if (progress < 1) {
        requestAnimationFrame(animateSpringBack)
      }
    }
    
    requestAnimationFrame(animateSpringBack)
  }
}

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
  router.push(`/game/${game.id}`)
}

const createGame = () => {
  router.push('/create-game')
}

const viewGameHistory = (gameId: number) => {
  router.push(`/history?gameId=${gameId}`)
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
  transition: transform 0.2s ease;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.container.dragging {
  transition: none;
}

.header {
  flex-shrink: 0;
}

.card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flex child scrolling */
}

.refresh-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transform: translateY(-100%);
  transition: transform 0.3s ease;
  z-index: 1000;
  font-weight: 500;
}

.refresh-indicator.active {
  transform: translateY(0);
}

.refresh-spinner {
  font-size: 1.5rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  color: var(--text-primary);
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
  color: var(--text-primary);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

.checkbox-label {
  color: var(--text-primary);
  cursor: pointer;
}



.history-icon {
  font-size: 1.2rem;
}

.games-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  overflow-y: auto;
  max-height: 100%;
  padding-right: 5px; /* Space for scrollbar */
}

/* Custom scrollbar styling */
.games-grid::-webkit-scrollbar {
  width: 6px;
}

.games-grid::-webkit-scrollbar-track {
  background: var(--background);
  border-radius: 3px;
}

.games-grid::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.games-grid::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
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

.game-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.game-info-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.game-info-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.game-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--font-size-lg);
}

.game-owner {
  color: var(--text-muted);
  font-size: var(--font-size-base);
}

.game-card-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
</style>