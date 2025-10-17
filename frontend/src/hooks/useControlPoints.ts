
import { useState, useCallback, useEffect, useRef } from 'react';
import { ControlPoint, Game } from '../types';
import * as L from 'leaflet';

interface UseControlPointsProps {
  game: Game | null;
  map: L.Map | null;
  isOwner: boolean;
  socket: any;
  showToast?: (message: string, type: string) => void;
}

export const useControlPoints = ({ game, map, isOwner, socket, showToast }: UseControlPointsProps) => {
  
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const controlPointMarkers = useRef<Map<number, L.Marker>>(new Map());
  const positionCircles = useRef<Map<number, L.Circle>>(new Map());
  const pieCharts = useRef<Map<number, L.SVGOverlay>>(new Map());

  // Function to update all control point timer displays
  const updateAllControlPointTimers = useCallback(() => {
    if (!game?.controlPoints) return;
    
    
    game.controlPoints.forEach(controlPoint => {
      const timerElement = document.getElementById(`timer_${controlPoint.id}`);
      if (timerElement) {
        // Show timer only if control point is owned by a team and game is running
        const shouldShow = game.status === 'running' && controlPoint.ownedByTeam !== null;
        
        if (shouldShow) {
          timerElement.style.display = 'block';
          // The actual time value will be updated by useControlPointTimers hook
        } else {
          timerElement.style.display = 'none';
        }
      }
    });
  }, [game?.controlPoints, game?.status]);

  // Enable drag mode for control points
  const enableDragMode = useCallback((controlPointId: number, markerId: number) => {
    if (!map) return;

    // Find the marker
    const targetMarker = controlPointMarkers.current.get(controlPointId);
    if (!targetMarker) {
      console.error(`Marker not found for control point ${controlPointId}`);
      return;
    }

    // Close the popup menu
    targetMarker.closePopup();

    // Make marker draggable
    if (targetMarker.dragging) {
      targetMarker.dragging.enable();
    }

    // Change cursor to indicate drag mode
    const markerElement = targetMarker.getElement();
    if (markerElement) {
      markerElement.style.cursor = 'move';
    }

    // Add dragend event listener to update position when dragging stops
    targetMarker.on('dragend', function(event) {
      const marker = event.target;
      const newPosition = marker.getLatLng();
      
      // Update control point position via WebSocket
      if (socket && game) {
        socket.emit('gameAction', {
          gameId: game.id,
          action: 'updateControlPointPosition',
          data: {
            controlPointId: controlPointId,
            latitude: newPosition.lat,
            longitude: newPosition.lng
          }
        });
      }
      
      // Disable dragging after placement
      if (marker.dragging) {
        marker.dragging.disable();
      }
      const markerElement = marker.getElement();
      if (markerElement) {
        markerElement.style.cursor = '';
      }
    });

    // Show instruction message
    if (showToast) {
      showToast('Arrastra el punto a la nueva ubicación y haz clic para colocarlo', 'success');
    }
  }, [map, socket, game, showToast]);

  // Handle position challenge updates
  const updatePositionChallengeBars = useCallback((controlPointId: number, teamPoints: Record<string, number>) => {
    if (!map) return;

    // Find the control point marker
    const marker = controlPointMarkers.current.get(controlPointId);
    if (!marker) return;

    // Check if pie chart exists, if not create it
    if (!(marker as any).pieElement || !(marker as any).pieSvg) {
      const controlPoint = controlPoints.find(cp => cp.id === controlPointId);
      const positionCircle = positionCircles.current.get(controlPointId);
      
      if (controlPoint && controlPoint.hasPositionChallenge && controlPoint.minDistance && positionCircle) {
        createPositionChallengePieChart(marker, controlPoint, positionCircle);
      } else {
        return;
      }
    }

    // Calculate total points to determine percentages
    const totalPoints = Object.values(teamPoints).reduce((sum, points) => sum + points, 0);

    // Team colors
    const teamColors: Record<string, string> = {
      'blue': '#2196F3',
      'red': '#F44336',
      'green': '#4CAF50',
      'yellow': '#FFEB3B'
    };

    // Get control point to verify position challenge is active
    const controlPoint = controlPoints.find(cp => cp.id === controlPointId);
    
    // Only update if we have points and position challenge is active
    if (totalPoints > 0 && controlPoint && controlPoint.hasPositionChallenge && game?.status === 'running') {
      
      // Check if pie chart exists
      if (!(marker as any).pieElement) {
        return;
      }

      // Clear existing pie slices
      (marker as any).pieElement.innerHTML = '';

      let startAngle = 0;

      // Create pie slices for each team with points
      Object.entries(teamPoints).forEach(([team, points]) => {
        if (points > 0) {
          const percentage = points / totalPoints;
          const sliceAngle = percentage * 2 * Math.PI;
          const endAngle = startAngle + sliceAngle;

          // Get stored dimensions
          const { svgWidth, svgHeight, radiusPixels } = (marker as any).pieData;
          const svgCenterX = svgWidth / 2;
          const svgCenterY = svgHeight / 2;
          const startX = svgCenterX + radiusPixels * Math.cos(startAngle);
          const startY = svgCenterY + radiusPixels * Math.sin(startAngle);
          const endX = svgCenterX + radiusPixels * Math.cos(endAngle);
          const endY = svgCenterY + radiusPixels * Math.sin(endAngle);

          // Create path for pie slice
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          
          let pathData;
          if (Math.abs(sliceAngle - 2 * Math.PI) < 0.001) {
            // Full circle - create a complete circle
            pathData = [
              `M ${svgCenterX} ${svgCenterY}`,
              `L ${svgCenterX + radiusPixels} ${svgCenterY}`,
              `A ${radiusPixels} ${radiusPixels} 0 1 1 ${svgCenterX - radiusPixels} ${svgCenterY}`,
              `A ${radiusPixels} ${radiusPixels} 0 1 1 ${svgCenterX + radiusPixels} ${svgCenterY}`,
              'Z'
            ].join(' ');
          } else {
            // Partial slice
            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
            pathData = [
              `M ${svgCenterX} ${svgCenterY}`,
              `L ${startX} ${startY}`,
              `A ${radiusPixels} ${radiusPixels} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              'Z'
            ].join(' ');
          }

          path.setAttribute('d', pathData);
          path.setAttribute('fill', teamColors[team] || '#9E9E9E');
          path.setAttribute('opacity', '0.8');
          path.setAttribute('stroke', 'none');
          path.setAttribute('stroke-width', '0');
          
          (marker as any).pieElement.appendChild(path);

          startAngle = endAngle;
        }
      });

      // Update stored team points
      (marker as any).pieData.teamPoints = teamPoints;

      // Force map refresh
      setTimeout(() => {
        map.invalidateSize();
      }, 50);
    } else {
      // If no points, clear the pie chart but keep the SVG overlay
      if ((marker as any).pieElement) {
        (marker as any).pieElement.innerHTML = '';
        (marker as any).pieData.teamPoints = {};
      }
    }
  }, [map, game?.status, controlPoints]);

  // Handle bomb timer updates
  const handleBombTimeUpdate = useCallback((data: any) => {
    const { controlPointId, remainingTime, isActive, exploded } = data;
    
    if (exploded) {
      // Bomb exploded - show notification
      if (showToast) {
        showToast('Bomba explotó en el punto de control!', 'error');
      }
      return;
    }

    if (!isActive) {
      // Bomb timer is no longer active
      return;
    }

    // Update bomb timer display
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
    if (bombTimerElement) {
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      bombTimerElement.textContent = formattedTime;
      
      // Show warning colors when time is running low
      if (remainingTime <= 60) {
        bombTimerElement.style.background = 'rgba(244, 67, 54, 0.9)';
      } else if (remainingTime <= 180) {
        bombTimerElement.style.background = 'rgba(255, 152, 0, 0.9)';
      } else {
        bombTimerElement.style.background = 'rgba(255, 87, 34, 0.9)';
      }
      
      bombTimerElement.style.display = 'block';
    }
  }, [showToast]);

  // Activate bomb as owner
  const activateBombAsOwner = useCallback((controlPointId: number) => {
    if (!socket || !game) return;

    socket.emit('gameAction', {
      gameId: game.id,
      action: 'activateBombAsOwner',
      data: {
        controlPointId: controlPointId
      }
    });

    if (showToast) {
      showToast('Bomba activada', 'success');
    }
  }, [socket, game, showToast]);

  // Deactivate bomb as owner
  const deactivateBombAsOwner = useCallback((controlPointId: number) => {
    if (!socket || !game) return;

    socket.emit('gameAction', {
      gameId: game.id,
      action: 'deactivateBombAsOwner',
      data: {
        controlPointId: controlPointId
      }
    });

    if (showToast) {
      showToast('Bomba desactivada', 'success');
    }
  }, [socket, game, showToast]);

  // Assign team to control point
  const assignControlPointTeam = useCallback((controlPointId: number, team: string) => {
    if (!socket || !game) return;

    socket.emit('gameAction', {
      gameId: game.id,
      action: 'assignControlPointTeam',
      data: {
        controlPointId: controlPointId,
        team: team
      }
    });

    if (showToast) {
      showToast(`Equipo asignado: ${team}`, 'success');
    }
  }, [socket, game, showToast]);

  // Update control point properties
  const updateControlPoint = useCallback((controlPointId: number, markerId: number) => {
    if (!socket || !game) return;

    // Get form values using the same IDs as the original code
    const typeSelect = document.getElementById(`controlPointType_${controlPointId}`) as HTMLSelectElement;
    const nameInput = document.getElementById(`controlPointEditName_${controlPointId}`) as HTMLInputElement;
    const positionChallengeCheckbox = document.getElementById(`positionChallenge_${controlPointId}`) as HTMLInputElement;
    const minDistanceSelect = document.getElementById(`controlPointMinDistance_${controlPointId}`) as HTMLSelectElement;
    const minAccuracySelect = document.getElementById(`controlPointMinAccuracy_${controlPointId}`) as HTMLSelectElement;
    const codeChallengeCheckbox = document.getElementById(`codeChallenge_${controlPointId}`) as HTMLInputElement;
    const codeInput = document.getElementById(`controlPointCode_${controlPointId}`) as HTMLInputElement;
    const bombChallengeCheckbox = document.getElementById(`bombChallenge_${controlPointId}`) as HTMLInputElement;
    const bombTimeSelect = document.getElementById(`controlPointBombTime_${controlPointId}`) as HTMLSelectElement;
    const armedCodeInput = document.getElementById(`controlPointArmedCode_${controlPointId}`) as HTMLInputElement;
    const disarmedCodeInput = document.getElementById(`controlPointDisarmedCode_${controlPointId}`) as HTMLInputElement;

    // Validate required fields
    if (!nameInput?.value.trim()) {
      if (showToast) {
        showToast('Por favor ingresa un nombre para el punto', 'warning');
      }
      return;
    }

    // Prepare update data following the original structure
    const updateData = {
      controlPointId: controlPointId,
      name: nameInput.value.trim(),
      type: typeSelect?.value || 'control_point',
      hasPositionChallenge: positionChallengeCheckbox?.checked || false,
      hasCodeChallenge: codeChallengeCheckbox?.checked || false,
      hasBombChallenge: bombChallengeCheckbox?.checked || false
    };

    // Add position challenge values
    const minDistance = minDistanceSelect?.value || '';
    const minAccuracy = minAccuracySelect?.value || '';
    
    // Validate position challenge if checked
    if (positionChallengeCheckbox?.checked) {
      if (!minDistance || !minAccuracy) {
        if (showToast) {
          showToast('Para position challenge, debes seleccionar tanto la distancia mínima como el accuracy mínimo', 'warning');
        }
        return;
      }
    }
    
    // Always send position values (they will be null if not selected)
    (updateData as any).minDistance = minDistance ? parseInt(minDistance) : null;
    (updateData as any).minAccuracy = minAccuracy ? parseInt(minAccuracy) : null;

    // Add code challenge values
    const code = codeInput?.value.trim() || '';
    
    // Validate code challenge if checked
    if (codeChallengeCheckbox?.checked) {
      if (!code) {
        if (showToast) {
          showToast('Para code challenge, debes ingresar un código', 'warning');
        }
        return;
      }
    }
    
    // Always send code value (it will be null if empty)
    (updateData as any).code = code || null;

    // Add bomb challenge values
    const bombTime = bombTimeSelect?.value || '';
    const armedCode = armedCodeInput?.value.trim() || '';
    const disarmedCode = disarmedCodeInput?.value.trim() || '';
    
    // Validate bomb challenge if checked
    if (bombChallengeCheckbox?.checked) {
      if (!armedCode || !disarmedCode) {
        if (showToast) {
          showToast('Para bomb challenge, debes ingresar tanto el código para armar como el código para desarmar', 'warning');
        }
        return;
      }
    }
    
    // Always send bomb values (they will be null if not selected)
    (updateData as any).bombTime = bombTime ? parseInt(bombTime) : null;
    (updateData as any).armedCode = armedCode || null;
    (updateData as any).disarmedCode = disarmedCode || null;

    // Send update via WebSocket following the original structure
    socket.emit('gameAction', {
      gameId: game.id,
      action: 'updateControlPoint',
      data: updateData
    });

    if (showToast) {
      showToast('Punto actualizado exitosamente', 'success');
    }

    // Close the popup
    const marker = controlPointMarkers.current.get(controlPointId);
    if (marker) {
      marker.closePopup();
    }
  }, [socket, game, showToast]);

  // Delete control point
  const deleteControlPoint = useCallback((controlPointId: number, markerId: number) => {
    if (!socket || !game) return;

    if (confirm('¿Estás seguro de que quieres eliminar este punto?')) {
      socket.emit('gameAction', {
        gameId: game.id,
        action: 'deleteControlPoint',
        data: {
          controlPointId: controlPointId
        }
      });

      if (showToast) {
        showToast('Punto eliminado exitosamente', 'success');
      }

      // Close the popup
      const marker = controlPointMarkers.current.get(controlPointId);
      if (marker) {
        marker.closePopup();
      }
    }
  }, [socket, game, showToast]);

  // Make functions available globally for popup buttons
  useEffect(() => {
    (window as any).enableDragMode = enableDragMode;
    (window as any).updateControlPoint = updateControlPoint;
    (window as any).deleteControlPoint = deleteControlPoint;
    (window as any).activateBombAsOwner = activateBombAsOwner;
    (window as any).deactivateBombAsOwner = deactivateBombAsOwner;
    (window as any).assignControlPointTeam = assignControlPointTeam;
    (window as any).togglePositionInputs = togglePositionInputs;
    (window as any).toggleCodeInputs = toggleCodeInputs;
    (window as any).toggleBombInputs = toggleBombInputs;
  }, [enableDragMode, updateControlPoint, deleteControlPoint, activateBombAsOwner, deactivateBombAsOwner, assignControlPointTeam]);

  // Listen for WebSocket events related to challenges
  useEffect(() => {
    if (!socket) return;

    const handlePositionChallengeUpdate = (data: any) => {
      const { controlPointId, teamPoints } = data;
      updatePositionChallengeBars(controlPointId, teamPoints);
    };

    const handleBombTimeUpdateEvent = (data: any) => {
      handleBombTimeUpdate(data);
    };

    socket.on('positionChallengeUpdate', handlePositionChallengeUpdate);
    socket.on('bombTimeUpdate', handleBombTimeUpdateEvent);

    return () => {
      socket.off('positionChallengeUpdate', handlePositionChallengeUpdate);
      socket.off('bombTimeUpdate', handleBombTimeUpdateEvent);
    };
  }, [socket, updatePositionChallengeBars, handleBombTimeUpdate]);

  // Initialize control points from game data
  useEffect(() => {
    if (game?.controlPoints) {
      setControlPoints(game.controlPoints);
    }
  }, [game?.controlPoints]);

  // Render control points on map
  const renderControlPoints = useCallback(() => {
    if (!map || !controlPoints.length) return;

    // Clear existing markers
    controlPointMarkers.current.forEach((marker) => {
      map.removeLayer(marker);
    });
    controlPointMarkers.current.clear();

    positionCircles.current.forEach((circle) => {
      map.removeLayer(circle);
    });
    positionCircles.current.clear();

    pieCharts.current.forEach((pieChart) => {
      map.removeLayer(pieChart);
    });
    pieCharts.current.clear();

    // Create new markers
    controlPoints.forEach((controlPoint) => {
      const marker = createControlPointMarker(controlPoint, map, isOwner);
      if (marker) {
        controlPointMarkers.current.set(controlPoint.id, marker);
      }

      // Add position circle if position challenge is active
      if (controlPoint.hasPositionChallenge && controlPoint.minDistance) {
        const circle = createPositionCircle(controlPoint, map);
        if (circle) {
          positionCircles.current.set(controlPoint.id, circle);
        }
      }
    });
  }, [map, controlPoints, isOwner]);

  // Update control points when they change
  useEffect(() => {
    renderControlPoints();
    updateAllControlPointTimers();
  }, [renderControlPoints, updateAllControlPointTimers]);

  // Update single control point marker (for team color changes)
  const updateSingleControlPointMarker = useCallback((controlPoint: ControlPoint) => {
    if (!map) return;


    // Find and remove existing marker
    const existingMarker = controlPointMarkers.current.get(controlPoint.id);
    if (existingMarker) {
      map.removeLayer(existingMarker);
      controlPointMarkers.current.delete(controlPoint.id);
    }

    // Remove position circle if exists
    const existingCircle = positionCircles.current.get(controlPoint.id);
    if (existingCircle) {
      map.removeLayer(existingCircle);
      positionCircles.current.delete(controlPoint.id);
    }

    // Remove pie chart if exists
    const existingPieChart = pieCharts.current.get(controlPoint.id);
    if (existingPieChart) {
      map.removeLayer(existingPieChart);
      pieCharts.current.delete(controlPoint.id);
    }

    // Create new marker with updated data
    const newMarker = createControlPointMarker(controlPoint, map, isOwner);
    if (newMarker) {
      controlPointMarkers.current.set(controlPoint.id, newMarker);
    }

    // Add position circle if position challenge is active
    if (controlPoint.hasPositionChallenge && controlPoint.minDistance) {
      const circle = createPositionCircle(controlPoint, map);
      if (circle) {
        positionCircles.current.set(controlPoint.id, circle);
      }
    }
  }, [map, isOwner]);

  // Handle WebSocket events for control points
  useEffect(() => {
    if (!socket) {
      return;
    }


    const handleControlPointCreated = (data: { controlPoint: ControlPoint }) => {
      setControlPoints(prev => [...prev, data.controlPoint]);
    };

    const handleControlPointUpdated = (data: { controlPoint: ControlPoint }) => {
      
      setControlPoints(prev =>
        prev.map(cp => cp.id === data.controlPoint.id ? data.controlPoint : cp)
      );
      
      // Force update the marker for this control point to reflect color changes
      updateSingleControlPointMarker(data.controlPoint);
    };

    const handleControlPointDeleted = (data: { controlPointId: number }) => {
      setControlPoints(prev => prev.filter(cp => cp.id !== data.controlPointId));
      
      // Remove marker from map
      const marker = controlPointMarkers.current.get(data.controlPointId);
      if (marker && map) {
        map.removeLayer(marker);
        controlPointMarkers.current.delete(data.controlPointId);
      }

      // Remove position circle
      const circle = positionCircles.current.get(data.controlPointId);
      if (circle && map) {
        map.removeLayer(circle);
        positionCircles.current.delete(data.controlPointId);
      }

      // Remove pie chart
      const pieChart = pieCharts.current.get(data.controlPointId);
      if (pieChart && map) {
        map.removeLayer(pieChart);
        pieCharts.current.delete(data.controlPointId);
      }
    };

    socket.on('controlPointCreated', handleControlPointCreated);
    socket.on('controlPointUpdated', handleControlPointUpdated);
    socket.on('controlPointDeleted', handleControlPointDeleted);


    return () => {
      socket.off('controlPointCreated', handleControlPointCreated);
      socket.off('controlPointUpdated', handleControlPointUpdated);
      socket.off('controlPointDeleted', handleControlPointDeleted);
    };
  }, [socket, map, updateSingleControlPointMarker]);

  return {
    controlPoints,
    controlPointMarkers: controlPointMarkers.current,
    positionCircles: positionCircles.current,
    pieCharts: pieCharts.current,
    enableDragMode,
    updatePositionChallengeBars,
    handleBombTimeUpdate,
    activateBombAsOwner,
    deactivateBombAsOwner,
    assignControlPointTeam,
    updateAllControlPointTimers,
    updateSingleControlPointMarker
  };
};

// Create control point marker
const createControlPointMarker = (controlPoint: ControlPoint, map: L.Map, isOwner: boolean): L.Marker | null => {
  const { iconColor, iconEmoji } = getControlPointIcon(controlPoint);

  const controlPointIcon = L.divIcon({
    className: 'control-point-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <!-- Timer display above marker -->
        <div class="control-point-timer"
             id="timer_${controlPoint.id}"
             style="
                 position: absolute;
                 top: -20px;
                 left: 50%;
                 transform: translateX(-50%);
                 background: rgba(0, 0, 0, 0.7);
                 color: white;
                 padding: 2px 4px;
                 border-radius: 3px;
                 font-size: 10px;
                 font-weight: bold;
                 white-space: nowrap;
                 display: ${(controlPoint.ownedByTeam) ? 'block' : 'none'};
                 z-index: 1000;
             ">${controlPoint.displayTime || '00:00'}</div>
        <!-- Position challenge bars -->
        <div class="position-challenge-bars"
             id="position_challenge_bars_${controlPoint.id}"
             style="
                 position: absolute;
                 top: -45px;
                 left: 50%;
                 transform: translateX(-50%);
                 display: ${(controlPoint.hasPositionChallenge) ? 'flex' : 'none'};
                 flex-direction: column;
                 gap: 2px;
                 width: 40px;
                 z-index: 1000;
             ">
        </div>
        <!-- Control point marker -->
        <div style="
            background: ${iconColor}80;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        ">${iconEmoji}</div>
        <!-- Bomb timer display -->
        <div class="bomb-timer"
             id="bomb_timer_${controlPoint.id}"
             style="
                 position: absolute;
                 bottom: -20px;
                 left: 50%;
                 transform: translateX(-50%);
                 background: rgba(255, 87, 34, 0.9);
                 color: white;
                 padding: 2px 4px;
                 border-radius: 3px;
                 font-size: 10px;
                 font-weight: bold;
                 white-space: nowrap;
                 display: none;
                 z-index: 1000;
             ">00:00</div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const marker = L.marker([controlPoint.latitude, controlPoint.longitude], {
    icon: controlPointIcon
  }).addTo(map);

  // Store control point data on marker
  (marker as any).controlPointData = controlPoint;

  // Add popup for owners or players
  if (isOwner) {
    const popupContent = createOwnerPopupContent(controlPoint, marker);
    marker.bindPopup(popupContent, {
      closeOnClick: false,
      autoClose: false,
      closeButton: true
    });
  } else {
    // For players, create interactive popup
    const popupContent = createPlayerPopupContent(controlPoint, marker);
    marker.bindPopup(popupContent, {
      closeOnClick: false,
      autoClose: false,
      closeButton: true
    });
  }

  return marker;
};

// Get control point icon properties
const getControlPointIcon = (controlPoint: ControlPoint) => {
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

// Create position circle for position challenge
const createPositionCircle = (controlPoint: ControlPoint, map: L.Map): L.Circle | null => {
  if (!controlPoint.minDistance) return null;

  const circle = L.circle([controlPoint.latitude, controlPoint.longitude], {
    radius: controlPoint.minDistance,
    color: '#FF9800', // Orange color
    fillColor: 'transparent',
    fillOpacity: 0,
    weight: 2,
    opacity: 0.8
  }).addTo(map);

  // Store control point ID with circle
  (circle as any).controlPointId = controlPoint.id;

  return circle;
};

// Toggle functions for challenge inputs
const togglePositionInputs = (controlPointId: number) => {
  const positionInputs = document.getElementById(`positionInputs_${controlPointId}`);
  if (positionInputs) {
    positionInputs.style.display = positionInputs.style.display === 'none' ? 'block' : 'none';
  }
};

const toggleCodeInputs = (controlPointId: number) => {
  const codeInputs = document.getElementById(`codeInputs_${controlPointId}`);
  if (codeInputs) {
    codeInputs.style.display = codeInputs.style.display === 'none' ? 'block' : 'none';
  }
};

const toggleBombInputs = (controlPointId: number) => {
  const bombInputs = document.getElementById(`bombInputs_${controlPointId}`);
  if (bombInputs) {
    bombInputs.style.display = bombInputs.style.display === 'none' ? 'block' : 'none';
  }
};

// Create owner popup content
const createOwnerPopupContent = (controlPoint: ControlPoint, marker: L.Marker): HTMLElement => {
  const popup = document.createElement('div');
  popup.className = 'control-point-edit-menu';
  
  // Check if there's already a Site in the game (excluding current point)
  const hasOtherSite = false; // This would need to be calculated from existing control points

  let typeOptions = '';
  if (hasOtherSite && controlPoint.type !== 'site') {
    typeOptions = `
      <option value="control_point" ${controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
    `;
  } else {
    typeOptions = `
      <option value="site" ${controlPoint.type === 'site' ? 'selected' : ''}>Site</option>
      <option value="control_point" ${!controlPoint.type || controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
    `;
  }

  popup.innerHTML = `
    <div class="control-point-edit-content">
      <h4 class="edit-title">Editar Punto</h4>
      ${controlPoint.ownedByTeam ? `
        <div class="ownership-status" style="background: ${controlPoint.ownedByTeam}; color: white; padding: 5px; border-radius: 4px; margin-bottom: 10px; text-align: center; font-weight: bold;">
          Controlado por: ${controlPoint.ownedByTeam.toUpperCase()}
        </div>
        <div class="hold-time" style="font-size: 12px; color: #666; text-align: center; margin-bottom: 10px;">
          Tiempo: ${controlPoint.displayTime || '00:00'}
        </div>
      ` : ''}
      
      <div class="form-group">
        <label class="form-label">Tipo:</label>
        <select id="controlPointType_${controlPoint.id}" class="form-input">
          ${typeOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre:</label>
        <input type="text" id="controlPointEditName_${controlPoint.id}" value="${controlPoint.name}" class="form-input">
      </div>
      
      <!-- Team Assignment -->
      <div class="form-group">
        <label class="form-label">Asignar Equipo:</label>
        <div class="team-buttons" style="display: flex; gap: 5px; margin-top: 5px;">
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'blue')" class="btn btn-blue" style="background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Azul</button>
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'red')" class="btn btn-red" style="background: #F44336; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Rojo</button>
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'green')" class="btn btn-green" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Verde</button>
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'yellow')" class="btn btn-yellow" style="background: #FFEB3B; color: black; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Amarillo</button>
        </div>
      </div>
      
      <!-- Challenges Section -->
      <div class="challenges-section" style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">
        <h5 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Desafíos</h5>
        
        <!-- Position Challenge -->
        <div class="challenge-item" style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="positionChallenge_${controlPoint.id}" ${controlPoint.hasPositionChallenge ? 'checked' : ''}
                   onchange="window.togglePositionInputs(${controlPoint.id})" style="margin-right: 8px;">
            <span style="font-size: 13px;">Desafío de Posición</span>
          </label>
          <div id="positionInputs_${controlPoint.id}" style="margin-top: 5px; margin-left: 20px; display: ${controlPoint.hasPositionChallenge ? 'block' : 'none'}">
            <div class="form-group">
              <label class="form-label">Distancia Mínima:</label>
              <select id="controlPointMinDistance_${controlPoint.id}" class="form-input">
                <option value="5" ${controlPoint.minDistance === 5 ? 'selected' : ''}>5m (Muy cercano)</option>
                <option value="10" ${controlPoint.minDistance === 10 ? 'selected' : ''}>10m (Cercano)</option>
                <option value="25" ${controlPoint.minDistance === 25 ? 'selected' : ''}>25m (Medio)</option>
                <option value="50" ${controlPoint.minDistance === 50 ? 'selected' : ''}>50m (Lejano)</option>
                <option value="100" ${controlPoint.minDistance === 100 ? 'selected' : ''}>100m (Muy lejano)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Accuracy Mínimo:</label>
              <select id="controlPointMinAccuracy_${controlPoint.id}" class="form-input">
                <option value="5" ${controlPoint.minAccuracy === 5 ? 'selected' : ''}>5m (Alta precisión)</option>
                <option value="10" ${controlPoint.minAccuracy === 10 ? 'selected' : ''}>10m (Buena precisión)</option>
                <option value="20" ${controlPoint.minAccuracy === 20 ? 'selected' : ''}>20m (Precisión media)</option>
                <option value="50" ${controlPoint.minAccuracy === 50 ? 'selected' : ''}>50m (Baja precisión)</option>
                <option value="100" ${controlPoint.minAccuracy === 100 ? 'selected' : ''}>100m (Muy baja precisión)</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Code Challenge -->
        <div class="challenge-item" style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="codeChallenge_${controlPoint.id}" ${controlPoint.hasCodeChallenge ? 'checked' : ''}
                   onchange="window.toggleCodeInputs(${controlPoint.id})" style="margin-right: 8px;">
            <span style="font-size: 13px;">Desafío de Código</span>
          </label>
          <div id="codeInputs_${controlPoint.id}" style="margin-top: 5px; margin-left: 20px; display: ${controlPoint.hasCodeChallenge ? 'block' : 'none'}">
            <div class="form-group">
              <label class="form-label">Code:</label>
              <input type="text" id="controlPointCode_${controlPoint.id}" value="${controlPoint.code || ''}" class="form-input" placeholder="Código para tomar">
            </div>
          </div>
        </div>
        
        <!-- Bomb Challenge -->
        <div class="challenge-item" style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="bombChallenge_${controlPoint.id}" ${controlPoint.hasBombChallenge ? 'checked' : ''}
                   onchange="window.toggleBombInputs(${controlPoint.id})" style="margin-right: 8px;">
            <span style="font-size: 13px;">Desafío de Bomba</span>
          </label>
          <div id="bombInputs_${controlPoint.id}" style="margin-top: 5px; margin-left: 20px; display: ${controlPoint.hasBombChallenge ? 'block' : 'none'}">
            <div class="form-group">
              <label class="form-label">Bomb Time:</label>
              <select id="controlPointBombTime_${controlPoint.id}" class="form-input">
                <option value="60" ${controlPoint.bombTime === 60 ? 'selected' : ''}>1 minuto</option>
                <option value="120" ${controlPoint.bombTime === 120 ? 'selected' : ''}>2 minutos</option>
                <option value="180" ${controlPoint.bombTime === 180 ? 'selected' : ''}>3 minutos</option>
                <option value="300" ${controlPoint.bombTime === 300 ? 'selected' : ''}>5 minutos</option>
                <option value="600" ${controlPoint.bombTime === 600 ? 'selected' : ''}>10 minutos</option>
                <option value="900" ${controlPoint.bombTime === 900 ? 'selected' : ''}>15 minutos</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Armed Code:</label>
              <input type="text" id="controlPointArmedCode_${controlPoint.id}" value="${controlPoint.armedCode || ''}" class="form-input" placeholder="Código para armar">
            </div>
            <div class="form-group">
              <label class="form-label">Disarmed Code:</label>
              <input type="text" id="controlPointDisarmedCode_${controlPoint.id}" value="${controlPoint.disarmedCode || ''}" class="form-input" placeholder="Código para desarmar">
            </div>
            ${controlPoint.hasBombChallenge ? `
              <div style="margin-top: 10px; display: flex; gap: 5px;">
                <button onclick="window.activateBombAsOwner(${controlPoint.id})" class="btn btn-danger" style="background: #F44336; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Activar Bomba</button>
                <button onclick="window.deactivateBombAsOwner(${controlPoint.id})" class="btn btn-success" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Desactivar</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="action-buttons" style="margin-top: 15px; display: flex; gap: 5px; justify-content: space-between;">
        <button onclick="window.enableDragMode(${controlPoint.id}, ${(marker as any)._leaflet_id})" class="btn btn-move" title="Mover punto" style="background: rgba(33, 150, 243, 0.2); border: 1px solid #2196F3; color: #2196F3; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">🧭 Mover</button>
        <button onclick="window.updateControlPoint(${controlPoint.id}, ${(marker as any)._leaflet_id})" class="btn btn-primary" style="background: #2196F3; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Actualizar</button>
        <button onclick="window.deleteControlPoint(${controlPoint.id}, ${(marker as any)._leaflet_id})" class="btn btn-danger" style="background: #F44336; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Eliminar</button>
      </div>
    </div>
  `;

  return popup;
};

// Create player popup content
const createPlayerPopupContent = (controlPoint: ControlPoint, marker: L.Marker): HTMLElement => {
  const popup = document.createElement('div');
  popup.className = 'control-point-popup player';
  
  // Show ownership status and hold time
  let ownershipStatus = '';
  if (controlPoint.ownedByTeam) {
    const teamColors: Record<string, string> = {
      'blue': 'Azul',
      'red': 'Rojo',
      'green': 'Verde',
      'yellow': 'Amarillo'
    };
    const holdTime = controlPoint.displayTime || '00:00';
    ownershipStatus = `
      <div class="ownership-status" style="color: ${controlPoint.ownedByTeam}; font-weight: bold;">
        Controlado por: ${teamColors[controlPoint.ownedByTeam] || controlPoint.ownedByTeam}
      </div>
      <div class="hold-time" style="font-size: 12px; color: #666; margin-top: 5px;">
        Tiempo: ${holdTime}
      </div>
    `;
  }
  
  // Only show challenge buttons when game is running
  const isGameRunning = true; // This should come from game state
  const canTakePoint = isGameRunning;
  
  // Show code challenge input and submit button if code challenge is active
  let codeChallengeSection = '';
  if (canTakePoint && controlPoint.hasCodeChallenge) {
    codeChallengeSection = `
      <div class="code-challenge-section" style="margin-top: 10px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código:</label>
        <input type="text" id="codeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código">
        <button class="submit-code-button" onclick="window.submitCodeChallenge(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Enviar Código</button>
      </div>
    `;
  }
  
  // Show bomb challenge inputs and submit button if bomb challenge is active
  let bombChallengeSection = '';
  if (canTakePoint && controlPoint.hasBombChallenge) {
    // Check if bomb is already active
    let isBombActive = false;
    
    // This would need to check active bomb timers from state
    if (controlPoint.bombTimer && controlPoint.bombTimer.isActive) {
      isBombActive = true;
    }
    
    if (isBombActive) {
      // Bomb is active - show disarmed code input and deactivation button
      bombChallengeSection = `
        <div class="bomb-challenge-section" style="margin-top: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Desactivación:</label>
          <input type="text" id="disarmedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código de desactivación">
          <button class="submit-bomb-button" onclick="window.submitBombDeactivation(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Desactivar Bomba</button>
        </div>
      `;
    } else {
      // Bomb is not active - show armed code input and activation button
      bombChallengeSection = `
        <div class="bomb-challenge-section" style="margin-top: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Armado:</label>
          <input type="text" id="armedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código armado">
          <button class="submit-bomb-button" onclick="window.submitBombChallenge(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #FF5722; color: white; border: none; border-radius: 4px; cursor: pointer;">Activar Bomba</button>
        </div>
      `;
    }
  }
  
  popup.innerHTML = `
    <div class="point-name" style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">${controlPoint.name}</div>
    ${ownershipStatus}
    ${codeChallengeSection}
    ${bombChallengeSection}
  `;
  
  return popup;
};

// Create pie chart SVG for position challenge scores
const createPieChartSVG = (teamPoints: Record<string, number>): string => {
  const teamColors: Record<string, string> = {
    'blue': '#2196F3',
    'red': '#F44336',
    'green': '#4CAF50',
    'yellow': '#FFEB3B'
  };

  const totalPoints = Object.values(teamPoints).reduce((sum, points) => sum + points, 0);
  
  if (totalPoints === 0) {
    // Return empty SVG if no points
    return `
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="15" fill="rgba(128, 128, 128, 0.3)" stroke="#666" stroke-width="1"/>
      </svg>
    `;
  }

  let currentAngle = 0;
  const segments: string[] = [];
  
  // Create pie chart segments
  Object.entries(teamPoints).forEach(([team, points]) => {
    if (points > 0) {
      const percentage = points / totalPoints;
      const angle = percentage * 360;
      const endAngle = currentAngle + angle;
      
      // Convert angles to radians
      const startRad = (currentAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      
      // Calculate start and end points
      const startX = 20 + 15 * Math.cos(startRad);
      const startY = 20 + 15 * Math.sin(startRad);
      const endX = 20 + 15 * Math.cos(endRad);
      const endY = 20 + 15 * Math.sin(endRad);
      
      // Determine if the arc is large (more than 180 degrees)
      const largeArcFlag = angle > 180 ? 1 : 0;
      
      // Create path for the segment
      const path = `
        <path
          d="M 20 20 L ${startX} ${startY} A 15 15 0 ${largeArcFlag} 1 ${endX} ${endY} Z"
          fill="${teamColors[team] || '#9E9E9E'}"
          stroke="#fff"
          stroke-width="1"
        />
      `;
      
      segments.push(path);
      currentAngle = endAngle;
    }
  });

  return `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      ${segments.join('')}
      <circle cx="20" cy="20" r="15" fill="transparent" stroke="#fff" stroke-width="1"/>
    </svg>
  `;
};

// Create position challenge pie chart
const createPositionChallengePieChart = (marker: L.Marker, controlPoint: ControlPoint, positionCircle: L.Circle) => {
  const map = (marker as any)._map;
  if (!map) return;

  // Get circle bounds and center
  const bounds = positionCircle.getBounds();
  const centerLatLng = positionCircle.getLatLng();
  const radiusPixels = map.latLngToLayerPoint(bounds.getNorthEast()).distanceTo(map.latLngToLayerPoint(centerLatLng));
  
  // Set SVG dimensions to match circle
  const svgWidth = radiusPixels * 2;
  const svgHeight = radiusPixels * 2;

  // Create SVG element as Leaflet overlay
  const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  
  svgElement.setAttribute('width', svgWidth.toString());
  svgElement.setAttribute('height', svgHeight.toString());
  svgElement.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svgElement.style.pointerEvents = 'none';
  svgElement.style.zIndex = '1000';

  // Create Leaflet SVG overlay that moves with the map
  const svgOverlay = L.svgOverlay(svgElement, bounds, {
    opacity: 0.5,
    interactive: false
  }).addTo(map);
  
  // Force the overlay to be on top of other layers
  svgOverlay.bringToFront();

  // Store SVG overlay reference for later updates
  (marker as any).pieSvg = svgOverlay;
  (marker as any).pieElement = svgElement;
  (marker as any).pieData = {
    controlPointId: controlPoint.id,
    teamPoints: {},
    bounds,
    svgWidth,
    svgHeight,
    radiusPixels
  };
};

// Global functions for player interactions
(window as any).submitCodeChallenge = (controlPointId: number) => {
  const codeInput = document.getElementById(`codeInput_${controlPointId}`) as HTMLInputElement;
  const code = codeInput?.value;
  
  if (!code || code.trim() === '') {
    // Use toast instead of alert
    if ((window as any).showToast) {
      (window as any).showToast('Por favor ingresa un código', 'warning');
    } else {
      console.warn('Por favor ingresa un código');
    }
    return;
  }

  // Get socket from global context or find another way to access it
  const socket = (window as any).currentSocket;
  const game = (window as any).currentGame;
  const currentUser = (window as any).currentUser;
  
  if (socket && game && currentUser) {
    socket.emit('gameAction', {
      gameId: game.id,
      action: 'takeControlPoint',
      data: {
        controlPointId: controlPointId,
        code: code.trim(),
        userId: currentUser.id
      }
    });
    
    // Clear input after submission
    if (codeInput) {
      codeInput.value = '';
    }
  } else {
    console.error('WebSocket connection not available');
    // Use toast instead of alert
    if ((window as any).showToast) {
      (window as any).showToast('Error: No hay conexión con el servidor', 'error');
    } else {
      console.error('Error: No hay conexión con el servidor');
    }
  }
};

(window as any).submitBombChallenge = (controlPointId: number) => {
  const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`) as HTMLInputElement;
  const armedCode = armedCodeInput?.value;
  
  if (!armedCode || armedCode.trim() === '') {
    // Use toast instead of alert
    if ((window as any).showToast) {
      (window as any).showToast('Por favor ingresa el código para armar la bomba', 'warning');
    } else {
      console.warn('Por favor ingresa el código para armar la bomba');
    }
    return;
  }

  // Get socket from global context or find another way to access it
  const socket = (window as any).currentSocket;
  const game = (window as any).currentGame;
  const currentUser = (window as any).currentUser;
  
  if (socket && game && currentUser) {
    socket.emit('gameAction', {
      gameId: game.id,
      action: 'activateBomb',
      data: {
        controlPointId: controlPointId,
        armedCode: armedCode.trim(),
        userId: currentUser.id
      }
    });
    
    // Clear input after submission
    if (armedCodeInput) {
      armedCodeInput.value = '';
    }
  } else {
    console.error('WebSocket connection not available');
    // Use toast instead of alert
    if ((window as any).showToast) {
      (window as any).showToast('Error: No hay conexión con el servidor', 'error');
    } else {
      console.error('Error: No hay conexión con el servidor');
    }
  }
};

(window as any).submitBombDeactivation = (controlPointId: number) => {
  const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`) as HTMLInputElement;
  const disarmedCode = disarmedCodeInput?.value;
  
  if (!disarmedCode || disarmedCode.trim() === '') {
    // Use toast instead of alert
    if ((window as any).showToast) {
      (window as any).showToast('Por favor ingresa el código para desarmar la bomba', 'warning');
    } else {
      console.warn('Por favor ingresa el código para desarmar la bomba');
    }
    return;
  }

  // Get socket from global context or find another way to access it
  const socket = (window as any).currentSocket;
  const game = (window as any).currentGame;
  const currentUser = (window as any).currentUser;
  
  if (socket && game && currentUser) {
    socket.emit('gameAction', {
      gameId: game.id,
      action: 'deactivateBomb',
      data: {
        controlPointId: controlPointId,
        disarmedCode: disarmedCode.trim(),
        userId: currentUser.id
      }
    });
    
    // Clear input after submission
    if (disarmedCodeInput) {
      disarmedCodeInput.value = '';
    }
  } else {
    console.error('WebSocket connection not available');
    // Use toast instead of alert
    if ((window as any).showToast) {
      (window as any).showToast('Error: No hay conexión con el servidor', 'error');
    } else {
      console.error('Error: No hay conexión con el servidor');
    }
  }
};