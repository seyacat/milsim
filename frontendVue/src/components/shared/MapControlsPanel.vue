<template>
  <div class="game-panel map-controls-panel">
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
/* No additional styles needed - all in global.css */
</style>