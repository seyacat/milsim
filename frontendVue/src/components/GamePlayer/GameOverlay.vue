<template>
  <div class="game-panel game-overlay-panel">
    <div class="game-info">
      <h2>{{ currentGame?.name }}</h2>
      <div class="game-status">
        Estado: {{ getGameStatusText(currentGame?.status) }}
      </div>
      <div class="team-info" v-if="currentUserTeam">
        Tu equipo: {{ currentUserTeam.toUpperCase() }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Game, User } from '../../types'

interface Props {
  currentUser: User | null
  currentGame: Game | null
  socket: any
}

const props = defineProps<Props>()

const currentUserTeam = computed(() => {
  if (!props.currentGame || !props.currentUser) return null
  const player = props.currentGame.players?.find(p => p.user?.id === props.currentUser.id)
  return player?.team || null
})

const getGameStatusText = (status: string | undefined) => {
  switch (status) {
    case 'running': return 'En curso'
    case 'paused': return 'Pausado'
    case 'stopped': return 'Detenido'
    default: return 'Desconocido'
  }
}
</script>

<style scoped>
/* No additional styles needed - all in global.css */
</style>