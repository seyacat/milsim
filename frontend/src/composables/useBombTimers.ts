import { ref, onUnmounted } from 'vue'

export interface BombTimerData {
  controlPointId: number
  remainingTime: number
  isActive: boolean
}

export const useBombTimers = (currentGame?: any) => {
  const activeBombTimers = ref<Map<number, BombTimerData>>(new Map())
  let localTimer: NodeJS.Timeout | null = null

  // Clean up timer on unmount
  const cleanup = () => {
    if (localTimer) {
      clearInterval(localTimer)
      localTimer = null
    }
  }

  // Handle bomb time updates from server
  const handleBombTimeUpdate = (data: BombTimerData) => {
    // Update the active bomb timers
    activeBombTimers.value.set(data.controlPointId, data)

    // Update bomb timer display immediately
    updateBombTimerDisplay(data.controlPointId, currentGame)

    // Start or stop local timer based on active bombs
    if (data.isActive && !localTimer) {
      startBombTimerInterval()
    } else if (!data.isActive) {
      // Check if there are any active bombs after this update
      setTimeout(() => {
        const hasActiveBombs = Array.from(activeBombTimers.value.values()).some(timer => timer.isActive)
        if (!hasActiveBombs && localTimer) {
          stopBombTimerInterval()
        }
      }, 0)
    }
  }

  // Handle active bomb timers response
  const handleActiveBombTimers = (serverBombTimers: BombTimerData[]) => {
    const newTimers = new Map<number, BombTimerData>()
    
    if (serverBombTimers && Array.isArray(serverBombTimers)) {
      serverBombTimers.forEach(bombTimer => {
        newTimers.set(bombTimer.controlPointId, bombTimer)
      })
    }
    
    activeBombTimers.value = newTimers

    // Update all bomb timer displays
    updateAllBombTimerDisplays(currentGame)

    // Start or stop local timer based on active bombs
    const hasActiveBombs = Array.from(newTimers.values()).some(timer => timer.isActive)
    
    if (hasActiveBombs && !localTimer) {
      startBombTimerInterval()
    } else if (!hasActiveBombs && localTimer) {
      stopBombTimerInterval()
    }
  }

  // Update bomb timer display for a specific control point
  const updateBombTimerDisplay = (controlPointId: number, currentGame: any = null) => {
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`)
    const bombTimerData = activeBombTimers.value.get(controlPointId)
    
    if (!bombTimerElement) {
      console.error(`[BOMB_TIMER] Bomb timer element not found for control point ${controlPointId}`)
      return
    }

    // Show bomb timer only if bomb is active AND game is NOT stopped
    // Hide bomb timers only when game is stopped
    const shouldShow = bombTimerData?.isActive && currentGame?.status !== 'stopped'
    
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
  const updateAllBombTimerDisplays = (currentGame: any = null) => {
    // Hide all bomb timers first
    activeBombTimers.value.forEach((bombTimer, controlPointId) => {
      const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`)
      if (bombTimerElement) {
        bombTimerElement.style.display = 'none'
      }
    })

    // Show bomb timers for active bombs only if game is NOT stopped
    // Hide bomb timers only when game is stopped
    activeBombTimers.value.forEach((bombTimer, controlPointId) => {
      if (bombTimer.isActive && currentGame?.status !== 'stopped') {
        updateBombTimerDisplay(controlPointId, currentGame)
      }
    })
  }

  // Start local timer interval for smooth countdown
  const startBombTimerInterval = () => {
    if (localTimer) {
      clearInterval(localTimer)
    }

    localTimer = setInterval(() => {
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
      updateAllBombTimerDisplays(currentGame)
    }, 1000)
  }

  // Stop local timer interval
  const stopBombTimerInterval = () => {
    if (localTimer) {
      clearInterval(localTimer)
      localTimer = null
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

  // Clean up timer on unmount - only if we're in a component context
  try {
    onUnmounted(() => {
      cleanup()
    })
  } catch (error) {
    // If onUnmounted fails, it means we're not in a component context
    // We'll handle cleanup manually when needed
  }

  return {
    activeBombTimers,
    handleBombTimeUpdate,
    handleActiveBombTimers,
    updateBombTimerDisplay,
    updateAllBombTimerDisplays,
    requestActiveBombTimers,
    setupBombTimerListeners
  }
}