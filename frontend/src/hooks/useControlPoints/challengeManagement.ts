import { ControlPoint } from '../../types';
import * as L from 'leaflet';

// Create pie chart SVG for position challenge scores
export const createPieChartSVG = (teamPoints: Record<string, number>): string => {
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
export const createPositionChallengePieChart = (marker: L.Marker, controlPoint: ControlPoint, positionCircle: L.Circle) => {
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