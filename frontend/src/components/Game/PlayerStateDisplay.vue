<template>
  <div class="player-state-display">
    <div class="game-state-display">
      <div class="game-state-text">{{ getStatusText(currentGame.status) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Game } from '../../types/index.js'

defineProps<{
  currentGame: Game
}>()

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
.player-state-display {
  position: absolute;
  bottom: 5em;
  right: 20px;
  z-index: 1000;
  min-width: 200px;
}

.game-state-display {
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #fff;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
}

.game-state-text {
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
}
</style>