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
      </div>
    </div>
    
    <div class="game-details">
      GPS: <span>{{ gpsStatus }}</span>
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
</script>

<style scoped>
.time-select-container {
  margin-top: 10px;
}
</style>