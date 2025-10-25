<template>
  <div class="map-controls">
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
.map-controls {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  z-index: 1000;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.95);
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.control-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 6px;
  background: #f5f5f5;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: #e0e0e0;
  transform: scale(1.05);
}

.control-btn:active {
  transform: scale(0.95);
}

.icon {
  font-size: 16px;
}
</style>