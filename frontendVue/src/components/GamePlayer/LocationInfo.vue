<template>
  <div class="location-info">
    <div class="info-panel">
      <h3>Información del Juego</h3>
      <div class="info-item">
        <strong>Ubicación:</strong> {{ currentGame?.location || 'No especificada' }}
      </div>
      <div class="info-item">
        <strong>Jugadores:</strong> {{ playerCount }}
      </div>
      <div class="info-item">
        <strong>Puntos de Control:</strong> {{ controlPointCount }}
      </div>
      <div class="info-item" v-if="currentGame?.description">
        <strong>Descripción:</strong> {{ currentGame.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Game } from '../../types'

interface Props {
  currentGame: Game | null
}

const props = defineProps<Props>()

const playerCount = computed(() => {
  return props.currentGame?.players?.length || 0
})

const controlPointCount = computed(() => {
  return props.currentGame?.controlPoints?.length || 0
})
</script>

<style scoped>
.location-info {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 1000;
}

.info-panel {
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  max-width: 300px;
}

.info-panel h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.info-item {
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.4;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item strong {
  color: #333;
}
</style>