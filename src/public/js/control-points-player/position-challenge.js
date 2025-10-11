// Position challenge functionality for players

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
    return;
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

  // Get control point to determine radius
  const controlPoint = getControlPointById(controlPointId);
  
  // Remove existing pie SVG if it exists
  if (marker.pieSvg) {
    map.removeLayer(marker.pieSvg);
    marker.pieSvg = null;
    marker.pieData = null;
  }

  // Create pie chart if there are points and position challenge is active
  if (totalPoints > 0 && controlPoint && controlPoint.hasPositionChallenge && currentGame && currentGame.status === 'running') {

    // Get the position circle to use its bounds - with retry mechanism
    let positionCircle = marker.positionCircle;
    if (!positionCircle) {
      // Try to find the position circle by searching for circles at the same location
      map.eachLayer((layer) => {
        if (layer instanceof L.Circle &&
            layer.getLatLng().lat === controlPoint.latitude &&
            layer.getLatLng().lng === controlPoint.longitude) {
          positionCircle = layer;
          marker.positionCircle = layer; // Store reference for future use
        }
      });
      
      // If still not found, return and try again later
      if (!positionCircle) {
        console.log(`[POSITION_CHALLENGE_PIE] Position circle not found for control point ${controlPointId}, will retry`);
        // Retry after a short delay
        setTimeout(() => {
          updatePositionChallengeBars(controlPointId, teamPoints);
        }, 500);
        return;
      }
    }


    // Create SVG element as Leaflet overlay
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    // Get circle bounds and center
    const bounds = positionCircle.getBounds();
    const centerLatLng = positionCircle.getLatLng();
    const radiusPixels = map.latLngToLayerPoint(bounds.getNorthEast()).distanceTo(map.latLngToLayerPoint(centerLatLng));
    
    // Set SVG dimensions to match circle
    const svgWidth = radiusPixels * 2;
    const svgHeight = radiusPixels * 2;
    
    svgElement.setAttribute('width', svgWidth);
    svgElement.setAttribute('height', svgHeight);
    svgElement.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svgElement.style.pointerEvents = 'none';
    svgElement.style.zIndex = '1000';


    // Create Leaflet SVG overlay that moves with the map
    const svgOverlay = L.svgOverlay(svgElement, bounds, {
      opacity: 0.8,
      interactive: false
    }).addTo(map);
    
    // Force the overlay to be on top of other layers
    svgOverlay.bringToFront();


    let startAngle = 0;

    // Create pie slices for each team with points
    Object.entries(teamPoints).forEach(([team, points]) => {
      if (points > 0) {
        const percentage = points / totalPoints;
        const sliceAngle = percentage * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;


        // Calculate arc coordinates relative to SVG center
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
        path.setAttribute('stroke', 'none'); // Remove white borders
        path.setAttribute('stroke-width', '0');
        
        svgElement.appendChild(path);

        startAngle = endAngle;
      }
    });

    // Store SVG overlay reference for cleanup
    marker.pieSvg = svgOverlay;
    marker.pieData = {
      controlPointId,
      teamPoints,
      bounds
    };

    
    // Force immediate rendering by directly manipulating DOM
    setTimeout(() => {
      // Find the actual SVG element in the DOM and ensure it's visible
      const svgElements = document.querySelectorAll('svg');
      
      svgElements.forEach((svg, index) => {
        // Check if this is our SVG by looking for the specific viewBox
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox === `0 0 ${svgWidth} ${svgHeight}`) {
          svg.style.display = 'block';
          svg.style.visibility = 'visible';
          svg.style.opacity = '0.8';
          svg.style.pointerEvents = 'none';
          svg.style.zIndex = '1000';
        }
      });
      
      // Force map refresh
      map.invalidateSize();
      
      // Force redraw of the SVG overlay
      if (marker.pieSvg) {
        map.removeLayer(marker.pieSvg);
        map.addLayer(marker.pieSvg);
      }
    }, 100);
    
    // Additional attempt after longer delay
    setTimeout(() => {
      map.invalidateSize();
    }, 500);
  } else {
    console.log(`[POSITION_CHALLENGE_PIE] No pie chart created - conditions: totalPoints=${totalPoints}, hasPositionChallenge=${controlPoint?.hasPositionChallenge}, gameRunning=${currentGame?.status === 'running'}`);
  }
}

// Handle position challenge update from server
function handlePositionChallengeUpdate(data) {
    const { controlPointId, teamPoints } = data;
    updatePositionChallengeBars(controlPointId, teamPoints);
}

// Update all position challenge bars when game starts
function updateAllPositionChallengeBars() {
    if (!currentGame || !currentGame.controlPoints) return;
    
    currentGame.controlPoints.forEach(controlPoint => {
        if (controlPoint.hasPositionChallenge) {
            // Initialize with empty team points - will be updated by server events
            updatePositionChallengeBars(controlPoint.id, {});
        }
    });
}

// Export functions
window.updatePositionChallengeBars = updatePositionChallengeBars;
window.handlePositionChallengeUpdate = handlePositionChallengeUpdate;
window.updateAllPositionChallengeBars = updateAllPositionChallengeBars;