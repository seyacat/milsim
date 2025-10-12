
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
    // This would update the position challenge visualization
  }, []);

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

  // Handle WebSocket events for control points
  useEffect(() => {
    if (!socket) return;

    const handleControlPointCreated = (data: { controlPoint: ControlPoint }) => {
      setControlPoints(prev => [...prev, data.controlPoint]);
    };

    const handleControlPointUpdated = (data: { controlPoint: ControlPoint }) => {
      setControlPoints(prev => 
        prev.map(cp => cp.id === data.controlPoint.id ? data.controlPoint : cp)
      );
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
  }, [socket, map]);

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
    updateAllControlPointTimers
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

  // Add popup for owners
  if (isOwner) {
    const popupContent = createOwnerPopupContent(controlPoint, marker);
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