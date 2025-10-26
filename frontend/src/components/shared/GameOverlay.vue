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
          Tiempo transcurrido: <span>{{ formatTime(currentGame.playedTime || 0) }}</span>
        </div>
        <div v-if="currentGame.status === 'running' && currentGame.totalTime && currentGame.totalTime > 0">
          Tiempo restante: <span>{{ formatTime(currentGame.remainingTime || 0) }}</span>
        </div>
      </div>
    </div>
    
    <div class="game-details">
      GPS: <span>{{ gpsStatus }}</span>
    </div>

    <!-- Time selector for stopped state -->
    <div v-if="currentGame.status === 'stopped'" class="time-select-container">
      <label class="panel-label">Tiempo:</label>
      <select
        class="panel-select"
        @change="handleTimeSelect"
        :value="defaultTimeValue"
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

const { addToast } = useToast()

defineProps<{
  currentUser: User
  currentGame: Game
  gpsStatus: string
  defaultTimeValue?: number
}>()

const emit = defineEmits<{
  timeSelect: [timeInSeconds: number]
}>()

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

const handleTimeSelect = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const timeInSeconds = parseInt(target.value)
  emit('timeSelect', timeInSeconds)
}

const formatTime = (seconds: number): string => {
  if (seconds <= 0) return '0:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  
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