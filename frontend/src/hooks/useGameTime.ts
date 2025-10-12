import { useState, useEffect, useRef } from 'react';
import { Game } from '../types';
import { Socket } from 'socket.io-client';

export interface ControlPointTimeData {
  controlPointId: number;
  currentHoldTime: number;
  currentTeam: string | null;
  displayTime: string;
}

export interface TimeData {
  remainingTime: number | null;
  playedTime: number;
  totalTime: number | null;
  controlPointTimes?: ControlPointTimeData[];
  receivedAt?: number;
}

export interface UseGameTimeReturn {
  timeData: TimeData | null;
  isGameRunning: boolean;
  updateTimeDisplay: () => void;
  controlPointTimes: ControlPointTimeData[];
}

export const useGameTime = (currentGame: Game | null, socket: Socket | null): UseGameTimeReturn => {
  const [timeData, setTimeData] = useState<TimeData | null>(null);
  const [controlPointTimes, setControlPointTimes] = useState<ControlPointTimeData[]>([]);
  const localTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle time updates from server
  const handleTimeUpdate = (newTimeData: TimeData) => {
    console.log('[GAME_TIME] Received time update from server:', {
      remainingTime: newTimeData.remainingTime,
      playedTime: newTimeData.playedTime,
      totalTime: newTimeData.totalTime,
      controlPointTimes: newTimeData.controlPointTimes,
      controlPointTimesCount: newTimeData.controlPointTimes?.length || 0
    });

    const timeDataWithTimestamp = {
      ...newTimeData,
      receivedAt: Date.now()
    };
    
    setTimeData(timeDataWithTimestamp);

    // Update control point times if provided
    if (newTimeData.controlPointTimes) {
      console.log('[GAME_TIME] Setting control point times:', newTimeData.controlPointTimes);
      setControlPointTimes(newTimeData.controlPointTimes);
    }

    // Stop existing local timer
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }

    // Start local timer for smooth updates if game is running
    if (currentGame?.status === 'running') {
      localTimerRef.current = setInterval(() => {
        updateTimeDisplay();
      }, 1000);
    }
  };

  // Update time display using local timer or server data
  const updateTimeDisplay = () => {
    if (!timeData) {
      return;
    }

    const timePlayedElement = document.getElementById('timePlayed');
    const timeRemainingContainer = document.getElementById('timeRemainingContainer');
    const timeRemainingElement = document.getElementById('timeRemaining');

    if (!timePlayedElement) {
      return;
    }

    // Calculate elapsed time since last server update
    let elapsedSinceUpdate = 0;
    if (timeData.receivedAt) {
      elapsedSinceUpdate = Math.floor((Date.now() - timeData.receivedAt) / 1000);
    }

    // Calculate current played time (server time + local elapsed time)
    const currentPlayedTime = timeData.playedTime + elapsedSinceUpdate;

    // Format time played
    const playedMinutes = Math.floor(currentPlayedTime / 60);
    const playedSeconds = currentPlayedTime % 60;
    const timePlayedText = `${playedMinutes}:${playedSeconds.toString().padStart(2, '0')}`;
    
    timePlayedElement.textContent = timePlayedText;

    // Handle remaining time
    if (timeData.remainingTime === null || timeData.remainingTime === undefined) {
      // Time indefinite - only show time played
      if (timeRemainingContainer) {
        timeRemainingContainer.style.display = 'none';
      }
    } else {
      // Time limited - show both time played and remaining
      const currentRemainingTime = Math.max(0, timeData.remainingTime - elapsedSinceUpdate);
      const minutes = Math.floor(currentRemainingTime / 60);
      const seconds = currentRemainingTime % 60;
      const timeRemainingText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (timeRemainingElement) {
        timeRemainingElement.textContent = timeRemainingText;
      }
      if (timeRemainingContainer) {
        timeRemainingContainer.style.display = 'block';
      }

      // If time is up, stop local timer
      if (currentRemainingTime <= 0 && localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
    }
    
  };
  // Set up WebSocket listeners
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

    const handleControlPointTimesEvent = (data: ControlPointTimeData[]) => {
      console.log('[GAME_TIME] Received control point times directly:', data);
      setControlPointTimes(data);
    };

    socket.on('timeUpdate', handleTimeUpdateEvent);
    socket.on('gameTime', handleGameTimeEvent);
    socket.on('controlPointTimes', handleControlPointTimesEvent);

    return () => {
      socket.off('timeUpdate', handleTimeUpdateEvent);
      socket.off('gameTime', handleGameTimeEvent);
      socket.off('controlPointTimes', handleControlPointTimesEvent);
    };
  }, [socket]);

  // Request game time when game is loaded
  useEffect(() => {
    if (socket && currentGame) {
      socket.emit('getGameTime', { gameId: currentGame.id });
    }
  }, [socket, currentGame]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
    };
  }, []);

  // Handle game state changes
  useEffect(() => {
    if (!currentGame) {
      return;
    }

    // Stop timer when game is not running
    if (currentGame.status !== 'running' && localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }

    // Start timer when game starts running
    if (currentGame.status === 'running' && timeData && !localTimerRef.current) {
      localTimerRef.current = setInterval(() => {
        updateTimeDisplay();
      }, 1000);
    }
  }, [currentGame?.status, timeData]);

  return {
    timeData,
    isGameRunning: currentGame?.status === 'running',
    updateTimeDisplay,
    controlPointTimes
  };
};