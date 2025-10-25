<template>
  <div class="game-overlay">
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
.game-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  max-width: 300px;
}

.game-info h2 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #333;
}

.game-status {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.team-info {
  font-size: 14px;
  font-weight: bold;
  color: #1976d2;
}
</style>