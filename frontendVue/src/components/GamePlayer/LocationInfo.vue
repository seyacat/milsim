<template>
  <div class="game-panel location-info-panel">
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
/* No additional styles needed - all in global.css */
</style>