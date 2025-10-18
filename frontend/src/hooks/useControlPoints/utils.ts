import { ControlPoint } from '../../types';

// Get control point icon properties
export const getControlPointIcon = (controlPoint: ControlPoint) => {
  let iconColor = '#2196F3'; // Default for control_point
  let iconEmoji = '🚩'; // Default for control_point

  // Check ownership first - override color based on team
  if (controlPoint.ownedByTeam) {
    const teamColors: Record<string, string> = {
      'blue': '#2196F3',
      'red': '#F44336',
      'green': '#4CAF50',
      'yellow': '#FFEB3B'
    };
    iconColor = teamColors[controlPoint.ownedByTeam] || '#2196F3';
  } else {
    // When not owned by any team, use gray color
    iconColor = '#9E9E9E';
  }

  // If bomb challenge is active, use bomb emoji
  if (controlPoint.hasBombChallenge) {
    iconEmoji = '💣';
  } else {
    switch (controlPoint.type) {
      case 'site':
        // Only use orange color for site if not owned by a team
        if (!controlPoint.ownedByTeam) {
          iconColor = '#FF9800';
        }
        iconEmoji = '🏠';
        break;
      case 'control_point':
      default:
        iconEmoji = '🚩';
        break;
    }
  }

  return { iconColor, iconEmoji };
};

// Toggle functions for challenge inputs
export const togglePositionInputs = (controlPointId: number) => {
  const positionInputs = document.getElementById(`positionInputs_${controlPointId}`);
  if (positionInputs) {
    positionInputs.style.display = positionInputs.style.display === 'none' ? 'block' : 'none';
  }
};

export const toggleCodeInputs = (controlPointId: number) => {
  const codeInputs = document.getElementById(`codeInputs_${controlPointId}`);
  if (codeInputs) {
    codeInputs.style.display = codeInputs.style.display === 'none' ? 'block' : 'none';
  }
};

export const toggleBombInputs = (controlPointId: number) => {
  const bombInputs = document.getElementById(`bombInputs_${controlPointId}`);
  if (bombInputs) {
    bombInputs.style.display = bombInputs.style.display === 'none' ? 'block' : 'none';
  }
};