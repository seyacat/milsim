<template>
  <div v-if="isOpen" class="dialog-overlay">
    <div class="dialog">
      <div class="dialog-header">
        <h2>Resultados del Juego</h2>
        <button @click="onClose" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <div v-if="currentGame" class="game-results">
          <div class="game-info">
            <h3>{{ currentGame.name }}</h3>
            <p>{{ currentGame.description }}</p>
          </div>
          
          <div class="teams-section">
            <h4>Puntuación por Equipos</h4>
            <div class="teams-list">
              <div v-for="team in teams" :key="team.name" class="team-item">
                <div class="team-name">{{ team.name.toUpperCase() }}</div>
                <div class="team-score">{{ team.score }} puntos</div>
              </div>
            </div>
          </div>

          <div class="players-section">
            <h4>Jugadores</h4>
            <div class="players-list">
              <div v-for="player in currentGame.players" :key="player.id" class="player-item">
                <div class="player-name">{{ player.user?.name || 'Jugador' }}</div>
                <div class="player-team">{{ player.team?.toUpperCase() || 'Sin equipo' }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="loading">
          Cargando resultados...
        </div>
      </div>
      <div class="dialog-footer">
        <button @click="onClose" class="btn btn-primary">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Game } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  currentGame: Game | null
  gameId?: string
}

const props = defineProps<Props>()

const teams = computed(() => {
  if (!props.currentGame?.players) return []
  
  const teamScores: Record<string, number> = {}
  
  // Calcular puntuación por equipo (esto es un ejemplo básico)
  props.currentGame.players.forEach(player => {
    if (player.team && player.team !== 'none') {
      teamScores[player.team] = (teamScores[player.team] || 0) + 1
    }
  })
  
  return Object.entries(teamScores).map(([name, score]) => ({
    name,
    score
  }))
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.dialog-header h2 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.dialog-content {
  padding: 20px;
}

.game-info {
  margin-bottom: 20px;
  text-align: center;
}

.game-info h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.game-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.teams-section, .players-section {
  margin-bottom: 20px;
}

.teams-section h4, .players-section h4 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 16px;
}

.teams-list, .players-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team-item, .player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
}

.team-name, .player-name {
  font-weight: bold;
  color: #333;
}

.team-score, .player-team {
  color: #666;
}

.loading {
  text-align: center;
  color: #666;
  padding: 40px;
}

.dialog-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  text-align: right;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-primary {
  background: #1976d2;
  color: white;
}

.btn-primary:hover {
  background: #1565c0;
}
</style>