<template>
  <div class="control-panel">
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
      
      <template v-else>
        <button
          id="endGameBtn"
          class="btn btn-danger"
          @click="endGame"
          style="display: block; width: 100%; margin-bottom: 10px"
        >
          Finalizar
        </button>
      </template>
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
</script>

<style scoped>
.control-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
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