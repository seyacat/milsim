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

export const useControlPointTimers = (
  currentGame: Game | null,
  socket: Socket | null,
  controlPointTimesFromGameTime: ControlPointTimeData[]
): UseControlPointTimersReturn => {

  const [controlPointTimes, setControlPointTimes] = useState<Record<number, ControlPointTimeData>>({});
  const localTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update control point times when they come from useGameTime
  useEffect(() => {

    if (controlPointTimesFromGameTime && controlPointTimesFromGameTime.length > 0) {

      const timesMap: Record<number, ControlPointTimeData> = {};
      controlPointTimesFromGameTime.forEach(cpTime => {
        timesMap[cpTime.controlPointId] = cpTime;
      });
      
      setControlPointTimes(timesMap);

      // Update all timer displays immediately
      updateAllTimerDisplays();

      // Start local timer interval if game is running
      if (currentGame?.status === 'running' && !localTimerRef.current) {
        startControlPointTimerInterval();
      }
    }
  }, [controlPointTimesFromGameTime, currentGame?.status]);

  // Update timer display for a specific control point
  const updateControlPointTimerDisplay = (controlPointId: number) => {
    const timerElement = document.getElementById(`timer_${controlPointId}`);
    const timeData = controlPointTimes[controlPointId];
    
    if (!timerElement) {
      return;
    }
    
    if (!timeData) {
      timerElement.style.display = 'none';
      return;
    }

    // Show timer only if game is running and control point is owned
    const shouldShow = currentGame?.status === 'running' && timeData.currentTeam !== null;
    
    if (shouldShow) {
      // Format time as MM:SS
      const minutes = Math.floor(timeData.currentHoldTime / 60);
      const seconds = timeData.currentHoldTime % 60;
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      
      timerElement.textContent = timeText;
      timerElement.style.display = 'block';
    } else {
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

    localTimerRef.current = setInterval(() => {
      if (currentGame?.status === 'running') {
        // Increment all active control point timers by 1 second
        setControlPointTimes(prev => {
          const updated: Record<number, ControlPointTimeData> = {};
          
          Object.entries(prev).forEach(([controlPointId, timeData]) => {
            // Only increment timers for control points that are owned
            if (timeData.currentTeam !== null) {
              const newHoldTime = timeData.currentHoldTime + 1;
              updated[Number(controlPointId)] = {
                ...timeData,
                currentHoldTime: newHoldTime
              };
            } else {
              updated[Number(controlPointId)] = timeData;
            }
          });
          
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

  // Handle game state changes
  useEffect(() => {
    if (!currentGame) return;

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