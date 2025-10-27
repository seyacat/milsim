<template>
  <div class="game-panel game-overlay-panel">
    <div class="game-info">
      <div class="game-title-container">
        <h2>{{ currentGame.name }}</h2>
        <span class="edit-pencil" @click="enableGameNameEdit" title="Editar nombre del juego">
          ✏️
        </span>
      </div>
      <div class="game-details">
        <div>
          Estado: <span>{{ getStatusText(currentGame.status) }}</span>
        </div>
        <div>
          Jugadores: <span>{{ currentGame.activeConnections || 0 }}</span>
        </div>
        <div>
          Propietario: <span>{{ currentUser.name }}</span>
        </div>
        <div>
          Usuario: <span>{{ currentUser.name }}</span>
        </div>
        
        <!-- Timer display for running state -->
        <div v-if="currentGame.status === 'running'">
          Tiempo transcurrido: <span>{{ formatTime(currentGame.playedTime) }}</span>
        </div>
        <div v-if="currentGame.status === 'running' && currentGame.totalTime && currentGame.totalTime > 0">
          Tiempo restante: <span>{{ formatTime(currentGame.remainingTime) }}</span>
        </div>
      </div>
    </div>
    
    <div class="game-details">
      GPS: <span>{{ gpsStatus }}</span>
    </div>

    <!-- Time selector for stopped state - Only for owner -->
    <div v-if="currentGame.status === 'stopped' && isOwner" class="time-select-container">
      <label class="panel-label">Tiempo:</label>
      <select
        class="panel-select"
        v-model="selectedTime"
        @change="handleTimeSelect"
      >
        <option value="20">20 seg (test)</option>
        <option value="300">5 min</option>
        <option value="600">10 min</option>
        <option value="1200">20 min</option>
        <option value="3600">1 hora</option>
        <option value="0">indefinido</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Game } from '../../types/index.js'
import { useToast } from '../../composables/useToast.js'
import { ref, watch } from 'vue'

const { addToast } = useToast()

const props = defineProps<{
  currentUser: User
  currentGame: Game
  gpsStatus: string
  defaultTimeValue?: number
  isOwner?: boolean
}>()

const emit = defineEmits<{
  timeSelect: [timeInSeconds: number]
}>()

const selectedTime = ref<string>('1200')
const isUserSelecting = ref(false)
const lastGameId = ref<string | number | null>(null)

// Watch for game instance changes to reset selection state
watch(() => props.currentGame?.id, (newGameId) => {
  if (newGameId && newGameId !== lastGameId.value) {
    lastGameId.value = newGameId
    isUserSelecting.value = false // Reset selection flag on new game instance
  }
})

// Watch for changes in currentGame.totalTime to keep dropdown synchronized
// Only update if the user is not currently selecting a value OR if the game instance changed
watch(() => props.currentGame?.totalTime, (newTotalTime, oldTotalTime) => {
  const currentGameId = props.currentGame?.id
  
  // Always update when game instance changes (restart/new game)
  if (currentGameId !== lastGameId.value) {
    lastGameId.value = currentGameId
    isUserSelecting.value = false
    if (newTotalTime !== undefined && newTotalTime !== null) {
      selectedTime.value = newTotalTime.toString()
    } else if (props.defaultTimeValue !== undefined) {
      selectedTime.value = props.defaultTimeValue.toString()
    }
  }
  // Update only if user is not selecting and value actually changed
  else if (!isUserSelecting.value && newTotalTime !== oldTotalTime) {
    if (newTotalTime !== undefined && newTotalTime !== null) {
      selectedTime.value = newTotalTime.toString()
    } else if (props.defaultTimeValue !== undefined) {
      selectedTime.value = props.defaultTimeValue.toString()
    }
  }
}, { immediate: true })

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    stopped: 'Detenido',
    running: 'En Ejecución',
    paused: 'Pausado',
    finished: 'Finalizado'
  }
  return statusMap[status] || status
}

const enableGameNameEdit = () => {
  addToast({ message: 'Funcionalidad de edición de nombre en desarrollo', type: 'info' })
}

const handleTimeSelect = () => {
  isUserSelecting.value = true
  const timeInSeconds = parseInt(selectedTime.value)
  emit('timeSelect', timeInSeconds)
  
  // Reset the flag after a short delay to allow server updates
  setTimeout(() => {
    isUserSelecting.value = false
  }, 1000)
}

const formatTime = (seconds: number): string => {
  // Handle null, undefined, or invalid values
  if (!seconds || seconds <= 0) return '0:00'
  
  // Ensure seconds is a valid number
  const validSeconds = Math.max(0, Math.floor(Number(seconds)))
  
  const hours = Math.floor(validSeconds / 3600)
  const minutes = Math.floor((validSeconds % 3600) / 60)
  const remainingSeconds = validSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}
</script>

<style scoped>
.time-select-container {
  margin-top: 10px;
}
</style>