<template>
  <div class="game-panel map-controls-panel">
    <div class="control-group">
      <button @click="centerOnUser" class="control-btn" title="Centrar en mi posición">
        <span class="icon">📍</span>
      </button>
      <button @click="centerOnSite" class="control-btn" title="Centrar en el sitio del juego">
        <span class="icon">🎯</span>
      </button>
      <button @click="showTeamSelection" class="control-btn" title="Seleccionar equipo">
        <span class="icon">👥</span>
      </button>
      <button @click="openResultsDialog" class="control-btn" title="Ver resultados">
        <span class="icon">📊</span>
      </button>
      <button @click="reloadPage" class="control-btn" title="Recargar página">
        <span class="icon">🔄</span>
      </button>
      <button @click="goBack" class="control-btn" title="Volver atrás">
        <span class="icon">←</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  goBack: () => void
  reloadPage: () => void
  centerOnUser: () => void
  centerOnSite: () => void
  openResultsDialog: () => void
  showTeamSelection: () => void
  gameStatus?: string
  mapInstanceRef?: any
}

const props = defineProps<Props>()
</script>

<style scoped>
/* No additional styles needed - all in global.css */
</style>