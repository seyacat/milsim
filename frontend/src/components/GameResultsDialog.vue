<template>
  <div v-if="isOpen" class="game-results-overlay" @click="onClose">
    <div class="game-results-dialog" @click.stop>
      <div class="game-results-header">
        <h3 class="game-results-title">Resumen del Juego</h3>
        <p class="game-results-subtitle">¡Juego Finalizado!</p>
      </div>
      
      <div class="game-results-content">
        <div v-if="isLoading" class="game-results-loading">
          Cargando resultados del juego...
        </div>
        
        <div v-if="error" class="game-results-error">
          {{ error }}
        </div>
        
        <div v-if="!isLoading && !error && results">
          <!-- Game Summary Section -->
          <div class="game-results-section">
            <h4 class="game-results-section-title">Resumen General</h4>
            <div class="game-results-table-container">
              <table class="game-results-table">
                <tbody>
                  <tr>
                    <td><strong>Duración:</strong></td>
                    <td>{{ formatDuration(results.gameDuration) }}</td>
                  </tr>
                  <tr>
                    <td><strong>Jugadores:</strong></td>
                    <td>{{ currentGame?.players?.length || 0 }}</td>
                  </tr>
                  <tr>
                    <td><strong>Equipos:</strong></td>
                    <td>{{ currentGame?.teamCount || 2 }}</td>
                  </tr>
                  <tr>
                    <td><strong>Puntos de control:</strong></td>
                    <td>{{ currentGame?.controlPoints?.length || 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Team Results Table -->
          <div v-if="results.controlPoints && results.controlPoints.length > 0" class="game-results-section">
            <h4 class="game-results-section-title">Resultados por Equipos</h4>
            <div class="game-results-table-container">
              <table class="game-results-table">
                <thead>
                  <tr>
                    <th>Punto de Control</th>
                    <th v-for="team in results.teams" :key="team">
                      <div class="game-results-team">
                        <div :class="`team-color ${team}`"></div>
                        {{ team.toUpperCase() }}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cp in results.controlPoints" :key="cp.id">
                    <td>{{ cp.name }}</td>
                    <td v-for="team in results.teams" :key="team">
                      {{ formatTime(cp.teamTimes?.[team] || 0) }}
                    </td>
                  </tr>
                  <tr class="totals-row">
                    <td><strong>TOTAL</strong></td>
                    <td v-for="team in results.teams" :key="team">
                      <strong>{{ formatTime(results.teamTotals?.[team] || 0) }}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Player Capture Statistics -->
          <div v-if="results.playerCaptureStats" class="game-results-section">
            <h4 class="game-results-section-title">Resultados por Jugador</h4>
            <div class="game-results-table-container">
              <table class="game-results-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Equipo</th>
                    <th>Capturas</th>
                    <th>Desactivaciones</th>
                    <th>Explosiones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="player in sortedPlayerStats" :key="player.userId">
                    <td>{{ player.userName }}</td>
                    <td>
                      <div class="game-results-team">
                        <div :class="`team-color ${player.team}`"></div>
                        {{ player.team.toUpperCase() }}
                      </div>
                    </td>
                    <td>{{ player.captureCount || 0 }}</td>
                    <td>{{ player.bombDeactivationCount || 0 }}</td>
                    <td>{{ player.bombExplosionCount || 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div class="game-results-footer">
        <button class="btn btn-secondary" @click="onClose">
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Game, GameResults, TeamColor } from '../types'
import { GameService } from '../services/game.js'

interface Props {
  isOpen: boolean
  onClose: () => void
  currentGame?: Game | null
  gameId?: string | number
}

const props = defineProps<Props>()

const results = ref<GameResults | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

const sortedPlayerStats = computed(() => {
  if (!results.value?.playerCaptureStats) return []
  
  return [...results.value.playerCaptureStats].sort((a, b) =>
    (b.captureCount || 0) - (a.captureCount || 0)
  )
})

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const loadGameResults = async () => {
  if (!props.gameId) return
  
  isLoading.value = true
  error.value = null
  
  try {
    const gameId = typeof props.gameId === 'string' ? parseInt(props.gameId) : props.gameId
    const resultsData = await GameService.getGameResults(gameId)
    results.value = resultsData
  } catch (err) {
    console.error('Error loading game results:', err)
    error.value = err instanceof Error ? err.message : 'Error desconocido'
  } finally {
    isLoading.value = false
  }
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.gameId) {
    loadGameResults()
  }
})
</script>

<style scoped>
.game-results-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.game-results-dialog {
  background: #000;
  border-radius: 8px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  border: 1px solid #333;
}

.game-results-header {
  padding: 20px;
  border-bottom: 1px solid #333;
  text-align: center;
}

.game-results-title {
  margin: 0 0 8px 0;
  color: white;
  font-size: 20px;
  font-weight: bold;
}

.game-results-subtitle {
  margin: 0;
  color: #ccc;
  font-size: 14px;
}

.game-results-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.game-results-section {
  margin-bottom: 24px;
}

.game-results-section-title {
  margin: 0 0 12px 0;
  color: white;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 2px solid #1976d2;
  padding-bottom: 6px;
}

.game-results-table-container {
  overflow-x: auto;
}

.game-results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.game-results-table th,
.game-results-table td {
  padding: 6px 8px;
  text-align: center;
  border: 1px solid #333;
}

.game-results-table th {
  background: #1a1a1a;
  font-weight: bold;
  color: white;
}

.game-results-table td {
  background: #000;
  color: white;
}

.totals-row td {
  background: #1a1a1a;
  font-weight: bold;
  color: white;
}

.game-results-team {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.team-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid #333;
}

.team-color.blue {
  background: #2196F3;
}

.team-color.red {
  background: #F44336;
}

.team-color.green {
  background: #4CAF50;
}

.team-color.yellow {
  background: #FFC107;
}

.game-results-loading,
.game-results-error {
  text-align: center;
  padding: 30px;
  font-size: 14px;
}

.game-results-loading {
  color: #ccc;
}

.game-results-error {
  color: #F44336;
}

.game-results-footer {
  padding: 16px;
  border-top: 1px solid #333;
  text-align: right;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}
</style>