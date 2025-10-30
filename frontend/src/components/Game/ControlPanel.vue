<template>
  <div class="control-panel">
    <!-- Large Game State Display -->
    <div class="game-state-display">
      <div class="game-state-text">{{ getStatusText(currentGame.status) }}</div>
    </div>
    
    <div id="ownerControls" style="display: block">
      <template v-if="currentGame.status === 'stopped'">
        <button
          id="startGameBtn"
          class="btn btn-primary"
          @click="startGame"
          style="display: block; width: 100%"
        >
          Iniciar
        </button>
      </template>
      
      <template v-else-if="currentGame.status === 'running'">
        <button
          id="pauseGameBtn"
          class="btn btn-warning"
          @click="pauseGame"
          style="display: block; width: 100%"
        >
          Pausar
        </button>
      </template>
      
      <template v-else-if="currentGame.status === 'paused'">
        <button
          id="endGameBtn"
          class="btn btn-danger"
          @click="endGame"
          style="display: block; width: 100%; margin-bottom: 10px"
        >
          Finalizar
        </button>
        <button
          id="resumeGameBtn"
          class="btn btn-primary"
          @click="resumeGame"
          style="display: block; width: 100%"
        >
          Reanudar
        </button>
      </template>
      
      <template v-else-if="currentGame.status === 'finished'">
        <button
          id="restartGameBtn"
          class="btn btn-primary"
          @click="restartGame"
          style="display: block; width: 100%"
        >
          Nuevo Juego
        </button>
      </template>
      
      <!-- Remove the v-else template that was showing Finalizar button in unexpected states -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { Game } from '../../types/index.js'

defineProps<{
  currentGame: Game
}>()

const emit = defineEmits<{
  startGame: []
  pauseGame: []
  endGame: []
  restartGame: []
  resumeGame: []
}>()

const startGame = () => {
  emit('startGame')
}

const pauseGame = () => {
  emit('pauseGame')
}

const endGame = () => {
  emit('endGame')
}

const restartGame = () => {
  emit('restartGame')
}

const resumeGame = () => {
  emit('resumeGame')
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    stopped: 'INICIANDO',
    running: 'JUGANDO',
    paused: 'PAUSADO',
    finished: 'FINALIZADO'
  }
  return statusMap[status] || status.toUpperCase()
}
</script>

<style scoped>
.control-panel {
  position: absolute;
  bottom: 5em;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}

.game-state-display {
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #fff;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  margin-bottom: 10px;
}

.game-state-text {
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
}

.btn {
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover {
  background: #bd2a20;
  color: white;
}

.btn-secondary {
  background: #666;
  color: white;
}

.btn-warning {
  background: #FF9800;
  color: white;
}

.btn:hover {
  opacity: 1;
  transform: none;
}
</style>