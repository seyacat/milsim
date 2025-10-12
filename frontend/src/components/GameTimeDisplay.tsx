import React from 'react';
import { useGameTime } from '../hooks/useGameTime';
import { Game } from '../types';
import { Socket } from 'socket.io-client';

interface GameTimeDisplayProps {
  currentGame: Game | null;
  socket: Socket | null;
}

export const GameTimeDisplay: React.FC<GameTimeDisplayProps> = ({ currentGame, socket }) => {
  const { timeData, isGameRunning, updateTimeDisplay } = useGameTime(currentGame, socket);

  // Update display when time data changes
  React.useEffect(() => {
    updateTimeDisplay();
  }, [timeData, updateTimeDisplay]);

  // Show time played container only when game is running or paused (like in original code)
  // TEMPORARILY: Show always for debugging
  const shouldShowTimePlayed = true; // currentGame?.status === 'running' || currentGame?.status === 'paused';

  if (!shouldShowTimePlayed) {
    return null;
  }

  return (
    <div id="timePlayedContainer" style={{ display: 'block' }}>
      <div>Tiempo jugado: <span id="timePlayed">00:00</span></div>
      {timeData?.remainingTime !== null && timeData?.remainingTime !== undefined && (
        <div id="timeRemainingContainer" style={{ display: 'block' }}>
          Tiempo restante: <span id="timeRemaining">00:00</span>
        </div>
      )}
    </div>
  );
};