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
  const currentGameRef = useRef<Game | null>(currentGame);

  // Handle bomb time updates from server
  const handleBombTimeUpdate = (data: BombTimerData) => {
    console.log(`[BOMB_TIMER] Server update received for CP ${data.controlPointId}:`, data);
    
    setActiveBombTimers(prev => {
      const newTimers = new Map(prev);
      newTimers.set(data.controlPointId, data);
      console.log(`[BOMB_TIMER] Updated state for CP ${data.controlPointId}, total active timers: ${Array.from(newTimers.values()).filter(t => t.isActive).length}`);
      return newTimers;
    });

    // Update bomb timer display immediately
    updateBombTimerDisplay(data.controlPointId);

    // Start or stop local timer based on active bombs
    if (data.isActive && !localTimerRef.current) {
      console.log('[BOMB_TIMER] Starting local timer interval (server update)');
      startBombTimerInterval();
    } else if (!data.isActive) {
      // Check if there are any active bombs after this update
      // Use a timeout to ensure we check the updated state
      setTimeout(() => {
        const hasActiveBombs = Array.from(activeBombTimers.values()).some(timer => timer.isActive);
        console.log(`[BOMB_TIMER] Checking active bombs after update: ${hasActiveBombs}`);
        if (!hasActiveBombs && localTimerRef.current) {
          console.log('[BOMB_TIMER] Stopping local timer interval (no active bombs)');
          stopBombTimerInterval();
        }
      }, 0);
    }
  };

  // Handle active bomb timers response
  const handleActiveBombTimers = (serverBombTimers: BombTimerData[]) => {
    console.log('[BOMB_TIMER] Active bomb timers received from server:', serverBombTimers);
    
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
    console.log(`[BOMB_TIMER] Has active bombs: ${hasActiveBombs}, local timer running: ${!!localTimerRef.current}`);
    
    if (hasActiveBombs && !localTimerRef.current) {
      console.log('[BOMB_TIMER] Starting local timer interval (active timers)');
      startBombTimerInterval();
    } else if (!hasActiveBombs && localTimerRef.current) {
      console.log('[BOMB_TIMER] Stopping local timer interval (no active timers)');
      stopBombTimerInterval();
    }
  };

  // Update bomb timer display for a specific control point
  const updateBombTimerDisplay = (controlPointId: number) => {
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
    const bombTimerData = activeBombTimers.get(controlPointId);
    
    if (!bombTimerElement) {
      console.log(`[BOMB_TIMER] Element not found for CP ${controlPointId}`);
      return;
    }

    // Show bomb timer only if bomb is active
    if (bombTimerData?.isActive) {
      // Format time as MM:SS
      const minutes = Math.floor(bombTimerData.remainingTime / 60);
      const seconds = bombTimerData.remainingTime % 60;
      const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      console.log(`[BOMB_TIMER] Updating display for CP ${controlPointId}: ${timeText}`);
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
      console.log(`[BOMB_TIMER] Hiding display for CP ${controlPointId} (not active)`);
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
    console.log('[BOMB_TIMER] Starting bomb timer interval');
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    localTimerRef.current = setInterval(() => {
      console.log('[BOMB_TIMER] Interval callback executed');
      
      if (currentGameRef.current?.status === 'running') {
        console.log('[BOMB_TIMER] Local interval running, decrementing timers by 1 second');
        
        // Decrement all active bomb timers by 1 second
        setActiveBombTimers(prev => {
          console.log('[BOMB_TIMER] setActiveBombTimers callback, prev size:', prev.size);
          const newTimers = new Map<number, BombTimerData>();
          let hasActiveBombs = false;

          prev.forEach((bombTimer, controlPointId) => {
            if (bombTimer.isActive && bombTimer.remainingTime > 0) {
              const newRemainingTime = bombTimer.remainingTime - 1;
              console.log(`[BOMB_TIMER] Decrementing timer for CP ${controlPointId}: ${bombTimer.remainingTime} -> ${newRemainingTime}`);
              newTimers.set(controlPointId, {
                ...bombTimer,
                remainingTime: newRemainingTime
              });
              hasActiveBombs = true;
            } else if (bombTimer.isActive && bombTimer.remainingTime <= 0) {
              // Bomb timer expired - keep it but mark as inactive
              console.log(`[BOMB_TIMER] Timer expired for CP ${controlPointId}`);
              newTimers.set(controlPointId, {
                ...bombTimer,
                isActive: false
              });
            } else {
              newTimers.set(controlPointId, bombTimer);
            }
          });

          // Stop timer if no more active bombs
          if (!hasActiveBombs && localTimerRef.current) {
            console.log('[BOMB_TIMER] No active bombs, stopping interval');
            stopBombTimerInterval();
          }

          console.log('[BOMB_TIMER] New timers size:', newTimers.size);
          return newTimers;
        });

        // Update all bomb timer displays after state update (same pattern as control point timers)
        console.log('[BOMB_TIMER] Updating all bomb timer displays');
        updateAllBombTimerDisplays();
      } else {
        console.log('[BOMB_TIMER] Game not running, skipping decrement');
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

  // Update currentGame ref when currentGame changes
  useEffect(() => {
    currentGameRef.current = currentGame;
  }, [currentGame]);

  // Handle game state changes
  useEffect(() => {
    if (!currentGame) return;

    console.log(`[BOMB_TIMER] Game state changed to: ${currentGame.status}, local timer running: ${!!localTimerRef.current}`);

    if (currentGame.status === 'running') {
      // Request active bomb timers when game starts running
      if (socket) {
        console.log('[BOMB_TIMER] Requesting active bomb timers (game running)');
        socket.emit('getActiveBombTimers', { gameId: currentGame.id });
      }
      
      // Check if we need to start the local timer
      const hasActiveBombs = Array.from(activeBombTimers.values()).some(timer => timer.isActive);
      if (hasActiveBombs && !localTimerRef.current) {
        console.log('[BOMB_TIMER] Starting local timer interval (game state change)');
        startBombTimerInterval();
      }
    } else {
      // Stop timer when game is not running
      console.log('[BOMB_TIMER] Stopping local timer (game not running)');
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