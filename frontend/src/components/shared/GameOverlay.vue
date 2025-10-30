<template>
  <div class="game-panel game-overlay-panel">
    <div class="game-info">
      <div class="game-title-container">
        <div v-if="!isEditingGameName" class="game-name-display">
          <h2>{{ currentGame.name }}</h2>
          <span v-if="isOwner" class="edit-pencil" @click="enableGameNameEdit" title="Editar nombre del juego">
            ✏️
          </span>
        </div>
        <div v-else class="game-name-edit">
          <input
            ref="gameNameInput"
            v-model="editedGameName"
            @keyup.enter="saveGameName"
            @keyup.esc="cancelGameNameEdit"
            @blur="saveGameName"
            class="game-name-input"
            type="text"
            maxlength="50"
          />
          <div class="edit-actions">
            <button @click="saveGameName" class="btn-save" title="Guardar">✓</button>
            <button @click="cancelGameNameEdit" class="btn-cancel" title="Cancelar">✕</button>
          </div>
        </div>
      </div>
      <div class="game-details">
        <div>
          Estado: <span>{{ getStatusText(currentGame.status) }}</span>
        </div>
        <div>
          Jugadores: <span>{{ currentGame.activeConnections || 0 }}</span>
        </div>
        <div>
          Propietario: <span>{{ currentUser.name }}</span>
        </div>
        <div>
          Usuario: <span>{{ currentUser.name }}</span>
        </div>
        
        <!-- Timer display for running and paused states -->
        <div v-if="currentGame.status === 'running' || currentGame.status === 'paused'">
          Tiempo: <span>{{ formatTime(currentGame.playedTime) }}</span>
        </div>
        <div v-if="(currentGame.status === 'running' || currentGame.status === 'paused') && currentGame.totalTime && currentGame.totalTime > 0">
          Restante: <span>{{ formatTime(currentGame.remainingTime) }}</span>
        </div>
      </div>
    </div>
    
    

    <!-- Time selector for stopped state - Only for owner -->
    <div v-if="currentGame.status === 'stopped' && isOwner" class="time-select-container">
      <label class="panel-label">Tiempo:</label>
      <select
        class="panel-select"
        v-model="selectedTime"
        @change="handleTimeSelect"
      >
        <option value="20">20 seg (test)</option>
        <option value="300">5 min</option>
        <option value="600">10 min</option>
        <option value="1200">20 min</option>
        <option value="3600">1 hora</option>
        <option value="0">indefinido</option>
      </select>
    </div>

    <!-- +1, -1, and INF buttons for owner when game is running or paused -->
    <div v-if="(currentGame.status === 'running' || currentGame.status === 'paused') && isOwner" class="time-buttons-container">
      <button
        class="add-time-btn"
        @click="addOneMinute"
        title="Agregar 1 minuto al tiempo total"
      >
        +1
      </button>
      <button
        class="remove-time-btn"
        @click="removeOneMinute"
        title="Quitar 1 minuto al tiempo total"
      >
        -1
      </button>
      <button
        class="inf-time-btn"
        @click="setTimeUndefined"
        title="Establecer tiempo indefinido"
      >
        ∞
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Game } from '../../types/index.js'
import { useToast } from '../../composables/useToast.js'
import { ref, watch, nextTick } from 'vue'

const { addToast } = useToast()

const props = defineProps<{
  currentUser: User
  currentGame: Game
  gpsStatus: string
  isOwner?: boolean
}>()

const emit = defineEmits<{
  timeSelect: [timeInSeconds: number]
}>()

const selectedTime = ref<string>('')
const isUserSelecting = ref(false)
const lastGameId = ref<string | number | null>(null)
const isEditingGameName = ref(false)
const editedGameName = ref('')
const gameNameInput = ref<HTMLInputElement | null>(null)

// Initialize selectedTime with current game totalTime when component mounts
if (props.currentGame?.totalTime !== undefined && props.currentGame?.totalTime !== null) {
  selectedTime.value = props.currentGame.totalTime.toString()
} else {
  selectedTime.value = '0' // indefinite time
}

// Watch for game instance changes to reset selection state
watch(() => props.currentGame?.id, (newGameId) => {
  if (newGameId && newGameId !== lastGameId.value) {
    lastGameId.value = newGameId
    isUserSelecting.value = false // Reset selection flag on new game instance
  }
})

// Watch for changes in currentGame.totalTime to keep dropdown synchronized
// Always update when game.totalTime changes, regardless of user selection
watch(() => props.currentGame?.totalTime, (newTotalTime) => {
  const currentGameId = props.currentGame?.id
  
  // Always update when game instance changes (restart/new game)
  if (currentGameId !== lastGameId.value) {
    lastGameId.value = currentGameId
    isUserSelecting.value = false
  }
  
  // Always update the dropdown to reflect the current game.totalTime
  // This ensures the dropdown is always synchronized with the game state
  if (newTotalTime !== undefined && newTotalTime !== null) {
    selectedTime.value = newTotalTime.toString()
  } else {
    // Handle null/undefined (indefinite time) - use '0' which corresponds to "indefinido" option
    selectedTime.value = '0'
  }
}, { immediate: true })

// Also watch for the entire currentGame object to handle initial load
watch(() => props.currentGame, (newGame) => {
  if (newGame) {
    // Update selectedTime when the game object is first loaded
    if (newGame.totalTime !== undefined && newGame.totalTime !== null) {
      selectedTime.value = newGame.totalTime.toString()
    } else {
      selectedTime.value = '0' // indefinite time
    }
  }
}, { immediate: true })

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    stopped: 'Iniciando',
    running: 'Jugando',
    paused: 'Pausado',
    finished: 'Finalizado'
  }
  return statusMap[status] || status
}

const enableGameNameEdit = async () => {
  if (!props.isOwner) return
  
  editedGameName.value = props.currentGame.name
  isEditingGameName.value = true
  
  await nextTick()
  if (gameNameInput.value) {
    gameNameInput.value.focus()
    gameNameInput.value.select()
  }
}

const saveGameName = () => {
  if (!props.isOwner) return
  
  const trimmedName = editedGameName.value.trim()
  if (!trimmedName) {
    addToast({ message: 'El nombre del juego no puede estar vacío', type: 'error' })
    return
  }
  
  if (trimmedName === props.currentGame.name) {
    isEditingGameName.value = false
    return
  }
  
  // Emit game action to update the name
  const gameActionData = {
    action: 'updateGameName',
    data: { name: trimmedName }
  }
  
  // Use global window object to access emitGameAction from parent component
  if (window.emitGameAction) {
    window.emitGameAction(props.currentGame.id, 'updateGameName', { name: trimmedName })
    addToast({ message: 'Nombre del juego actualizado', type: 'success' })
  } else {
    console.error('emitGameAction not available')
    addToast({ message: 'Error al actualizar el nombre', type: 'error' })
  }
  
  isEditingGameName.value = false
}

const cancelGameNameEdit = () => {
  isEditingGameName.value = false
  editedGameName.value = ''
}

const handleTimeSelect = () => {
  isUserSelecting.value = true
  const timeInSeconds = parseInt(selectedTime.value)
  emit('timeSelect', timeInSeconds)
  
  // Reset the flag after a short delay to allow server updates
  setTimeout(() => {
    isUserSelecting.value = false
  }, 1000)
}

const formatTime = (seconds: number): string => {
  // Handle null, undefined, or invalid values
  if (seconds === null || seconds === undefined || seconds < 0) return '0:00'
  
  // Ensure seconds is a valid number
  const validSeconds = Math.max(0, Math.floor(Number(seconds)))
  
  const hours = Math.floor(validSeconds / 3600)
  const minutes = Math.floor((validSeconds % 3600) / 60)
  const remainingSeconds = validSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

const addOneMinute = () => {
  if (!props.isOwner) return
  
  // Use global window object to access emitGameAction from parent component
  if (window.emitGameAction) {
    window.emitGameAction(props.currentGame.id, 'addTime', { seconds: 60 })
    addToast({ message: 'Se agregó 1 minuto al tiempo total', type: 'success' })
  } else {
    console.error('emitGameAction not available')
    addToast({ message: 'Error al agregar tiempo', type: 'error' })
  }
}

const removeOneMinute = () => {
  if (!props.isOwner) return
  
  // Use global window object to access emitGameAction from parent component
  if (window.emitGameAction) {
    window.emitGameAction(props.currentGame.id, 'removeTime', { seconds: 60 })
    addToast({ message: 'Se quitó 1 minuto al tiempo total', type: 'success' })
  } else {
    console.error('emitGameAction not available')
    addToast({ message: 'Error al quitar tiempo', type: 'error' })
  }
}

const setTimeUndefined = () => {
  if (!props.isOwner) return
  
  // Use global window object to access emitGameAction from parent component
  if (window.emitGameAction) {
    window.emitGameAction(props.currentGame.id, 'setTimeUndefined', {})
    addToast({ message: 'Tiempo establecido como indefinido', type: 'success' })
  } else {
    console.error('emitGameAction not available')
    addToast({ message: 'Error al establecer tiempo indefinido', type: 'error' })
  }
}
</script>

<style scoped>
.time-select-container {
  margin-top: var(--spacing-md);
}

.game-title-container {
  position: relative;
  margin-bottom: var(--spacing-md);
}

.game-name-display {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.game-name-display h2 {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--success);
}

.edit-pencil {
  cursor: pointer;
  font-size: var(--font-size-sm);
  opacity: 0.7;
  transition: opacity 0.2s;
  user-select: none;
}

.edit-pencil:hover {
  opacity: 1;
}

.game-name-edit {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.game-name-input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: bold;
  width: 200px;
  outline: none;
  background-color: var(--surface);
  color: var(--text-primary);
}

.game-name-input:focus {
  border-color: var(--info);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.25);
}

.edit-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.btn-save, .btn-cancel {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background-color 0.2s;
}

.btn-save {
  background-color: var(--success);
  color: var(--text-primary);
}

.btn-save:hover {
  background-color: var(--success-dark);
}

.btn-cancel {
  background-color: var(--danger);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background-color: var(--danger-dark);
}

.time-buttons-container {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: center;
  gap: var(--spacing-md);
}

.add-time-btn {
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--success);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: bold;
  transition: background-color 0.2s;
}

.add-time-btn:hover {
  background-color: var(--success-dark);
}

.add-time-btn:active {
  background-color: var(--success-dark);
}

.remove-time-btn {
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--danger);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: bold;
  transition: background-color 0.2s;
}

.remove-time-btn:hover {
  background-color: var(--danger-dark);
}

.remove-time-btn:active {
  background-color: var(--danger-dark);
}

.inf-time-btn {
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--text-muted);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: bold;
  transition: background-color 0.2s;
}

.inf-time-btn:hover {
  background-color: var(--text-muted);
}

.inf-time-btn:active {
  background-color: var(--text-muted);
}
.game-details {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.game-details div {
  margin-bottom: var(--spacing-sm);
  color: var(--text-primary);
}

.game-details span {
  color: var(--text-secondary);
  font-weight: 500;
}
</style>