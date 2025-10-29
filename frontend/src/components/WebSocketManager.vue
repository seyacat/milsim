<template>
  <!-- This component doesn't render anything, it just manages WebSocket connections -->
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useWebSocket } from '../composables/useWebSocket.js'
import { useToast } from '../composables/useToast.js'
import { useControlPointTimers } from '../composables/useControlPointTimers.js'
import { useBombTimers } from '../composables/useBombTimers.js'
import { User, Game, ControlPoint, TeamColor } from '../types/index.js'
import {
  ControlPointTakenEvent,
  BombActivatedEvent,
  BombDeactivatedEvent,
  ControlPointTeamAssignedEvent,
  TimeUpdateEvent,
  GameTimeEvent
} from '../types/websocket-events.js'

interface Props {
  gameId: string
  currentGame: Game | null
  currentUser: User | null
  isOwner: boolean
  mapInstance: any
  playerMarkersComposable: any
  bombTimersComposable: any
  onGameUpdate: (game: Game) => void
  onControlPointCreated: (controlPoint: ControlPoint) => void
  onControlPointUpdated: (controlPoint: ControlPoint) => void
  onControlPointDeleted: (controlPointId: number) => void
  onJoinSuccess: (user: User) => void
  onError: (error: string) => void
  onTeamSelectionChange?: (show: boolean) => void
  onResultsDialogChange?: (show: boolean) => void
  onPositionChallengeUpdate?: (controlPointId: number, teamPoints: Record<string, number>) => void
}

const props = defineProps<Props>()

const { addToast } = useToast()
const {
  socketRef,
  connectWebSocket,
  emitGameAction,
  disconnectWebSocket,
  checkConnection,
  forceReconnect
} = useWebSocket()

const {
  updateControlPointTimes,
  updateIndividualControlPointTime,
  updateAllTimerDisplays,
  handleGameStateChange,
  stopControlPointTimerInterval
} = useControlPointTimers()


// Local timer state
const localTimerInterval = ref<NodeJS.Timeout | null>(null)
const lastTimeUpdate = ref<Date | null>(null)
const connectionHealthInterval = ref<NodeJS.Timeout | null>(null)

// Local timer functions
const startLocalTimer = () => {
  stopLocalTimer()
  
  localTimerInterval.value = setInterval(() => {
    if (props.currentGame && props.currentGame.status === 'running') {
      // Create a copy of the current game with updated time values
      const updatedGame = { ...props.currentGame }
      
      // Always increment played time locally by 1 second
      // Server updates will override this value when received
      if (updatedGame.playedTime !== undefined && updatedGame.playedTime !== null) {
        updatedGame.playedTime += 1
      } else {
        updatedGame.playedTime = 1
      }
      
      // Decrement remaining time if it exists and is not null
      if (updatedGame.remainingTime !== undefined && updatedGame.remainingTime !== null) {
        updatedGame.remainingTime = Math.max(0, updatedGame.remainingTime - 1)
      }
      
      // Call the parent handler to update the game state
      props.onGameUpdate(updatedGame)
    }
  }, 1000)
}

const stopLocalTimer = () => {
  if (localTimerInterval.value) {
    clearInterval(localTimerInterval.value)
    localTimerInterval.value = null
  }
}

const updateLocalTimerFromServer = (data: TimeUpdateEvent | GameTimeEvent) => {
  // Update last time update timestamp
  lastTimeUpdate.value = new Date()
  
  // Log timer update from server
  console.log('[TIMER_DEBUG] Server timer update received:', {
    remainingTime: data.remainingTime,
    playedTime: data.playedTime,
    totalTime: data.totalTime,
    currentGameStatus: props.currentGame?.status
  })
  
  // Update game state with server data - ALWAYS use server values directly
  if (props.currentGame) {
    // Create a copy of the current game with updated time values
    const updatedGame = { ...props.currentGame }
    
    // Always use server values when provided, with proper null handling
    if (data.remainingTime !== undefined) {
      updatedGame.remainingTime = data.remainingTime
    }
    if (data.totalTime !== undefined) {
      updatedGame.totalTime = data.totalTime
    }
    if (data.playedTime !== undefined) {
      updatedGame.playedTime = data.playedTime
    } else {
      // Ensure playedTime always has a value
      updatedGame.playedTime = updatedGame.playedTime || 0
    }
    
    // Call the parent handler to update the game state
    props.onGameUpdate(updatedGame)
  }
}

// WebSocket event handlers
const handleGameUpdate = (game: Game) => {
  const previousStatus = props.currentGame?.status
  
  // Log game state change
  console.log('[GAME_STATE_DEBUG] Game state change:', {
    previousStatus,
    newStatus: game.status,
    timerValues: {
      remainingTime: game.remainingTime,
      playedTime: game.playedTime,
      totalTime: game.totalTime
    }
  })
  
  // Call the parent handler to update the game state
  props.onGameUpdate(game)
  handleGameStateChange(game)
  props.bombTimersComposable?.handleGameStateChange(game)
  
  // Timer displays are updated by the local timer interval in useControlPointTimers
  // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
  
  // Handle local timer based on game status
  if (game.status === 'running') {
    console.log('[TIMER_DEBUG] Starting local timer - game is running')
    startLocalTimer()
  } else {
    console.log('[TIMER_DEBUG] Stopping local timer - game status:', game.status)
    stopLocalTimer()
  }
  
  // Timer displays are updated by Game.vue after game state changes
  
  // Show results dialog automatically when game is finished for all users
  if (game.status === 'finished') {
    props.onResultsDialogChange?.(true)
    stopLocalTimer()
  }

  // Close results dialog when game transitions from finished to stopped (restart)
  if (previousStatus === 'finished' && game.status === 'stopped') {
    props.onResultsDialogChange?.(false)
    
    // Clear all bomb timers completely when game transitions from finished to stopped
    props.bombTimersComposable?.clearAllBombTimers()
    
    // Timer displays are updated by the local timer interval in useControlPointTimers
    // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
  }

  // Show team selection when game transitions to stopped state and player doesn't have a team
  if (!props.isOwner && game.status === 'stopped') {
    const currentPlayer = game.players?.find(p => p.user?.id === props.currentUser?.id)
    const hasTeam = currentPlayer?.team && currentPlayer.team !== 'none'
    
    if (!hasTeam) {
      props.onTeamSelectionChange?.(true)
    }
  } else if (game.status !== 'stopped') {
    // Hide team selection when game is not in stopped state
    props.onTeamSelectionChange?.(false)
  }

  // Clear bomb timers when game transitions to stopped state (not from finished)
  if (game.status === 'stopped' && previousStatus !== 'finished') {
    props.bombTimersComposable?.clearAllBombTimers()
  }

  // Close team selection dialog when game transitions from stopped to running
  if (previousStatus === 'stopped' && game.status === 'running') {
    props.onTeamSelectionChange?.(false)
    
    // Ensure all bomb timers are cleared when new game starts
    props.bombTimersComposable?.clearAllBombTimers()
  }
}

const handleGameTime = (data: GameTimeEvent | any) => {
  
  // Update local timer with server data
  updateLocalTimerFromServer(data)
  
  // Handle control point timer updates from server
  // Support both formats: array of control point times AND individual control point updates
  if (data.controlPointTimes && Array.isArray(data.controlPointTimes)) {
    // Format: array of control point times from gameTime/timeUpdate events
    updateControlPointTimes(data.controlPointTimes, props.currentGame)
  } else if (data.controlPointId && data.currentHoldTime !== undefined) {
    // Format: individual control point time update from controlPointTimeUpdate events
    updateIndividualControlPointTime(data.controlPointId, data.currentHoldTime, data.currentTeam)
  } else {
  }
  
  // Timer displays are updated by the local timer interval in useControlPointTimers
  // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
}


const handleTimeUpdate = (data: TimeUpdateEvent) => {
  console.log('[TIMER_DEBUG] TimeUpdate event received:', {
    remainingTime: data.remainingTime,
    playedTime: data.playedTime,
    totalTime: data.totalTime,
    currentGameStatus: props.currentGame?.status
  })
  
  // Update local timer with server data - ALWAYS use server values
  updateLocalTimerFromServer(data)
  
  // Handle control point timer updates from server
  if (data.controlPointTimes && Array.isArray(data.controlPointTimes)) {
    updateControlPointTimes(data.controlPointTimes, props.currentGame)
  }
  
  // Timer displays are updated by the local timer interval in useControlPointTimers
  // Do NOT call updateAllTimerDisplays here to avoid duplicate updates
}

const handleBombTimeUpdate = (data: any) => {
  props.bombTimersComposable?.handleBombTimeUpdate(data)
}

const handleActiveBombTimers = (data: any) => {
  props.bombTimersComposable?.handleActiveBombTimers(data)
}

const handlePositionChallengeUpdate = (data: any) => {
  console.log('[WebSocketManager] handlePositionChallengeUpdate received:', data)
  if (data.controlPointId && data.teamPoints) {
    props.onPositionChallengeUpdate?.(data.controlPointId, data.teamPoints)
  } else {
    console.log('POSITION_CHALLENGE_UPDATE missing required data:', data)
  }
}

const handleControlPointTeamAssigned = (data: ControlPointTeamAssignedEvent) => {
  if (data.controlPoint) {
    // Call the parent handler for control point updates
    props.onControlPointUpdated(data.controlPoint)
  } else {
    console.log('WebSocketManager - Control point team assigned - no controlPoint in data')
  }
}

const handleControlPointTaken = (data: ControlPointTakenEvent) => {
  
  // The control point data is directly in data.controlPoint (not nested)
  const controlPointData = data.controlPoint
  
  
  if (!controlPointData) {
    return
  }

  // Validate required fields
  if (!controlPointData.id || !controlPointData.name || !controlPointData.latitude || !controlPointData.longitude) {
    console.error('WebSocketManager - Invalid control point data received:', controlPointData)
    return
  }

  // Convert team string to TeamColor with validation
  const validTeams: TeamColor[] = ['blue', 'red', 'green', 'yellow', 'none']
  const teamColor: TeamColor | undefined = data.team && validTeams.includes(data.team as TeamColor)
    ? data.team as TeamColor
    : undefined

  const controlPoint: ControlPoint = {
    id: controlPointData.id,
    name: controlPointData.name,
    description: controlPointData.description || undefined,
    latitude: parseFloat(controlPointData.latitude.toString()),
    longitude: parseFloat(controlPointData.longitude.toString()),
    type: controlPointData.type as 'site' | 'control_point',
    ownedByTeam: teamColor && teamColor !== 'none' ? teamColor : undefined,
    hasBombChallenge: Boolean(controlPointData.hasBombChallenge),
    hasPositionChallenge: Boolean(controlPointData.hasPositionChallenge),
    hasCodeChallenge: Boolean(controlPointData.hasCodeChallenge),
    bombTimer: undefined,
    bombStatus: controlPointData.bombStatus ? {
      isActive: controlPointData.bombStatus.isActive,
      remainingTime: controlPointData.bombStatus.remainingTime || 0,
      totalTime: controlPointData.bombTime || 0,
      activatedByUserId: controlPointData.bombStatus.activatedByUserId,
      activatedByUserName: controlPointData.bombStatus.activatedByUserName,
      activatedByTeam: controlPointData.bombStatus.activatedByTeam
    } : undefined,
    currentTeam: undefined,
    currentHoldTime: undefined,
    displayTime: undefined,
    lastTimeUpdate: undefined,
    minDistance: controlPointData.minDistance || undefined,
    minAccuracy: controlPointData.minAccuracy || undefined,
    code: controlPointData.code || undefined,
    bombTime: controlPointData.bombTime || undefined,
    armedCode: controlPointData.armedCode || undefined,
    disarmedCode: controlPointData.disarmedCode || undefined
  }

  
  // Call the parent handler for control point updates
  props.onControlPointUpdated(controlPoint)
}

const handleBombActivated = (data: BombActivatedEvent) => {
  
  // Find the control point in the current game
  const controlPointData = props.currentGame?.controlPoints?.find(cp => cp.id === data.controlPointId)
  
  if (!controlPointData) {
    return
  }

  // Update the control point with bomb activation status
  const controlPoint: ControlPoint = {
    ...controlPointData,
    bombStatus: {
      isActive: true,
      remainingTime: data.controlPoint?.bombStatus?.remainingTime || controlPointData.bombTime || 300,
      totalTime: controlPointData.bombTime || 300,
      activatedByUserId: data.userId,
      activatedByUserName: data.userName,
      activatedByTeam: data.controlPoint?.ownedByTeam || controlPointData.ownedByTeam
    }
  }

  
  // Call the parent handler for control point updates
  props.onControlPointUpdated(controlPoint)
}

const handleBombDeactivated = (data: BombDeactivatedEvent) => {
  
  // Find the control point in the current game
  const controlPointData = props.currentGame?.controlPoints?.find(cp => cp.id === data.controlPointId)
  
  if (!controlPointData) {
    return
  }

  // Update the control point with bomb deactivation status
  const controlPoint: ControlPoint = {
    ...controlPointData,
    bombStatus: undefined // Clear bomb status when deactivated
  }

  
  // Call the parent handler for control point updates
  props.onControlPointUpdated(controlPoint)
}

// Connection health check with enhanced reconnection logic
const startConnectionHealthCheck = () => {
  stopConnectionHealthCheck()
  connectionHealthInterval.value = setInterval(() => {
    if (socketRef.value && !socketRef.value.connected) {
      
      // Force a full reconnection instead of just checking
      forceReconnect()
      
      // Also try to refresh the game state after reconnection
      setTimeout(() => {
        if (socketRef.value?.connected && props.currentGame) {
          // Request fresh game state to ensure synchronization
          socketRef.value.emit('getGameState', { gameId: props.currentGame.id })
        }
      }, 2000)
    }
  }, 15000) // Check every 15 seconds
}

const stopConnectionHealthCheck = () => {
  if (connectionHealthInterval.value) {
    clearInterval(connectionHealthInterval.value)
    connectionHealthInterval.value = null
  }
}

// Public methods
const connect = () => {
  if (!props.gameId) {
    console.error('WebSocketManager: No gameId provided')
    return
  }

  connectWebSocket(parseInt(props.gameId), {
    onGameUpdate: handleGameUpdate,
    onControlPointCreated: props.onControlPointCreated,
    onControlPointUpdated: props.onControlPointUpdated,
    onControlPointDeleted: props.onControlPointDeleted,
    onJoinSuccess: props.onJoinSuccess,
    onError: props.onError,
    onGameTime: handleGameTime,
    onTimeUpdate: handleTimeUpdate,
    onPlayerPosition: (data: any) => {
      // This callback is handled by usePlayerMarkers composable
      // No need to duplicate the logic here
    },
    onBombTimeUpdate: handleBombTimeUpdate,
    onActiveBombTimers: handleActiveBombTimers,
    onPositionChallengeUpdate: handlePositionChallengeUpdate,
    onControlPointTeamAssigned: handleControlPointTeamAssigned,
    onPlayerTeamUpdated: (data: any) => {
      // This callback is handled by usePlayerMarkers composable
      // No need to duplicate the logic here
    },
    onGameAction: (data: any) => {
      if (data.action === 'playerTeamUpdated' && data.data) {
        console.log('WebSocketManager - Direct gameAction playerTeamUpdated received:', data.data)
      }
    },
    onControlPointTaken: handleControlPointTaken,
    onBombActivated: handleBombActivated,
    onBombDeactivated: handleBombDeactivated
  })

  startConnectionHealthCheck()
}

const disconnect = () => {
  stopConnectionHealthCheck()
  stopLocalTimer()
  disconnectWebSocket()
}

const emitAction = (gameId: number, action: string, data?: any) => {
  return emitGameAction(gameId, action, data)
}

// Watch for gameId changes to reconnect
watch(() => props.gameId, (newGameId, oldGameId) => {
  if (newGameId && newGameId !== oldGameId) {
    disconnect()
    connect()
  }
})

// Watch for currentGame changes to handle timer when game is already running
watch(() => props.currentGame, (newGame, oldGame) => {
  if (newGame && newGame.status === 'running' && (!oldGame || oldGame.status !== 'running')) {
    console.log('[TIMER_DEBUG] Starting local timer on game change - game is running')
    startLocalTimer()
  }
}, { immediate: true })

// Expose public methods
defineExpose({
  socketRef,
  connect,
  disconnect,
  emitAction,
  startLocalTimer,
  stopLocalTimer
})

// Connect WebSocket when component mounts
onMounted(() => {
  if (props.gameId) {
    connect()
  }
  
  // Start local timer if game is already running when component mounts
  if (props.currentGame?.status === 'running') {
    console.log('[TIMER_DEBUG] Starting local timer on mount - game is already running')
    startLocalTimer()
  }
})

onUnmounted(() => {
  disconnect()
})
</script>