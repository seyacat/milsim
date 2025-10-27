import { ref, onUnmounted, watch } from 'vue'
import { Game, ControlPoint } from '../types/index.js'

export interface ControlPointTimeData {
  controlPointId: number
  currentHoldTime: number
  currentTeam: string | null
}

export const useControlPointTimers = () => {
  const controlPointTimes = ref<Record<number, ControlPointTimeData>>({})
  const localTimerRef = ref<NodeJS.Timeout | null>(null)

  // Update control point times when they come from game data
  const updateControlPointTimes = (controlPointTimesFromGameTime: ControlPointTimeData[], currentGame: Game | null) => {
    console.log('[FRONTEND_TIMER_DEBUG] updateControlPointTimes called with:', {
      timesCount: controlPointTimesFromGameTime?.length || 0,
      gameStatus: currentGame?.status,
      times: controlPointTimesFromGameTime
    })
    
    // DEBUG: Check if any control point has currentTeam not null
    const hasNonNullTeams = controlPointTimesFromGameTime?.some(time => time.currentTeam !== null) || false
    console.log('[FRONTEND_TIMER_DEBUG] Has non-null teams:', hasNonNullTeams)
    
    if (controlPointTimesFromGameTime && controlPointTimesFromGameTime.length > 0) {
      // Only update specific control points that changed, don't replace the entire state
      const updated = { ...controlPointTimes.value }
      controlPointTimesFromGameTime.forEach(cpTime => {
        // Only update if we have valid data for this control point
        if (cpTime.controlPointId && cpTime.currentHoldTime !== undefined) {
          updated[cpTime.controlPointId] = cpTime
        }
      })
      controlPointTimes.value = updated

      // Start local timer interval if game is running
      if (currentGame?.status === 'running' && !localTimerRef.value) {
        startControlPointTimerInterval(currentGame)
      }
    }
  }

  // Update individual control point time
  const updateIndividualControlPointTime = (controlPointId: number, currentHoldTime: number, currentTeam: string | null) => {
    const updated = { ...controlPointTimes.value }
    updated[controlPointId] = {
      controlPointId,
      currentHoldTime,
      currentTeam
    }
    controlPointTimes.value = updated
  }

  // Update timer display for a specific control point
  const updateControlPointTimerDisplay = (controlPointId: number, currentGame: Game | null) => {
    const timerElement = document.getElementById(`timer_${controlPointId}`)
    const timeData = controlPointTimes.value[controlPointId]
    
    console.log(`[FRONTEND_TIMER_DEBUG] updateControlPointTimerDisplay for CP ${controlPointId}:`, {
      hasTimerElement: !!timerElement,
      hasTimeData: !!timeData,
      currentTeam: timeData?.currentTeam,
      gameStatus: currentGame?.status
    })
    
    if (!timerElement || !timeData) {
      console.log(`[FRONTEND_TIMER_DEBUG] CP ${controlPointId}: No timer element or time data, hiding timer`)
      if (timerElement) timerElement.style.display = 'none'
      return
    }

    // Show timer only if control point is owned AND game is NOT stopped
    // Hide timers only when game is stopped
    const shouldShow = timeData.currentTeam !== null && currentGame?.status !== 'stopped'
    
    console.log(`[FRONTEND_TIMER_DEBUG] CP ${controlPointId}: shouldShow = ${shouldShow} (currentTeam: ${timeData.currentTeam}, gameStatus: ${currentGame?.status})`)
    
    // Debug logging
    if (currentGame?.status === 'stopped') {
      console.log(`[TIMER_DEBUG] Control point ${controlPointId} in stopped state:`, {
        currentTeam: timeData.currentTeam,
        currentHoldTime: timeData.currentHoldTime,
        shouldShow: shouldShow
      })
    }
    
    
    if (shouldShow) {
      // Format time as MM:SS
      const minutes = Math.floor(timeData.currentHoldTime / 60)
      const seconds = timeData.currentHoldTime % 60
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`
      
      console.log(`[FRONTEND_TIMER_DEBUG] CP ${controlPointId}: Showing timer with text: ${timeText}`)
      timerElement.textContent = timeText
      timerElement.style.display = 'block'
    } else {
      console.log(`[FRONTEND_TIMER_DEBUG] CP ${controlPointId}: Hiding timer`)
      timerElement.style.display = 'none'
    }
  }

  // Update all timer displays
  const updateAllTimerDisplays = (currentGame: Game | null) => {
    console.log('[FRONTEND_TIMER_DEBUG] updateAllTimerDisplays called with game status:', currentGame?.status)
    
    // Get control point IDs from either the game object OR from the stored time data
    let controlPointIds: number[] = []
    
    if (currentGame?.controlPoints && currentGame.controlPoints.length > 0) {
      // Use control points from game object if available
      controlPointIds = currentGame.controlPoints.map(cp => cp.id)
    } else {
      // Fallback: use control point IDs from stored time data
      controlPointIds = Object.keys(controlPointTimes.value).map(id => Number(id))
    }
    
    if (controlPointIds.length === 0) {
      console.log('[FRONTEND_TIMER_DEBUG] No control points to update')
      return
    }
    
    console.log(`[FRONTEND_TIMER_DEBUG] Updating ${controlPointIds.length} control point timers`)
    
    controlPointIds.forEach(controlPointId => {
      updateControlPointTimerDisplay(controlPointId, currentGame)
    })
  }

  // Start local timer interval for smooth updates
  const startControlPointTimerInterval = (currentGame: Game | null) => {
    if (localTimerRef.value) {
      clearInterval(localTimerRef.value)
      localTimerRef.value = null
    }


    localTimerRef.value = setInterval(() => {
      if (currentGame?.status === 'running') {
        // Increment all active control point timers by 1 second
        const updated: Record<number, ControlPointTimeData> = {}
        
        Object.entries(controlPointTimes.value).forEach(([controlPointId, timeData]) => {
          // Only increment timers for control points that are owned
          if (timeData.currentTeam !== null) {
            const newHoldTime = timeData.currentHoldTime + 1
            updated[Number(controlPointId)] = {
              ...timeData,
              currentHoldTime: newHoldTime
            }
          } else {
            updated[Number(controlPointId)] = timeData
          }
        })
        
        controlPointTimes.value = updated
        // Update displays after local timer increment
        updateAllTimerDisplays(currentGame)
      }
    }, 1000)
  }

  // Stop local timer interval
  const stopControlPointTimerInterval = () => {
    if (localTimerRef.value) {
      clearInterval(localTimerRef.value)
      localTimerRef.value = null
    }
  }

  // Handle game state changes
  const handleGameStateChange = (currentGame: Game | null) => {
    if (!currentGame) return


    if (currentGame.status === 'running') {
      // Always restart the timer when game goes to running state
      // This ensures timers resume after pause
      stopControlPointTimerInterval() // Clear any existing timer first
      startControlPointTimerInterval(currentGame)
    } else {
      stopControlPointTimerInterval()
      // Update displays one last time to show current time during pause
      updateAllTimerDisplays(currentGame)
    }
  }

  // Clean up timer on unmount
  onUnmounted(() => {
    stopControlPointTimerInterval()
  })

  return {
    controlPointTimes,
    updateControlPointTimes,
    updateIndividualControlPointTime,
    updateAllTimerDisplays,
    handleGameStateChange,
    stopControlPointTimerInterval
  }
}