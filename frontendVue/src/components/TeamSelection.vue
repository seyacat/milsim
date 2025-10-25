<template>
  <div class="team-selection-overlay">
    <div class="team-selection-dialog">
      <div class="dialog-header">
        <h2>Seleccionar Equipo</h2>
        <button @click="onTeamSelected(null)" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <p>Elige tu equipo para unirte al juego:</p>
        
        <div class="teams-grid">
          <button 
            v-for="team in availableTeams" 
            :key="team.id"
            @click="selectTeam(team.id)"
            class="team-btn"
            :class="{ selected: selectedTeam === team.id }"
          >
            <div class="team-color" :style="{ backgroundColor: team.color }"></div>
            <div class="team-info">
              <div class="team-name">{{ team.name }}</div>
              <div class="team-count">{{ team.playerCount }} jugadores</div>
            </div>
          </button>
        </div>

        <div class="no-team-option">
          <button 
            @click="selectTeam('none')"
            class="team-btn no-team"
            :class="{ selected: selectedTeam === 'none' }"
          >
            <div class="team-color" style="background-color: #ccc"></div>
            <div class="team-info">
              <div class="team-name">Sin Equipo</div>
              <div class="team-count">Espectador</div>
            </div>
          </button>
        </div>
      </div>
      <div class="dialog-footer">
        <button @click="onTeamSelected(null)" class="btn btn-secondary">Cancelar</button>
        <button 
          @click="confirmSelection" 
          class="btn btn-primary"
          :disabled="!selectedTeam"
        >
          Unirse
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Game, User } from '../types'

interface Props {
  currentGame: Game | null
  currentUser: User | null
  socket: any
  onTeamSelected: (team: string | null) => void
}

const props = defineProps<Props>()
const selectedTeam = ref<string | null>(null)

const availableTeams = [
  { id: 'red', name: 'Equipo Rojo', color: '#f44336', playerCount: 0 },
  { id: 'blue', name: 'Equipo Azul', color: '#2196f3', playerCount: 0 },
  { id: 'green', name: 'Equipo Verde', color: '#4caf50', playerCount: 0 },
  { id: 'yellow', name: 'Equipo Amarillo', color: '#ffeb3b', playerCount: 0 }
]

// Calcular número de jugadores por equipo
availableTeams.forEach(team => {
  team.playerCount = props.currentGame?.players?.filter(p => p.team === team.id).length || 0
})

const selectTeam = (teamId: string) => {
  selectedTeam.value = teamId
}

const confirmSelection = () => {
  if (selectedTeam.value && props.socket && props.currentGame) {
    // Enviar selección de equipo al servidor
    props.socket.emit('gameAction', {
      gameId: props.currentGame.id,
      action: 'joinTeam',
      data: {
        team: selectedTeam.value
      }
    })
    
    props.onTeamSelected(selectedTeam.value)
  }
}
</script>

<style scoped>
.team-selection-overlay {
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

.team-selection-dialog {
  background: white;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
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

.dialog-content p {
  margin: 0 0 20px 0;
  color: #666;
  text-align: center;
}

.teams-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.team-btn {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.team-btn:hover {
  border-color: #1976d2;
  transform: translateY(-2px);
}

.team-btn.selected {
  border-color: #1976d2;
  background: #f0f8ff;
}

.team-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-right: 12px;
  border: 2px solid rgba(0, 0, 0, 0.1);
}

.team-info {
  flex: 1;
}

.team-name {
  font-weight: bold;
  color: #333;
  margin-bottom: 2px;
}

.team-count {
  font-size: 12px;
  color: #666;
}

.no-team-option {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.no-team .team-color {
  background: linear-gradient(45deg, #ccc 25%, transparent 25%), 
              linear-gradient(-45deg, #ccc 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #ccc 75%), 
              linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 4px 4px;
  background-position: 0 0, 0 2px, 2px -2px, -2px 0px;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  padding: 20px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #1976d2;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1565c0;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}
</style>