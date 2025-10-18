import { ControlPoint } from '../../types';
import * as L from 'leaflet';
import { getControlPointIcon } from './utils';
import { createPopupContent } from '../../components/ControlPoints/PopupComponents';

// Create control point marker
export const createControlPointMarker = (controlPoint: ControlPoint, map: L.Map, isOwner: boolean, isDragModeEnabled: boolean = false): L.Marker | null => {
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
    icon: controlPointIcon,
    draggable: isDragModeEnabled
  }).addTo(map);
  
  console.log(`Marker created for control point ${controlPoint.id}, draggable: ${isDragModeEnabled}`);

  // Add dragend event listener to update position when dragging stops
  marker.on('dragend', function(event) {
    console.log('Dragend event triggered for control point', controlPoint.id);
    const marker = event.target;
    const newPosition = marker.getLatLng();
    
    // Update control point position via WebSocket
    // This will be handled by the global functions
    if ((window as any).updateControlPointPosition) {
      (window as any).updateControlPointPosition(controlPoint.id, newPosition.lat, newPosition.lng);
    }
  });

  // Store control point data on marker
  (marker as any).controlPointData = controlPoint;

  // Add popup for owners or players
  const popupContent = createPopupContent(controlPoint, (marker as any)._leaflet_id, isOwner, {
    onUpdate: (controlPointId: number, markerId: number) => {
      // This will be handled by the global functions
      if ((window as any).updateControlPoint) {
        (window as any).updateControlPoint(controlPointId, markerId);
      }
    },
    onDelete: (controlPointId: number, markerId: number) => {
      if ((window as any).deleteControlPoint) {
        (window as any).deleteControlPoint(controlPointId, markerId);
      }
    },
    onMove: (controlPointId: number, markerId: number) => {
      if ((window as any).enableDragMode) {
        (window as any).enableDragMode(controlPointId, markerId);
      }
    },
    onAssignTeam: (controlPointId: number, team: string) => {
      if ((window as any).assignControlPointTeam) {
        (window as any).assignControlPointTeam(controlPointId, team);
      }
    },
    onTogglePositionChallenge: (controlPointId: number) => {
      if ((window as any).togglePositionInputs) {
        (window as any).togglePositionInputs(controlPointId);
      }
    },
    onToggleCodeChallenge: (controlPointId: number) => {
      if ((window as any).toggleCodeInputs) {
        (window as any).toggleCodeInputs(controlPointId);
      }
    },
    onToggleBombChallenge: (controlPointId: number) => {
      if ((window as any).toggleBombInputs) {
        (window as any).toggleBombInputs(controlPointId);
      }
    },
    onActivateBomb: (controlPointId: number) => {
      if ((window as any).activateBombAsOwner) {
        (window as any).activateBombAsOwner(controlPointId);
      }
    },
    onDeactivateBomb: (controlPointId: number) => {
      if ((window as any).deactivateBombAsOwner) {
        (window as any).deactivateBombAsOwner(controlPointId);
      }
    },
    onSubmitCode: (controlPointId: number, code: string) => {
      if ((window as any).submitCodeChallenge) {
        (window as any).submitCodeChallenge(controlPointId, code);
      }
    },
    onSubmitBombChallenge: (controlPointId: number, armedCode: string) => {
      if ((window as any).submitBombChallenge) {
        (window as any).submitBombChallenge(controlPointId, armedCode);
      }
    },
    onSubmitBombDeactivation: (controlPointId: number, disarmedCode: string) => {
      if ((window as any).submitBombDeactivation) {
        (window as any).submitBombDeactivation(controlPointId, disarmedCode);
      }
    },
    onClose: () => {
      if ((window as any).disableDragMode) {
        (window as any).disableDragMode();
      }
    }
  });
  
  marker.bindPopup(popupContent, {
    closeOnClick: false,
    autoClose: false,
    closeButton: true
  });

  return marker;
};

// Create position circle for position challenge
export const createPositionCircle = (controlPoint: ControlPoint, map: L.Map): L.Circle | null => {
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