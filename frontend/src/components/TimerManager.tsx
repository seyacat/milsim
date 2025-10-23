import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Game, ControlPointUpdateData, BombTimer } from '../types';
import { Socket } from 'socket.io-client';

interface TimerManagerProps {
  currentGame: Game | null;
  socket: Socket | null;
  children?: React.ReactNode;
}

interface TimeData {
  remainingTime: number | null;
  playedTime: number;
  totalTime: number | null;
}

interface BombTimerData {
  controlPointId: number;
  remainingTime: number;
  isActive: boolean;
}

export const TimerManager: React.FC<TimerManagerProps> = ({ currentGame, socket, children }) => {
  const [timeData, setTimeData] = useState<TimeData | null>(null);
  const [controlPointTimes, setControlPointTimes] = useState<ControlPointUpdateData[]>([]);
  const [activeBombTimers, setActiveBombTimers] = useState<Map<number, BombTimerData>>(new Map());
  const [localPlayedTime, setLocalPlayedTime] = useState<number>(0);
  const localTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Handle time updates from server
  const handleTimeUpdate = useCallback((newTimeData: TimeData) => {
    setTimeData(newTimeData);
    setLocalPlayedTime(newTimeData.playedTime);

    // Start/stop local timer based on game status
    if (currentGame?.status === 'running' && !localTimerRef.current) {
      localTimerRef.current = setInterval(() => {
        setLocalPlayedTime(prev => prev + 1);
      }, 1000);
    } else if (currentGame?.status !== 'running' && localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  }, [currentGame?.status]);

  // Handle control point times updates
  const handleControlPointTimes = useCallback((data: ControlPointUpdateData[]) => {
    setControlPointTimes(data);
  }, []);

  // Handle bomb time updates
  const handleBombTimeUpdate = useCallback((data: BombTimerData) => {
    setActiveBombTimers(prev => {
      const newTimers = new Map(prev);
      newTimers.set(data.controlPointId, data);
      return newTimers;
    });
  }, []);

  // Handle active bomb timers response
  const handleActiveBombTimers = useCallback((serverBombTimers: BombTimerData[]) => {
    const newTimers = new Map<number, BombTimerData>();
    
    if (serverBombTimers && Array.isArray(serverBombTimers)) {
      serverBombTimers.forEach(bombTimer => {
        newTimers.set(bombTimer.controlPointId, bombTimer);
      });
    }
    
    setActiveBombTimers(newTimers);
  }, []);


  // Set up WebSocket listeners for timer events
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleTimeUpdateEvent = (data: TimeData) => {
      handleTimeUpdate(data);
    };

    const handleGameTimeEvent = (data: TimeData) => {
      handleTimeUpdate(data);
    };

    const handleControlPointTimesEvent = (data: ControlPointUpdateData[]) => {
      handleControlPointTimes(data);
    };

    socket.on('timeUpdate', handleTimeUpdateEvent);
    socket.on('gameTime', handleGameTimeEvent);
    socket.on('controlPointTimes', handleControlPointTimesEvent);
    socket.on('bombTimeUpdate', handleBombTimeUpdate);
    socket.on('activeBombTimers', handleActiveBombTimers);

    // Request initial timer data
    if (currentGame) {
      socket.emit('getActiveBombTimers', { gameId: currentGame.id });
      // Request initial game time data
      socket.emit('getGameTime', { gameId: currentGame.id });
      // Request initial control point times
      socket.emit('getControlPointTimes', { gameId: currentGame.id });
    }

    return () => {
      socket.off('timeUpdate', handleTimeUpdateEvent);
      socket.off('gameTime', handleGameTimeEvent);
      socket.off('controlPointTimes', handleControlPointTimesEvent);
      socket.off('bombTimeUpdate', handleBombTimeUpdate);
      socket.off('activeBombTimers', handleActiveBombTimers);
    };
  }, [socket, currentGame, handleTimeUpdate, handleControlPointTimes, handleBombTimeUpdate, handleActiveBombTimers]);

  // Request active bomb timers when game is loaded
  useEffect(() => {
    if (socket && currentGame) {
      socket.emit('getActiveBombTimers', { gameId: currentGame.id });
    }
  }, [socket, currentGame]);

  // Handle game state changes for local timer
  useEffect(() => {
    if (!currentGame) return;

    if (currentGame.status === 'running' && !localTimerRef.current) {
      localTimerRef.current = setInterval(() => {
        setLocalPlayedTime(prev => prev + 1);
      }, 1000);
    } else if (currentGame.status !== 'running' && localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  }, [currentGame?.status]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
    };
  }, []);

  // Update bomb timer displays when activeBombTimers change
  useEffect(() => {
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
  }, [activeBombTimers, currentGame?.controlPoints]);

  // Update control point timer displays when controlPointTimes change
  useEffect(() => {
    if (!currentGame?.controlPoints) return;

    currentGame.controlPoints.forEach(controlPoint => {
      updateControlPointTimerDisplay(controlPoint.id);
    });
  }, [controlPointTimes, currentGame?.status, currentGame?.controlPoints]);

  // Update bomb timer display for a specific control point
  const updateBombTimerDisplay = (controlPointId: number) => {
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
    const bombTimerData = activeBombTimers.get(controlPointId);
    
    if (!bombTimerElement) return;

    if (bombTimerData?.isActive) {
      if (typeof bombTimerData.remainingTime !== 'number' || isNaN(bombTimerData.remainingTime)) {
        bombTimerElement.style.display = 'none';
        return;
      }

      const minutes = Math.floor(bombTimerData.remainingTime / 60);
      const seconds = bombTimerData.remainingTime % 60;
      const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      bombTimerElement.textContent = timeText;
      bombTimerElement.style.display = 'block';
      
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

  // Update control point timer display for a specific control point
  const updateControlPointTimerDisplay = (controlPointId: number) => {
    const timerElement = document.getElementById(`timer_${controlPointId}`);
    const timeData = controlPointTimes.find(cp => cp.controlPointId === controlPointId);
    
    if (!timerElement) return;

    const shouldShow = currentGame?.status === 'running' && timeData?.currentTeam !== null;
    
    if (shouldShow && timeData) {
      const minutes = Math.floor(timeData.currentHoldTime / 60);
      const seconds = timeData.currentHoldTime % 60;
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      timerElement.textContent = timeText;
      timerElement.style.display = 'block';
    } else {
      timerElement.style.display = 'none';
    }
  };

  const currentTimeData = {
    remainingTime: timeData?.remainingTime || null,
    playedTime: localPlayedTime,
    totalTime: timeData?.totalTime || null
  };


  return (
    <>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            timeData: currentTimeData
          } as any);
        }
        return child;
      })}
    </>
  );
};