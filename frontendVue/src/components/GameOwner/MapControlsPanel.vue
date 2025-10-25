<template>
  <div class="map-controls-panel">
    <button class="btn btn-secondary" @click="goBack" title="Volver al dashboard">←</button>
    <button class="btn btn-secondary" @click="reloadPage" title="Recargar página">⟳</button>
    <button
      class="btn btn-secondary"
      @click="centerOnUser"
      title="Centrar en usuario"
      :disabled="!currentPosition"
    >📍</button>
    <button class="btn btn-secondary" @click="centerOnSite" title="Centrar en Site">🏠</button>
    <button class="btn btn-secondary" @click="showPlayersDialog" title="Gestionar equipos">👥</button>
    <button class="btn btn-secondary" @click="openGameResultsDialog" title="Ver resultados">📊</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useToast } from '../../composables/useToast.js'

const router = useRouter()
const { addToast } = useToast()

defineProps<{
  currentPosition: any
}>()

const emit = defineEmits<{
  centerOnUser: []
  centerOnSite: []
  showPlayersDialog: []
  showResultsDialog: []
}>()

const goBack = () => {
  router.push('/dashboard')
}

const reloadPage = () => {
  window.location.reload()
}

const centerOnUser = () => {
  emit('centerOnUser')
}

const centerOnSite = () => {
  emit('centerOnSite')
}

const showPlayersDialog = () => {
  emit('showPlayersDialog')
}

const openGameResultsDialog = () => {
  emit('showResultsDialog')
}
</script>

<style scoped>
.map-controls-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.map-controls-panel .btn {
  padding: 10px;
  font-size: 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  backdrop-filter: blur(10px);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-controls-panel .btn:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: none;
}

.map-controls-panel .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>