import { ref, watch } from 'vue'
import type { BombTimeUpdateEvent, ActiveBombTimersEvent } from '../types/websocket-events'

export interface BombTimerData {
  controlPointId: number
  remainingTime: number
  totalTime: number
  isActive: boolean
  activatedByUserId?: number
  activatedByUserName?: string
  activatedByTeam?: string
}

export const useBombTimers = (currentGame?: any) => {
  const activeBombTimers = ref<Map<number, BombTimerData>>(new Map())
  let localTimer: NodeJS.Timeout | null = null
  const isPaused = ref(false)

  // Clean up timer on unmount
  const cleanup = () => {
    if (localTimer) {
      clearInterval(localTimer)
      localTimer = null
    }
  }

  // Handle bomb time updates from server - ALWAYS replace with server value
  const handleBombTimeUpdate = (data: BombTimeUpdateEvent) => {
    // Always use server values directly - replace local state completely
    const bombTimerData: BombTimerData = {
      controlPointId: data.controlPointId,
      remainingTime: data.remainingTime,
      totalTime: data.totalTime,
      isActive: data.isActive,
      activatedByUserId: data.activatedByUserId,
      activatedByUserName: data.activatedByUserName,
      activatedByTeam: data.activatedByTeam
    }

    // Update the active bomb timers with server data
    activeBombTimers.value.set(data.controlPointId, bombTimerData)

    // Update bomb timer display immediately
    updateBombTimerDisplay(data.controlPointId)

    // Start or stop local timer based on active bombs and game state
    const hasActiveBombs = Array.from(activeBombTimers.value.values()).some(timer => timer.isActive)
    
    if (hasActiveBombs && !localTimer && currentGame?.value?.status === 'running') {
      startBombTimerInterval()
    } else if (!hasActiveBombs && localTimer) {
      stopBombTimerInterval()
    }
  }

  // Handle active bomb timers response - ALWAYS replace with server values
  const handleActiveBombTimers = (serverBombTimers: ActiveBombTimersEvent['timers']) => {
    const newTimers = new Map<number, BombTimerData>()
    
    if (serverBombTimers && Array.isArray(serverBombTimers)) {
      serverBombTimers.forEach(bombTimer => {
        newTimers.set(bombTimer.controlPointId, {
          controlPointId: bombTimer.controlPointId,
          remainingTime: bombTimer.remainingTime,
          totalTime: bombTimer.totalTime,
          isActive: bombTimer.isActive,
          activatedByUserId: bombTimer.activatedByUserId,
          activatedByUserName: bombTimer.activatedByUserName,
          activatedByTeam: bombTimer.activatedByTeam
        })
      })
    }
    
    activeBombTimers.value = newTimers

    // Update all bomb timer displays
    updateAllBombTimerDisplays()

    // Start or stop local timer based on active bombs and game state
    const hasActiveBombs = Array.from(newTimers.values()).some(timer => timer.isActive)
    
    if (hasActiveBombs && !localTimer && currentGame?.value?.status === 'running') {
      startBombTimerInterval()
    } else if (!hasActiveBombs && localTimer) {
      stopBombTimerInterval()
    }
  }

  // Update bomb timer display for a specific control point
  const updateBombTimerDisplay = (controlPointId: number) => {
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`)
    const bombTimerData = activeBombTimers.value.get(controlPointId)
    
    if (!bombTimerElement) {
      console.error(`[BOMB_TIMER] Bomb timer element not found for control point ${controlPointId}`)
      return
    }

    // Show bomb timer only if bomb is active AND game is running
    const shouldShow = bombTimerData?.isActive && currentGame?.value?.status === 'running'
    
    if (shouldShow) {
      // Validate bomb timer data
      if (typeof bombTimerData.remainingTime !== 'number' || isNaN(bombTimerData.remainingTime)) {
        console.error(`[BOMB_TIMER] Invalid remainingTime for control point ${controlPointId}:`, bombTimerData.remainingTime)
        bombTimerElement.style.display = 'none'
        return
      }

      // Format time as MM:SS
      const minutes = Math.floor(bombTimerData.remainingTime / 60)
      const seconds = bombTimerData.remainingTime % 60
      const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      
      bombTimerElement.textContent = timeText
      bombTimerElement.style.display = 'block'
      
      // Show warning colors when time is running low
      if (bombTimerData.remainingTime <= 60) {
        bombTimerElement.style.background = 'rgba(244, 67, 54, 0.9)'
      } else if (bombTimerData.remainingTime <= 180) {
        bombTimerElement.style.background = 'rgba(255, 152, 0, 0.9)'
      } else {
        bombTimerElement.style.background = 'rgba(255, 87, 34, 0.9)'
      }
    } else {
      bombTimerElement.style.display = 'none'
    }
  }

  // Update all bomb timer displays
  const updateAllBombTimerDisplays = () => {
    // Hide all bomb timers first
    activeBombTimers.value.forEach((bombTimer, controlPointId) => {
      const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`)
      if (bombTimerElement) {
        bombTimerElement.style.display = 'none'
      }
    })

    // Show bomb timers for active bombs only if game is running
    activeBombTimers.value.forEach((bombTimer, controlPointId) => {
      if (bombTimer.isActive && currentGame?.value?.status === 'running') {
        updateBombTimerDisplay(controlPointId)
      }
    })
  }

  // Start local timer interval for smooth countdown
  const startBombTimerInterval = () => {
    if (localTimer) {
      clearInterval(localTimer)
    }

    localTimer = setInterval(() => {
      // Only decrement timers if game is running and not paused
      if (currentGame?.value?.status === 'running' && !isPaused.value) {
        // Decrement all active bomb timers by 1 second
        const newTimers = new Map<number, BombTimerData>()
        let hasActiveBombs = false

        activeBombTimers.value.forEach((bombTimer, controlPointId) => {
          if (bombTimer.isActive && bombTimer.remainingTime > 0) {
            const newRemainingTime = bombTimer.remainingTime - 1
            newTimers.set(controlPointId, {
              ...bombTimer,
              remainingTime: newRemainingTime
            })
            hasActiveBombs = true
          } else if (bombTimer.isActive && bombTimer.remainingTime <= 0) {
            // Bomb timer expired - keep it but mark as inactive
            newTimers.set(controlPointId, {
              ...bombTimer,
              isActive: false
            })
          } else {
            newTimers.set(controlPointId, bombTimer)
          }
        })

        // Update the active bomb timers
        activeBombTimers.value = newTimers

        // Stop timer if no more active bombs
        if (!hasActiveBombs && localTimer) {
          stopBombTimerInterval()
        }

        // Update all bomb timer displays immediately
        updateAllBombTimerDisplays()
      }
    }, 1000)
  }

  // Stop local timer interval
  const stopBombTimerInterval = () => {
    if (localTimer) {
      clearInterval(localTimer)
      localTimer = null
    }
  }

  // Pause bomb timer interval
  const pauseBombTimer = () => {
    isPaused.value = true
  }

  // Resume bomb timer interval
  const resumeBombTimer = () => {
    isPaused.value = false
  }

  // Handle game state changes
  const handleGameStateChange = (game: any) => {
    if (game.status === 'paused') {
      pauseBombTimer()
    } else if (game.status === 'running') {
      resumeBombTimer()
      
      // Check if we need to start the timer when game resumes
      const hasActiveBombs = Array.from(activeBombTimers.value.values()).some(timer => timer.isActive)
      if (hasActiveBombs && !localTimer) {
        startBombTimerInterval()
      }
    } else if (game.status === 'stopped' || game.status === 'finished') {
      stopBombTimerInterval()
      // Clear all bomb timers when game stops
      activeBombTimers.value.clear()
      updateAllBombTimerDisplays()
    }
  }

  // Request active bomb timers
  const requestActiveBombTimers = (socket: any, gameId: number) => {
    if (socket) {
      socket.emit('getActiveBombTimers', { gameId })
    }
  }

  // Setup WebSocket listeners
  const setupBombTimerListeners = (socket: any) => {
    if (!socket) return

    socket.on('bombTimeUpdate', handleBombTimeUpdate)
    socket.on('activeBombTimers', handleActiveBombTimers)

    return () => {
      socket.off('bombTimeUpdate', handleBombTimeUpdate)
      socket.off('activeBombTimers', handleActiveBombTimers)
    }
  }

  // Watch for currentGame changes to handle page refreshes
  if (currentGame) {
    watch(() => currentGame.value?.status, (newStatus: string, oldStatus: string) => {
      if (newStatus === 'running' && oldStatus !== 'running') {
        // Game just started or resumed - check if we need to start bomb timer
        const hasActiveBombs = Array.from(activeBombTimers.value.values()).some(timer => timer.isActive)
        if (hasActiveBombs && !localTimer) {
          startBombTimerInterval()
        }
      }
    })
  }

  return {
    activeBombTimers,
    handleBombTimeUpdate,
    handleActiveBombTimers,
    updateBombTimerDisplay,
    updateAllBombTimerDisplays,
    requestActiveBombTimers,
    setupBombTimerListeners,
    handleGameStateChange,
    pauseBombTimer,
    resumeBombTimer,
    cleanup
  }
}