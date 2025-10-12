import { useState, useEffect, useRef } from 'react';
import { Game, ControlPoint } from '../types';
import { Socket } from 'socket.io-client';

export interface ControlPointTimeData {
  controlPointId: number;
  currentHoldTime: number;
  currentTeam: string | null;
}

export interface UseControlPointTimersReturn {
  controlPointTimes: Record<number, ControlPointTimeData>;
  updateControlPointTimerDisplay: (controlPointId: number) => void;
  updateAllTimerDisplays: () => void;
}

export const useControlPointTimers = (currentGame: Game | null, socket: Socket | null): UseControlPointTimersReturn => {
  const [controlPointTimes, setControlPointTimes] = useState<Record<number, ControlPointTimeData>>({});
  const localTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle control point time updates from server
  const handleControlPointTimeUpdate = (data: ControlPointTimeData) => {
    console.log('[CONTROL_POINT_TIMER] WebSocket: Received controlPointTimeUpdate for CP:', data.controlPointId, 'hold time:', data.currentHoldTime, 'team:', data.currentTeam);
    
    setControlPointTimes(prev => ({
      ...prev,
      [data.controlPointId]: data
    }));

    // Update timer display immediately
    updateControlPointTimerDisplay(data.controlPointId);
  };

  // Handle initial control point times data
  const handleControlPointTimes = (data: ControlPointTimeData[]) => {
    console.log('[CONTROL_POINT_TIMER] WebSocket: Received controlPointTimes for', data.length, 'control points');
    
    const timesMap: Record<number, ControlPointTimeData> = {};
    data.forEach(cpTime => {
      timesMap[cpTime.controlPointId] = cpTime;
      console.log('[CONTROL_POINT_TIMER] WebSocket: CP', cpTime.controlPointId, 'hold time:', cpTime.currentHoldTime, 'team:', cpTime.currentTeam);
    });
    
    setControlPointTimes(timesMap);

    // Update all timer displays immediately
    updateAllTimerDisplays();

    // Start local timer interval if game is running
    if (currentGame?.status === 'running' && !localTimerRef.current) {
      console.log('[CONTROL_POINT_TIMER] Starting local timer interval');
      startControlPointTimerInterval();
    }
  };

  // Update timer display for a specific control point
  const updateControlPointTimerDisplay = (controlPointId: number) => {
    const timerElement = document.getElementById(`timer_${controlPointId}`);
    const timeData = controlPointTimes[controlPointId];
    
    if (!timerElement) {
      console.log('[CONTROL_POINT_TIMER] Timer element not found for CP:', controlPointId);
      return;
    }
    
    if (!timeData) {
      console.log('[CONTROL_POINT_TIMER] No time data for CP:', controlPointId);
      timerElement.style.display = 'none';
      return;
    }

    // Show timer only if game is running and control point is owned
    const shouldShow = currentGame?.status === 'running' && timeData.currentTeam !== null;
    
    console.log('[CONTROL_POINT_TIMER] Updating display for CP:', controlPointId, 'shouldShow:', shouldShow, 'holdTime:', timeData.currentHoldTime, 'team:', timeData.currentTeam);
    
    if (shouldShow) {
      // Format time as MM:SS
      const minutes = Math.floor(timeData.currentHoldTime / 60);
      const seconds = timeData.currentHoldTime % 60;
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      console.log('[CONTROL_POINT_TIMER] Setting timer text for CP:', controlPointId, 'to:', timeText);
      timerElement.textContent = timeText;
      timerElement.style.display = 'block';
    } else {
      console.log('[CONTROL_POINT_TIMER] Hiding timer for CP:', controlPointId);
      timerElement.style.display = 'none';
    }
  };

  // Update all timer displays
  const updateAllTimerDisplays = () => {
    if (!currentGame?.controlPoints) return;
    
    currentGame.controlPoints.forEach(controlPoint => {
      updateControlPointTimerDisplay(controlPoint.id);
    });
  };

  // Start local timer interval for smooth updates
  const startControlPointTimerInterval = () => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    console.log('[CONTROL_POINT_TIMER] Starting local timer interval');
    localTimerRef.current = setInterval(() => {
      if (currentGame?.status === 'running') {
        // Increment all active control point timers by 1 second
        setControlPointTimes(prev => {
          const updated: Record<number, ControlPointTimeData> = {};
          let hasActiveTimers = false;
          
          Object.entries(prev).forEach(([controlPointId, timeData]) => {
            // Only increment timers for control points that are owned
            if (timeData.currentTeam !== null) {
              const newHoldTime = timeData.currentHoldTime + 1;
              updated[Number(controlPointId)] = {
                ...timeData,
                currentHoldTime: newHoldTime
              };
              hasActiveTimers = true;
              console.log('[CONTROL_POINT_TIMER] Local timer tick - CP:', controlPointId, 'new hold time:', newHoldTime);
            } else {
              updated[Number(controlPointId)] = timeData;
            }
          });
          
          console.log('[CONTROL_POINT_TIMER] Local timer tick - active timers:', hasActiveTimers);
          return updated;
        });

        // Update all timer displays
        updateAllTimerDisplays();
      }
    }, 1000);
  };

  // Stop local timer interval
  const stopControlPointTimerInterval = () => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  };

  // Set up WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    console.log('[CONTROL_POINT_TIMER] WebSocket: Setting up listeners for controlPointTimeUpdate and controlPointTimes');

    socket.on('controlPointTimeUpdate', handleControlPointTimeUpdate);
    socket.on('controlPointTimes', handleControlPointTimes);

    return () => {
      console.log('[CONTROL_POINT_TIMER] WebSocket: Cleaning up listeners');
      socket.off('controlPointTimeUpdate', handleControlPointTimeUpdate);
      socket.off('controlPointTimes', handleControlPointTimes);
    };
  }, [socket]);

  // Request control point times when game is loaded
  useEffect(() => {
    if (socket && currentGame) {
      console.log('[CONTROL_POINT_TIMER] WebSocket: Requesting getControlPointTimes for game:', currentGame.id);
      socket.emit('getControlPointTimes', { gameId: currentGame.id });
    }
  }, [socket, currentGame]);

  // Handle game state changes
  useEffect(() => {
    if (!currentGame) return;

    console.log('[CONTROL_POINT_TIMER] Game state changed to:', currentGame.status);

    if (currentGame.status === 'running') {
      // Start timer when game starts running
      if (!localTimerRef.current) {
        startControlPointTimerInterval();
      }
    } else {
      // Stop timer when game is not running
      stopControlPointTimerInterval();
      
      // Hide all timers when game is not running
      updateAllTimerDisplays();
    }
  }, [currentGame?.status]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      stopControlPointTimerInterval();
    };
  }, []);

  return {
    controlPointTimes,
    updateControlPointTimerDisplay,
    updateAllTimerDisplays
  };
};