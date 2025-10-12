import { useState, useEffect, useRef } from 'react';
import { Game } from '../types';
import { Socket } from 'socket.io-client';

export interface BombTimerData {
  controlPointId: number;
  remainingTime: number;
  isActive: boolean;
}

export interface UseBombTimersReturn {
  activeBombTimers: Map<number, BombTimerData>;
  updateBombTimerDisplay: (controlPointId: number) => void;
  updateAllBombTimerDisplays: () => void;
}

export const useBombTimers = (currentGame: Game | null, socket: Socket | null): UseBombTimersReturn => {
  const [activeBombTimers, setActiveBombTimers] = useState<Map<number, BombTimerData>>(new Map());
  const localTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle bomb time updates from server
  const handleBombTimeUpdate = (data: BombTimerData) => {
    
    setActiveBombTimers(prev => {
      const newTimers = new Map(prev);
      newTimers.set(data.controlPointId, data);
      return newTimers;
    });

    // Update bomb timer display immediately
    updateBombTimerDisplay(data.controlPointId);

    // Start or stop local timer based on active bombs
    if (data.isActive && !localTimerRef.current) {
      startBombTimerInterval();
    } else if (!data.isActive) {
      // Check if there are any active bombs after this update
      const hasActiveBombs = Array.from(activeBombTimers.values()).some(timer => timer.isActive);
      if (!hasActiveBombs && localTimerRef.current) {
        stopBombTimerInterval();
      }
    }
  };

  // Handle active bomb timers response
  const handleActiveBombTimers = (serverBombTimers: BombTimerData[]) => {
    
    const newTimers = new Map<number, BombTimerData>();
    
    if (serverBombTimers && Array.isArray(serverBombTimers)) {
      serverBombTimers.forEach(bombTimer => {
        newTimers.set(bombTimer.controlPointId, bombTimer);
      });
    }
    
    setActiveBombTimers(newTimers);

    // Update all bomb timer displays
    updateAllBombTimerDisplays();

    // Start or stop local timer based on active bombs
    const hasActiveBombs = Array.from(newTimers.values()).some(timer => timer.isActive);
    if (hasActiveBombs && !localTimerRef.current) {
      startBombTimerInterval();
    } else if (!hasActiveBombs && localTimerRef.current) {
      stopBombTimerInterval();
    }
  };

  // Update bomb timer display for a specific control point
  const updateBombTimerDisplay = (controlPointId: number) => {
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
    const bombTimerData = activeBombTimers.get(controlPointId);
    
    if (!bombTimerElement) {
      return;
    }

    // Show bomb timer only if bomb is active
    if (bombTimerData?.isActive) {
      // Format time as MM:SS
      const minutes = Math.floor(bombTimerData.remainingTime / 60);
      const seconds = bombTimerData.remainingTime % 60;
      const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      bombTimerElement.textContent = timeText;
      bombTimerElement.style.display = 'block';
      
      // Show warning colors when time is running low
      if (bombTimerData.remainingTime <= 60) {
        bombTimerElement.style.background = 'rgba(244, 67, 54, 0.9)';
      } else if (bombTimerData.remainingTime <= 180) {
        bombTimerElement.style.background = 'rgba(255, 152, 0, 0.9)';
      } else {
        bombTimerElement.style.background = 'rgba(255, 87, 34, 0.9)';
      }
    } else {
      bombTimerElement.style.display = 'none';
    }
  };

  // Update all bomb timer displays
  const updateAllBombTimerDisplays = () => {
    if (!currentGame?.controlPoints) return;
    
    
    // Hide all bomb timers first
    currentGame.controlPoints.forEach(controlPoint => {
      const bombTimerElement = document.getElementById(`bomb_timer_${controlPoint.id}`);
      if (bombTimerElement) {
        bombTimerElement.style.display = 'none';
      }
    });

    // Show bomb timers for active bombs
    activeBombTimers.forEach((bombTimer, controlPointId) => {
      if (bombTimer.isActive) {
        updateBombTimerDisplay(controlPointId);
      }
    });
  };

  // Start local timer interval for smooth countdown
  const startBombTimerInterval = () => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    localTimerRef.current = setInterval(() => {
      if (currentGame?.status === 'running') {
        // Decrement all active bomb timers by 1 second
        setActiveBombTimers(prev => {
          const newTimers = new Map<number, BombTimerData>();
          let hasActiveBombs = false;

          prev.forEach((bombTimer, controlPointId) => {
            if (bombTimer.isActive && bombTimer.remainingTime > 0) {
              const newRemainingTime = bombTimer.remainingTime - 1;
              newTimers.set(controlPointId, {
                ...bombTimer,
                remainingTime: newRemainingTime
              });
              hasActiveBombs = true;
              
              // Update display immediately for this timer
              setTimeout(() => {
                updateBombTimerDisplay(controlPointId);
              }, 0);
            } else if (bombTimer.isActive && bombTimer.remainingTime <= 0) {
              // Bomb timer expired - keep it but mark as inactive
              newTimers.set(controlPointId, {
                ...bombTimer,
                isActive: false
              });
              
              // Hide display for expired timer
              setTimeout(() => {
                updateBombTimerDisplay(controlPointId);
              }, 0);
            } else {
              newTimers.set(controlPointId, bombTimer);
            }
          });

          // Stop timer if no more active bombs
          if (!hasActiveBombs && localTimerRef.current) {
            stopBombTimerInterval();
          }

          return newTimers;
        });
      }
    }, 1000);
  };

  // Stop local timer interval
  const stopBombTimerInterval = () => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  };

  // Set up WebSocket listeners
  useEffect(() => {
    if (!socket) return;


    socket.on('bombTimeUpdate', handleBombTimeUpdate);
    socket.on('activeBombTimers', handleActiveBombTimers);

    return () => {
      socket.off('bombTimeUpdate', handleBombTimeUpdate);
      socket.off('activeBombTimers', handleActiveBombTimers);
    };
  }, [socket]);

  // Request active bomb timers when game is loaded
  useEffect(() => {
    if (socket && currentGame) {
      socket.emit('getActiveBombTimers', { gameId: currentGame.id });
    }
  }, [socket, currentGame]);

  // Handle game state changes
  useEffect(() => {
    if (!currentGame) return;


    if (currentGame.status === 'running') {
      // Request active bomb timers when game starts running
      if (socket) {
        socket.emit('getActiveBombTimers', { gameId: currentGame.id });
      }
    } else {
      // Stop timer when game is not running
      stopBombTimerInterval();
      
      // Hide all bomb timers when game is not running
      updateAllBombTimerDisplays();
    }
  }, [currentGame?.status, socket]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      stopBombTimerInterval();
    };
  }, []);

  return {
    activeBombTimers,
    updateBombTimerDisplay,
    updateAllBombTimerDisplays
  };
};