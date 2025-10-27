<template>
  <div class="control-point-edit-menu">
    <div class="control-point-edit-content">
      <div class="header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px">
        <h4 class="edit-title">Editar Punto</h4>
        <button
          @click="handleClose"
          class="btn-close"
          style="background: none; border: none; font-size: 18px; cursor: pointer; color: #666; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center"
          title="Cerrar"
        >
          ×
        </button>
      </div>
      
      <div v-if="controlPoint.ownedByTeam" class="ownership-section">
        <div
          class="ownership-status"
          :style="{
            background: getTeamColor(controlPoint.ownedByTeam),
            color: 'white',
            padding: '5px',
            borderRadius: '4px',
            marginBottom: '10px',
            textAlign: 'center',
            fontWeight: 'bold'
          }"
        >
          Controlado por: {{ getTeamName(controlPoint.ownedByTeam) }}
        </div>
        <div class="hold-time" style="font-size: 12px; color: #666; text-align: center; margin-bottom: 10px">
          Tiempo: {{ controlPoint.displayTime || '00:00' }}
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Tipo:</label>
        <select
          :id="`controlPointType_${controlPoint.id}`"
          :value="controlPoint.type"
          class="form-input"
          @change="handleTypeChange"
        >
          <option value="site">Site</option>
          <option value="control_point">Control Point</option>
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Nombre:</label>
        <input
          type="text"
          :id="`controlPointEditName_${controlPoint.id}`"
          :value="controlPoint.name"
          class="form-input"
          @input="handleNameChange"
        />
      </div>
      
      <div class="form-group">
        <label class="form-label">Asignar Equipo:</label>
        <div class="team-buttons" style="display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap">
          <!-- None button to remove team assignment -->
          <button
            @click="handleAssignTeam('none')"
            class="btn btn-none"
            :style="{
              background: '#9E9E9E',
              color: 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '3px',
              fontSize: '12px',
              opacity: (!controlPoint.ownedByTeam || controlPoint.ownedByTeam === 'none') ? 1 : 0.7
            }"
          >
            Ninguno
          </button>
          
          <!-- Dynamic team buttons based on game team count -->
          <button
            v-for="team in availableTeams"
            :key="team"
            @click="handleAssignTeam(team)"
            :class="`btn btn-${team}`"
            :style="{
              background: getTeamColor(team),
              color: team === 'yellow' ? 'black' : 'white',
              border: 'none',
              padding: '5px 10px',
              borderRadius: '3px',
              fontSize: '12px',
              opacity: controlPoint.ownedByTeam === team ? 1 : 0.7
            }"
          >
            {{ getTeamName(team) }}
          </button>
        </div>
      </div>
      
      <div class="challenges-section" style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px">
        <h5 style="margin: 0 0 10px 0; font-size: 14px; color: #333">Desafíos</h5>
        
        <div class="challenge-toggle">
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
            <input
              type="checkbox"
              :checked="controlPoint.hasPositionChallenge"
              @change="handleTogglePositionChallenge"
            />
            <span>📍 Position Challenge</span>
          </label>
        </div>
        
        <div class="challenge-toggle">
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
            <input
              type="checkbox"
              :checked="controlPoint.hasCodeChallenge"
              @change="handleToggleCodeChallenge"
            />
            <span>🔢 Code Challenge</span>
          </label>
        </div>
        
        <div class="challenge-toggle">
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
            <input
              type="checkbox"
              :checked="controlPoint.hasBombChallenge"
              @change="handleToggleBombChallenge"
            />
            <span>💣 Bomb Challenge</span>
          </label>
        </div>
      </div>
      
      <div class="action-buttons" style="margin-top: 15px; display: flex; gap: 5px; justify-content: space-between">
        <button 
          @click="handleMove" 
          class="btn btn-move" 
          title="Mover punto"
          style="background: rgba(33, 150, 243, 0.2); border: 1px solid #2196F3; color: #2196F3; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer"
        >
          Mover
        </button>
        <button 
          @click="handleUpdate" 
          class="btn btn-primary" 
          style="background: #2196F3; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer"
        >
          Actualizar
        </button>
        <button 
          @click="handleDelete" 
          class="btn btn-danger" 
          style="background: #F44336; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer"
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ControlPoint, Game, TeamColor } from '../types/index.js'

interface Props {
  controlPoint: ControlPoint
  markerId: number
  game?: Game
  onUpdate?: (controlPointId: number, markerId: number) => void
  onDelete?: (controlPointId: number, markerId: number) => void
  onMove?: (controlPointId: number, markerId: number) => void
  onAssignTeam?: (controlPointId: number, team: string) => void
  onTogglePositionChallenge?: (controlPointId: number) => void
  onToggleCodeChallenge?: (controlPointId: number) => void
  onToggleBombChallenge?: (controlPointId: number) => void
  onClose?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  onUpdate: () => {},
  onDelete: () => {},
  onMove: () => {},
  onAssignTeam: () => {},
  onTogglePositionChallenge: () => {},
  onToggleCodeChallenge: () => {},
  onToggleBombChallenge: () => {},
  onClose: () => {}
})

// Get available teams based on game team count
const availableTeams = computed(() => {
  const teamCount = props.game?.teamCount || 4 // Default to 4 teams if not specified
  const allTeams: TeamColor[] = ['blue', 'red', 'green', 'yellow']
  return allTeams.slice(0, teamCount)
})

const getTeamColor = (team: string | null): string => {
  const colors: Record<string, string> = {
    'blue': '#2196F3',
    'red': '#F44336',
    'green': '#4CAF50',
    'yellow': '#FFEB3B',
    'none': '#9E9E9E'
  }
  return colors[team || 'none'] || '#9E9E9E'
}

const getTeamName = (team: string): string => {
  const teamNames: Record<string, string> = {
    'blue': 'Azul',
    'red': 'Rojo',
    'green': 'Verde',
    'yellow': 'Amarillo',
    'none': 'Ninguno'
  }
  return teamNames[team] || team
}

const handleUpdate = () => {
  props.onUpdate(props.controlPoint.id, props.markerId)
}

const handleDelete = () => {
  props.onDelete(props.controlPoint.id, props.markerId)
}

const handleMove = () => {
  props.onMove(props.controlPoint.id, props.markerId)
}

const handleAssignTeam = (team: string) => {
  props.onAssignTeam(props.controlPoint.id, team)
}

const handleTogglePositionChallenge = () => {
  props.onTogglePositionChallenge(props.controlPoint.id)
}

const handleToggleCodeChallenge = () => {
  props.onToggleCodeChallenge(props.controlPoint.id)
}

const handleToggleBombChallenge = () => {
  props.onToggleBombChallenge(props.controlPoint.id)
}

const handleTypeChange = (event: Event) => {
  // Type change would be handled by the parent component
}

const handleNameChange = (event: Event) => {
  // Name change would be handled by the parent component
}

const handleClose = () => {
  props.onClose()
}
</script>

<style scoped>
.control-point-edit-menu {
  min-width: 280px;
  max-width: 320px;
}

.control-point-edit-content {
  padding: 10px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.edit-title {
  margin: 0;
  color: #333;
  font-size: 16px;
  font-weight: bold;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.btn-close:hover {
  color: #333;
}

.form-group {
  margin-bottom: 12px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #666;
  font-weight: bold;
}

.form-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  box-sizing: border-box;
}

.team-buttons {
  display: flex;
  gap: 5px;
  margin-top: 5px;
  flex-wrap: wrap;
}

.challenge-toggle {
  margin-bottom: 8px;
}

.challenge-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #333;
}

.challenge-toggle input[type="checkbox"] {
  margin: 0;
}

.action-buttons {
  margin-top: 15px;
  display: flex;
  gap: 5px;
  justify-content: space-between;
}

.btn {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn:hover {
  opacity: 0.8;
}
</style>