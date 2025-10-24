<template>
  <div class="game-overlay">
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
.game-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 15px;
  color: white;
  max-width: 300px;
  backdrop-filter: blur(10px);
}

.game-info h2 {
  margin: 0 0 5px 0;
  color: #4CAF50;
  font-size: 16px;
}

.game-details {
  font-size: 12px;
  color: #ccc;
}

.game-title-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-pencil {
  color: #4CAF50;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  opacity: 0.7;
  transform: translateY(-3px);
}

.edit-pencil:hover {
  opacity: 1;
}
</style>