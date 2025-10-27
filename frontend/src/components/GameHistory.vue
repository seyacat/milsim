<template>
  <div class="container">
    <div class="header flex justify-between items-center">
      <div>
        <h1>Game History</h1>
        <p v-if="gameInstances.length > 0" class="game-name">
          Game: {{ gameInstances[0]?.game?.name || 'Unknown' }}
        </p>
      </div>
      <button class="btn btn-secondary" @click="goBack">
        Back to Dashboard
      </button>
    </div>
    
    <div class="card">
      <div class="filter-section">
        <div class="filter-controls">
          <div class="filter-group">
            <label class="filter-label">Sort by Date:</label>
            <select v-model="sortOrder" class="filter-select" @change="sortInstances">
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label class="filter-label">Date Range:</label>
            <select v-model="dateRange" class="filter-select" @change="filterByDateRange">
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
      </div>
      
      <div style="height: 1px; background: var(--border); margin: 15px 0"></div>
      
      <div v-if="loading" class="loading-state">
        Loading game instances...
      </div>
      
      <div v-else-if="error" class="error-state">
        {{ error }}
      </div>
      
      <div v-else-if="filteredInstances.length === 0" class="empty-state">
        No game instances found
      </div>
      
      <div v-else class="instances-container">
        <div class="instances-grid">
          <div
            v-for="instance in filteredInstances"
            :key="instance.id"
            class="instance-card"
          >
            <div class="instance-card-header">
              <span class="instance-name">{{ instance.name }}</span>
              <span :class="`status-${instance.status}`">Status: {{ instance.status }}</span>
              <span class="instance-players">Players: {{ instance.players?.length || 0 }}</span>
              <span class="instance-date">{{ formatDate(instance.createdAt) }}</span>
            </div>
            
            <div class="instance-card-actions">
              <button
                class="btn btn-primary btn-sm"
                @click="showGameResults(instance.id)"
                title="View Results"
              >
                View Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <GameResultsDialog
      :isOpen="showResultsDialog"
      :onClose="closeResultsDialog"
      :gameId="selectedInstanceId"
      :isGameInstance="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { GameService } from '../services/game.js'
import { Game, GameInstance } from '../types/index.js'
import { useToast } from '../composables/useToast.js'
import GameResultsDialog from './GameResultsDialog.vue'

const router = useRouter()
const { addToast } = useToast()

const gameInstances = ref<GameInstance[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showResultsDialog = ref(false)
const selectedInstanceId = ref<number | null>(null)
const selectedGameId = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('desc')
const dateRange = ref<string>('all')

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const gameId = urlParams.get('gameId')
  if (gameId) {
    selectedGameId.value = gameId
  }
  loadGameInstances()
})


const loadGameInstances = async () => {
  try {
    loading.value = true
    error.value = null
    
    // Always filter by the specific game from URL parameter
    const gameId = selectedGameId.value ? parseInt(selectedGameId.value) : undefined
    if (!gameId) {
      error.value = 'No game ID provided'
      loading.value = false
      return
    }
    
    const instancesData = await GameService.getGameInstances(gameId)
    
    // Filter only finished instances for history
    gameInstances.value = instancesData.filter(instance =>
      instance.status === 'finished' || instance.status === 'stopped'
    )
    
    sortInstances()
  } catch (err) {
    error.value = 'Error loading game instances: ' + (err as Error).message
    addToast({ message: error.value, type: 'error' })
  } finally {
    loading.value = false
  }
}

const sortInstances = () => {
  gameInstances.value.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB
  })
}

const filteredInstances = computed(() => {
  if (dateRange.value === 'all') {
    return gameInstances.value
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return gameInstances.value.filter(instance => {
    const instanceDate = new Date(instance.createdAt)
    
    switch (dateRange.value) {
      case 'today':
        return instanceDate >= today
      case 'week':
        return instanceDate >= startOfWeek
      case 'month':
        return instanceDate >= startOfMonth
      default:
        return true
    }
  })
})

const filterByDateRange = () => {
  // The computed property will automatically update
}

const showGameResults = (instanceId: number) => {
  selectedInstanceId.value = instanceId
  showResultsDialog.value = true
}

const closeResultsDialog = () => {
  showResultsDialog.value = false
  selectedInstanceId.value = null
}

const goBack = () => {
  router.push('/dashboard')
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
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
  margin-bottom: 0.5rem;
}

.game-name {
  color: var(--text-muted);
  font-size: 1rem;
  margin: 0;
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

.card {
  background: var(--card-background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filter-section {
  margin-bottom: 1rem;
}

.filter-controls {
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  color: var(--text);
  font-weight: 500;
  font-size: 0.9rem;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--text);
  min-width: 150px;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
  font-style: italic;
}

.error-state {
  color: var(--danger);
}

.instances-container {
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
}

.instances-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.instance-card {
  background: var(--card-background);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
}

.instance-card:hover {
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.instance-card-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.instance-name {
  font-weight: 600;
  color: var(--text);
}

.instance-game,
.instance-players,
.instance-date {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.instance-card-actions {
  display: flex;
  gap: 0.5rem;
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

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-secondary {
  background: var(--secondary);
  color: white;
}

.btn-secondary:hover {
  background: var(--secondary-dark);
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.status-finished {
  color: var(--success);
}

.status-stopped {
  color: var(--danger);
}

.status-running {
  color: var(--warning);
}

.status-paused {
  color: var(--info);
}

/* Scrollbar styling */
.instances-container::-webkit-scrollbar {
  width: 8px;
}

.instances-container::-webkit-scrollbar-track {
  background: var(--background);
  border-radius: 4px;
}

.instances-container::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

.instances-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>