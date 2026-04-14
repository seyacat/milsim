<template>
  <div class="game-panel map-controls-panel">
    <button class="btn btn-secondary" @click="goBack" aria-label="Volver al dashboard" title="Volver al dashboard">←</button>
    <button class="btn btn-secondary" @click="reloadPage" aria-label="Recargar página" title="Recargar página">⟳</button>
    <button
      class="btn btn-secondary"
      @click="centerOnUser"
      aria-label="Centrar en usuario"
      title="Centrar en usuario"
      :disabled="!currentPosition"
    >📍</button>
    <button class="btn btn-secondary" @click="centerOnSite" aria-label="Centrar en Site" title="Centrar en Site">🏠</button>
    <button
      v-if="shouldShowTeamsButton"
      class="btn btn-secondary"
      @click="handleTeamsButton"
      :aria-label="isOwner ? 'Gestionar equipos' : 'Seleccionar equipo'"
      :title="isOwner ? 'Gestionar equipos' : 'Seleccionar equipo'"
    >👥</button>
    <button class="btn btn-secondary" @click="openGameResultsDialog" aria-label="Ver resultados" title="Ver resultados">📊</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useToast } from '../../composables/useToast.js'
import { computed } from 'vue'

const router = useRouter()
const { addToast } = useToast()

const props = defineProps<{
  currentPosition: any
  isOwner?: boolean
  currentGame?: any
}>()

const emit = defineEmits<{
  centerOnUser: []
  centerOnSite: []
  showPlayersDialog: []
  showResultsDialog: []
  showTeamSelection: []
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

const shouldShowTeamsButton = computed(() => {
  // Owners always see the button, players only in stopped state
  if (props.isOwner) return true
  return props.currentGame?.status === 'stopped'
})

const handleTeamsButton = () => {
  if (props.isOwner) {
    emit('showPlayersDialog')
  } else {
    emit('showTeamSelection')
  }
}

const openGameResultsDialog = () => {
  emit('showResultsDialog')
}
</script>

<style scoped>
/* No additional styles needed - all in global.css */
</style>