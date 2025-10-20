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
}

export interface UseGameTimeReturn {
  timeData: TimeData | null;
  isGameRunning: boolean;
  controlPointTimes: ControlPointTimeData[];
}

export const useGameTime = (currentGame: Game | null, socket: Socket | null): UseGameTimeReturn => {
  const [timeData, setTimeData] = useState<TimeData | null>(null);
  const [controlPointTimes, setControlPointTimes] = useState<ControlPointTimeData[]>([]);
  const [localPlayedTime, setLocalPlayedTime] = useState<number>(0);
  const localTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle time updates from server
  const handleTimeUpdate = (newTimeData: TimeData) => {
    setTimeData(newTimeData);
    setLocalPlayedTime(newTimeData.playedTime);

    // Update control point times if provided
    if (newTimeData.controlPointTimes) {
      setControlPointTimes(newTimeData.controlPointTimes);
    }

    // Start/stop local timer based on game status
    if (currentGame?.status === 'running' && !localTimerRef.current) {
      localTimerRef.current = setInterval(() => {
        setLocalPlayedTime(prev => prev + 1);
      }, 1000);
    } else if (currentGame?.status !== 'running' && localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  };

  // Update time display
  const updateTimeDisplay = () => {
    const timePlayedElement = document.getElementById('timePlayed');
    const timeRemainingContainer = document.getElementById('timeRemainingContainer');
    const timeRemainingElement = document.getElementById('timeRemaining');

    if (!timePlayedElement) return;

    // Format time played
    const playedMinutes = Math.floor(localPlayedTime / 60);
    const playedSeconds = localPlayedTime % 60;
    const timePlayedText = `${playedMinutes}:${playedSeconds.toString().padStart(2, '0')}`;
    
    timePlayedElement.textContent = timePlayedText;

    // Handle remaining time
    if (timeData?.remainingTime === null || timeData?.remainingTime === undefined) {
      if (timeRemainingContainer) {
        timeRemainingContainer.style.display = 'none';
      }
    } else if (timeData.remainingTime !== null) {
      const currentRemainingTime = Math.max(0, timeData.remainingTime - (localPlayedTime - (timeData.playedTime || 0)));
      const minutes = Math.floor(currentRemainingTime / 60);
      const seconds = currentRemainingTime % 60;
      const timeRemainingText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      if (timeRemainingElement) {
        timeRemainingElement.textContent = timeRemainingText;
      }
      if (timeRemainingContainer) {
        timeRemainingContainer.style.display = 'block';
      }
    }
  };

  // Update display when local time changes
  useEffect(() => {
    updateTimeDisplay();
  }, [localPlayedTime, timeData]);
  // Set up WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const handleTimeUpdateEvent = (data: TimeData) => {
      handleTimeUpdate(data);
    };

    const handleGameTimeEvent = (data: TimeData) => {
      handleTimeUpdate(data);
    };

    const handleControlPointTimesEvent = (data: ControlPointTimeData[]) => {
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

  // Handle game state changes
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

  return {
    timeData,
    isGameRunning: currentGame?.status === 'running',
    controlPointTimes
  };
};