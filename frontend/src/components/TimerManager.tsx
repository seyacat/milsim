import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
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

// Create context for timer data
interface TimerContextValue {
  timeData: {
    remainingTime: number | null;
    playedTime: number;
    totalTime: number | null;
  };
}

const TimerContext = createContext<TimerContextValue | null>(null);

// Hook to use timer context
export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerManager');
  }
  return context;
};

export const TimerManager: React.FC<TimerManagerProps> = React.memo(({ currentGame, socket, children }) => {
  const [timeData, setTimeData] = useState<TimeData | null>(null);
  const [controlPointTimes, setControlPointTimes] = useState<ControlPointUpdateData[]>([]);
  const localPlayedTimeRef = React.useRef<number>(0);
  const localControlPointTimesRef = React.useRef<ControlPointUpdateData[]>([]);
  const localTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const localCPTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Handle time updates from server
  const handleTimeUpdate = useCallback((newTimeData: TimeData) => {
    setTimeData(newTimeData);
    localPlayedTimeRef.current = newTimeData.playedTime;

    // Start/stop local timer based on game status
    if (currentGame?.status === 'running' && !localTimerRef.current) {
      localTimerRef.current = setInterval(() => {
        localPlayedTimeRef.current += 1;
        // Update DOM directly without causing re-render
        updateGameTimeDisplay();
      }, 1000);
    } else if (currentGame?.status !== 'running' && localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  }, [currentGame?.status]);

  // Handle control point times updates
  const handleControlPointTimes = useCallback((data: ControlPointUpdateData[]) => {
    setControlPointTimes(data);
    localControlPointTimesRef.current = data;
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
    };
  }, [socket, currentGame, handleTimeUpdate, handleControlPointTimes]);


  // Handle game state changes for local timers
  useEffect(() => {
    if (!currentGame) return;

    // Handle played time timer
    if (currentGame.status === 'running' && !localTimerRef.current) {
      localTimerRef.current = setInterval(() => {
        localPlayedTimeRef.current += 1;
        // Update DOM directly without causing re-render
        updateGameTimeDisplay();
      }, 1000);
    } else if (currentGame.status !== 'running' && localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }

    // Handle control point timers
    if (currentGame.status === 'running' && !localCPTimerRef.current) {
      localCPTimerRef.current = setInterval(() => {
        // Update control point timers directly in the ref
        localControlPointTimesRef.current = localControlPointTimesRef.current.map(cp => {
          // Only increment timers for control points that are currently held by a team
          if (cp.currentTeam !== null && cp.currentTeam !== 'none') {
            return {
              ...cp,
              currentHoldTime: cp.currentHoldTime + 1
            };
          }
          return cp;
        });
        // Update DOM directly without causing re-render
        updateControlPointTimerDisplays();
      }, 1000);
    } else if (currentGame.status !== 'running' && localCPTimerRef.current) {
      clearInterval(localCPTimerRef.current);
      localCPTimerRef.current = null;
    }
  }, [currentGame?.status]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
      if (localCPTimerRef.current) {
        clearInterval(localCPTimerRef.current);
        localCPTimerRef.current = null;
      }
    };
  }, []);


  // Update control point timer displays when controlPointTimes change
  useEffect(() => {
    if (!currentGame?.controlPoints) return;
    updateControlPointTimerDisplays();
  }, [controlPointTimes, currentGame?.status, currentGame?.controlPoints]);


  // Update game time display directly in DOM
  const updateGameTimeDisplay = () => {
    const timePlayedElement = document.getElementById('timePlayed');
    if (timePlayedElement) {
      const playedMinutes = Math.floor(localPlayedTimeRef.current / 60);
      const playedSeconds = localPlayedTimeRef.current % 60;
      const timePlayedText = `${playedMinutes}:${playedSeconds.toString().padStart(2, '0')}`;
      timePlayedElement.textContent = timePlayedText;
    }
  };

  // Update all control point timer displays
  const updateControlPointTimerDisplays = () => {
    if (!currentGame?.controlPoints) return;

    currentGame.controlPoints.forEach(controlPoint => {
      const timerElement = document.getElementById(`timer_${controlPoint.id}`);
      const timeData = localControlPointTimesRef.current.find(cp => cp.controlPointId === controlPoint.id);
      
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
    });
  };

  // Update control point timer display for a specific control point
  const updateControlPointTimerDisplay = (controlPointId: number) => {
    const timerElement = document.getElementById(`timer_${controlPointId}`);
    const timeData = localControlPointTimesRef.current.find(cp => cp.controlPointId === controlPointId);
    
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
    playedTime: localPlayedTimeRef.current,
    totalTime: timeData?.totalTime || null
  };

  return (
    <TimerContext.Provider value={{ timeData: currentTimeData }}>
      {children}
    </TimerContext.Provider>
  );
});