// Position challenge functionality for owners

// Update position challenge pie chart with team data
function updatePositionChallengeBars(controlPointId, teamPoints) {
  
  // Find the marker
  let marker = null;
  
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
      marker = layer;
    }
  });

  if (!marker) {
    console.log(`[POSITION_CHALLENGE_PIE] Marker not found for control point ${controlPointId}`);
    return;
  }

  // Check if pie chart exists, if not create it
  if (!marker.pieElement || !marker.pieSvg) {
    console.log(`[POSITION_CHALLENGE_PIE] Pie chart not found for control point ${controlPointId}, creating new one`);
    const controlPoint = getControlPointById(controlPointId);
    if (controlPoint && controlPoint.hasPositionChallenge && controlPoint.minDistance && marker.positionCircle) {
      createOwnerPositionChallengePieChart(marker, controlPoint, marker.positionCircle);
    } else {
      console.log(`[POSITION_CHALLENGE_PIE] Cannot create pie chart - missing required data for control point ${controlPointId}`);
      return;
    }
  }

  // Calculate total points to determine percentages
  const totalPoints = Object.values(teamPoints).reduce((sum, points) => sum + points, 0);

  // Team colors
  const teamColors = {
    'blue': '#2196F3',
    'red': '#F44336',
    'green': '#4CAF50',
    'yellow': '#FFEB3B'
  };

  // Get control point to verify position challenge is active
  const controlPoint = getControlPointById(controlPointId);
  
  // Only update if we have points and position challenge is active
  if (totalPoints > 0 && controlPoint && controlPoint.hasPositionChallenge && currentGame && currentGame.status === 'running') {
    
    // Check if pie chart exists
    if (!marker.pieElement) {
      console.log(`[POSITION_CHALLENGE_PIE] Pie chart not found for control point ${controlPointId}`);
      return;
    }

    // Clear existing pie slices
    marker.pieElement.innerHTML = '';

    let startAngle = 0;

    // Create pie slices for each team with points
    Object.entries(teamPoints).forEach(([team, points]) => {
      if (points > 0) {
        const percentage = points / totalPoints;
        const sliceAngle = percentage * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        // Get stored dimensions
        const { svgWidth, svgHeight, radiusPixels } = marker.pieData;
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
        
        marker.pieElement.appendChild(path);

        startAngle = endAngle;
      }
    });

    // Update stored team points
    marker.pieData.teamPoints = teamPoints;

    // Force map refresh
    setTimeout(() => {
      map.invalidateSize();
    }, 50);
  } else {
    // If no points, clear the pie chart but keep the SVG overlay
    if (marker.pieElement) {
      marker.pieElement.innerHTML = '';
      marker.pieData.teamPoints = {};
    }
  }
}

// Handle position challenge update from server
function handlePositionChallengeUpdate(data) {
    const { controlPointId, teamPoints } = data;
    updatePositionChallengeBars(controlPointId, teamPoints);
}

// Create position challenge pie chart for owner (empty initially)
function createOwnerPositionChallengePieChart(marker, controlPoint, positionCircle) {
    // Get circle bounds and center
    const bounds = positionCircle.getBounds();
    const centerLatLng = positionCircle.getLatLng();
    const radiusPixels = map.latLngToLayerPoint(bounds.getNorthEast()).distanceTo(map.latLngToLayerPoint(centerLatLng));
    
    // Set SVG dimensions to match circle
    const svgWidth = radiusPixels * 2;
    const svgHeight = radiusPixels * 2;

    // Create SVG element as Leaflet overlay
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    svgElement.setAttribute('width', svgWidth);
    svgElement.setAttribute('height', svgHeight);
    svgElement.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svgElement.style.pointerEvents = 'none';
    svgElement.style.zIndex = '1000';

    // Create Leaflet SVG overlay that moves with the map
    const svgOverlay = L.svgOverlay(svgElement, bounds, {
        opacity: 0.5, // Same opacity as player
        interactive: false
    }).addTo(map);
    
    // Force the overlay to be on top of other layers
    svgOverlay.bringToFront();

    // Store SVG overlay reference for later updates
    marker.pieSvg = svgOverlay;
    marker.pieElement = svgElement;
    marker.pieData = {
        controlPointId: controlPoint.id,
        teamPoints: {},
        bounds,
        svgWidth,
        svgHeight,
        radiusPixels
    };
}

// Update all position challenge bars when game starts
function updateAllPositionChallengeBars() {
    // Don't create empty pie charts - wait for actual team points data from server
    // The pie charts are already created in addControlPointMarkerOwner()
}

// Make functions available globally
window.updatePositionChallengeBars = updatePositionChallengeBars;
window.handlePositionChallengeUpdate = handlePositionChallengeUpdate;
window.updateAllPositionChallengeBars = updateAllPositionChallengeBars;
window.createOwnerPositionChallengePieChart = createOwnerPositionChallengePieChart;