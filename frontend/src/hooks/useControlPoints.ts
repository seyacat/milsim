
import { useState, useCallback, useEffect, useRef } from 'react';
import { ControlPoint, Game } from '../types';
import * as L from 'leaflet';
import { createControlPointMarker, createPositionCircle } from './useControlPoints/markerManagement';
import { togglePositionInputs, toggleCodeInputs, toggleBombInputs } from './useControlPoints/utils';
import { createPositionChallengePieChart, cleanControlPointPieCharts } from './useControlPoints/challengeManagement';
import { setupGlobalPlayerFunctions } from './useControlPoints/websocketHandlers';

interface UseControlPointsProps {
  game: Game | null;
  map: L.Map | null;
  isOwner: boolean;
  socket: any;
  showToast?: (message: string, type: string) => void;
}

export const useControlPoints = ({ game, map, isOwner, socket, showToast }: UseControlPointsProps) => {
  
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [isDragModeEnabled, setIsDragModeEnabled] = useState(false);
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

    // Set drag mode flag to true
    setIsDragModeEnabled(true);

    // Find the marker
    const targetMarker = controlPointMarkers.current.get(controlPointId);
    if (!targetMarker) {
      console.error(`Marker not found for control point ${controlPointId}`);
      return;
    }

    // Remove PIE chart if it exists
    const markerWithPie = targetMarker as any;
    if (markerWithPie.pieSvg) {
      map.removeLayer(markerWithPie.pieSvg);
      markerWithPie.pieSvg = null;
      markerWithPie.pieElement = null;
      markerWithPie.pieData = null;
    }

    // Close the popup menu
    targetMarker.closePopup();

    // Show instruction message
    if (showToast) {
      showToast('Arrastra el punto a la nueva ubicación y haz clic para colocarlo', 'success');
    }
  }, [map, showToast]);

  // Handle position challenge updates
  const updatePositionChallengeBars = useCallback((controlPointId: number, teamPoints: Record<string, number>) => {
    if (!map) return;

    // Log position challenge update
    
    // Find the control point marker
    const marker = controlPointMarkers.current.get(controlPointId);
    if (!marker) return;

    // Only update existing pie chart, do not create new ones
    if (!(marker as any).pieElement || !(marker as any).pieSvg) {
      return;
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

    // Add position challenge values - always read from DOM even if inputs are hidden
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

    // Add code challenge values - always read from DOM even if inputs are hidden
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

    // Add bomb challenge values - always read from DOM even if inputs are hidden
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

  // Update single control point marker (for team color changes)
  const updateSingleControlPointMarker = useCallback((controlPoint: any) => {
    if (!map) return;

    // Handle nested control point structure - use any type to handle flexible structure
    const actualControlPoint = controlPoint.controlPoint || controlPoint;
    
    // Validate coordinates before proceeding - check both direct and nested properties
    const latitude = parseFloat(actualControlPoint.latitude);
    const longitude = parseFloat(actualControlPoint.longitude);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      console.error(`[UPDATE_SINGLE_CONTROL_POINT_MARKER] Control point ${actualControlPoint.id} has invalid coordinates:`, {
        originalLatitude: actualControlPoint.latitude,
        originalLongitude: actualControlPoint.longitude,
        parsedLatitude: latitude,
        parsedLongitude: longitude,
        controlPoint: actualControlPoint
      });
      return;
    }

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
    const newMarker = createControlPointMarker(controlPoint, map, isOwner, isDragModeEnabled, game || undefined);
    if (newMarker) {
      controlPointMarkers.current.set(controlPoint.id, newMarker);
    }

    // Add position circle and PIE chart if position challenge is active
    if (controlPoint.hasPositionChallenge && controlPoint.minDistance) {
      const circle = createPositionCircle(controlPoint, map);
      if (circle) {
        positionCircles.current.set(controlPoint.id, circle);
        
        // Always create PIE chart if position challenge is active
        if (newMarker) {
          createPositionChallengePieChart(newMarker, controlPoint, circle);
        }
      }
    }
  }, [map, isOwner]);

  // Function to update control point position after drag
  const updateControlPointPosition = useCallback((controlPointId: number, latitude: number, longitude: number) => {
    
    // Update control point position locally first
    setControlPoints(prev =>
      prev.map(cp =>
        cp.id === controlPointId
          ? { ...cp, latitude, longitude }
          : cp
      )
    );
    
    // Find the updated control point and refresh its marker with PIE chart
    const updatedControlPoint = controlPoints.find(cp => cp.id === controlPointId);
    if (updatedControlPoint) {
      const controlPointWithNewPosition = { ...updatedControlPoint, latitude, longitude };
      updateSingleControlPointMarker(controlPointWithNewPosition);
    }
    
    // Update control point position via WebSocket
    if (socket && game) {
      socket.emit('gameAction', {
        gameId: game.id,
        action: 'updateControlPointPosition',
        data: {
          controlPointId: controlPointId,
          latitude: latitude,
          longitude: longitude
        }
      });
    }
    
    // Disable drag mode after drop
    setIsDragModeEnabled(false);
  }, [socket, game, controlPoints, updateSingleControlPointMarker]);

  // Function to disable drag mode (called when popup is closed)
  const disableDragMode = useCallback(() => {
    setIsDragModeEnabled(false);
  }, []);

  // Make functions available globally for popup buttons
  useEffect(() => {
    (window as any).enableDragMode = enableDragMode;
    (window as any).disableDragMode = disableDragMode;
    (window as any).updateControlPoint = updateControlPoint;
    (window as any).updateControlPointPosition = updateControlPointPosition;
    (window as any).deleteControlPoint = deleteControlPoint;
    (window as any).activateBombAsOwner = activateBombAsOwner;
    (window as any).deactivateBombAsOwner = deactivateBombAsOwner;
    (window as any).assignControlPointTeam = assignControlPointTeam;
    (window as any).togglePositionInputs = togglePositionInputs;
    (window as any).toggleCodeInputs = toggleCodeInputs;
    (window as any).toggleBombInputs = toggleBombInputs;

    // Setup global player functions
    setupGlobalPlayerFunctions();
  }, [enableDragMode, disableDragMode, updateControlPoint, updateControlPointPosition, deleteControlPoint, activateBombAsOwner, deactivateBombAsOwner, assignControlPointTeam]);

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
    if (game?.controlPoints && !isDragModeEnabled) {
      setControlPoints(game.controlPoints);
    }
  }, [game?.controlPoints, isDragModeEnabled]);

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
      // Handle nested control point structure
      const actualControlPoint = (controlPoint as any).controlPoint || controlPoint;
      
      // Validate coordinates before creating marker
      const latitude = parseFloat(actualControlPoint.latitude);
      const longitude = parseFloat(actualControlPoint.longitude);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        console.error(`[RENDER_CONTROL_POINTS] Control point ${actualControlPoint.id} has invalid coordinates:`, {
          originalLatitude: actualControlPoint.latitude,
          originalLongitude: actualControlPoint.longitude,
          parsedLatitude: latitude,
          parsedLongitude: longitude,
          controlPoint: actualControlPoint
        });
        return;
      }

      const marker = createControlPointMarker(actualControlPoint, map, isOwner, isDragModeEnabled, game || undefined);
      if (marker) {
        controlPointMarkers.current.set(actualControlPoint.id, marker);
      }

      // Add position circle and PIE chart if position challenge is active
      if (actualControlPoint.hasPositionChallenge && actualControlPoint.minDistance) {
        const circle = createPositionCircle(actualControlPoint, map);
        if (circle) {
          positionCircles.current.set(actualControlPoint.id, circle);
          
          // Create PIE chart for position challenge
          if (marker) {
            createPositionChallengePieChart(marker, actualControlPoint, circle);
          }
        }
      }
    });
  }, [map, controlPoints, isOwner]);

  // Update control points when they change - only recreate all markers when controlPoints array length changes
  useEffect(() => {
    // Don't update if drag mode is enabled to avoid interrupting drag
    if (isDragModeEnabled) {
      return;
    }
    
    // Only recreate all markers when the controlPoints array length changes (new control points added/removed)
    // Individual control point updates should be handled by updateSingleControlPointMarker
    renderControlPoints();
    updateAllControlPointTimers();
  }, [controlPoints.length, renderControlPoints, updateAllControlPointTimers, isDragModeEnabled]);

  // Update draggable state of existing markers without recreating them
  useEffect(() => {
    if (!map) return;
    
    
    controlPointMarkers.current.forEach((marker, controlPointId) => {
      if (marker.dragging) {
        if (isDragModeEnabled) {
          marker.dragging.enable();
        } else {
          marker.dragging.disable();
        }
      }
    });
  }, [map, isDragModeEnabled]);


  // Handle WebSocket events for control points
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleControlPointCreated = (data: { controlPoint: ControlPoint }) => {
      setControlPoints(prev => [...prev, data.controlPoint]);
    };

    const handleControlPointUpdated = (data: { controlPoint: ControlPoint }) => {
      // Don't update if drag mode is enabled to avoid interrupting drag
      if (isDragModeEnabled) {
        return;
      }
      
      // Update the control point in state without triggering full re-render
      setControlPoints(prev =>
        prev.map(cp => cp.id === data.controlPoint.id ? data.controlPoint : cp)
      );
      
      // Force update ONLY the marker for this specific control point
      updateSingleControlPointMarker(data.controlPoint);
    };

    const handleControlPointDeleted = (data: { controlPointId: number }) => {
      // Don't update if drag mode is enabled to avoid interrupting drag
      if (isDragModeEnabled) {
        return;
      }
      
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

    // Handle gameAction events for control point updates
    const handleGameAction = (data: { action: string; data: any }) => {
      if (data.action === 'controlPointTaken' || data.action === 'controlPointTeamAssigned') {
        // Update control point when taken by a team
        const controlPoint = data.data.controlPoint;
        if (controlPoint) {
          // Ensure control point has proper coordinates structure
          const normalizedControlPoint = {
            ...controlPoint,
            latitude: controlPoint.latitude || (controlPoint.controlPoint?.latitude),
            longitude: controlPoint.longitude || (controlPoint.controlPoint?.longitude)
          };
          
          // Update ONLY this specific control point without triggering full re-render
          setControlPoints(prev =>
            prev.map(cp => cp.id === normalizedControlPoint.id ? normalizedControlPoint : cp)
          );
          
          // Update ONLY the marker for this specific control point
          updateSingleControlPointMarker(normalizedControlPoint);
          
          // Show toast notification for control point taken
          if (showToast) {
            const teamName = data.data.team || normalizedControlPoint.ownedByTeam;
            const actionType = data.action === 'controlPointTaken' ? 'tomado' : 'asignado';
            const byPlayer = data.data.userName ? ` por ${data.data.userName}` : '';
            showToast(`Punto ${normalizedControlPoint.name} ${actionType} por equipo ${teamName}${byPlayer}`, 'success');
          }
        }
      } else if (data.action === 'controlPointUpdated') {
        // Handle direct control point updates
        const controlPoint = data.data;
        if (controlPoint) {
          // Ensure control point has proper coordinates structure
          const normalizedControlPoint = {
            ...controlPoint,
            latitude: controlPoint.latitude || (controlPoint.controlPoint?.latitude),
            longitude: controlPoint.longitude || (controlPoint.controlPoint?.longitude)
          };
          handleControlPointUpdated({ controlPoint: normalizedControlPoint });
        }
      }
    };

    socket.on('controlPointCreated', handleControlPointCreated);
    socket.on('controlPointUpdated', handleControlPointUpdated);
    socket.on('controlPointDeleted', handleControlPointDeleted);
    socket.on('gameAction', handleGameAction);

    return () => {
      socket.off('controlPointCreated', handleControlPointCreated);
      socket.off('controlPointUpdated', handleControlPointUpdated);
      socket.off('controlPointDeleted', handleControlPointDeleted);
      socket.off('gameAction', handleGameAction);
    };
  }, [socket, map, updateSingleControlPointMarker, isDragModeEnabled, showToast]);


  return {
    controlPoints,
    controlPointMarkers: controlPointMarkers.current,
    positionCircles: positionCircles.current,
    pieCharts: pieCharts.current,
    enableDragMode,
    disableDragMode,
    updatePositionChallengeBars,
    handleBombTimeUpdate,
    activateBombAsOwner,
    deactivateBombAsOwner,
    assignControlPointTeam,
    updateAllControlPointTimers,
    updateSingleControlPointMarker
  };
};