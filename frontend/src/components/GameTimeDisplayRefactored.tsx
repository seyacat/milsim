import React from 'react';
import { Game } from '../types';

interface GameTimeDisplayRefactoredProps {
  currentGame: Game | null;
  timeData?: {
    remainingTime: number | null;
    playedTime: number;
    totalTime: number | null;
  };
}

export const GameTimeDisplayRefactored: React.FC<GameTimeDisplayRefactoredProps> = ({
  currentGame,
  timeData
}) => {
  // Show time played container only when game is running or paused
  const shouldShowTimePlayed = currentGame?.status === 'running' || currentGame?.status === 'paused';

  if (!shouldShowTimePlayed || !timeData) {
    return null;
  }

  // Format time played
  const playedMinutes = Math.floor(timeData.playedTime / 60);
  const playedSeconds = timeData.playedTime % 60;
  const timePlayedText = `${playedMinutes}:${playedSeconds.toString().padStart(2, '0')}`;

  // Format remaining time if available
  const hasRemainingTime = timeData.remainingTime !== null && timeData.remainingTime !== undefined;
  let timeRemainingText = '';
  
  if (hasRemainingTime && timeData.remainingTime !== null) {
    const currentRemainingTime = Math.max(0, timeData.remainingTime);
    const minutes = Math.floor(currentRemainingTime / 60);
    const seconds = currentRemainingTime % 60;
    timeRemainingText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  return (
    <div id="timePlayedContainer" style={{ display: 'block' }}>
      <div>Tiempo jugado: <span id="timePlayed">{timePlayedText}</span></div>
      {hasRemainingTime && (
        <div id="timeRemainingContainer" style={{ display: 'block' }}>
          Tiempo restante: <span id="timeRemaining">{timeRemainingText}</span>
        </div>
      )}
    </div>
  );
};