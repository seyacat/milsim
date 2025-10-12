// Control point operations for owners
import { hasSiteControlPoint } from './markers-popups.js';
import { updateSingleOwnerMarker } from './markers-popups.js';
import { createControlPointEditMenu } from './edit-menu.js';
import { closeControlPointMenu } from './menu-management.js';
import { getMap, getCurrentGame, getSocket, showError, showWarning, showSuccess } from '../game-core/index.js';

// Create control point
export async function createControlPoint(lat, lng) {
    const socket = getSocket();
    const currentGame = getCurrentGame();
    
    // Generate a default name based on coordinates
    const name = `Punto ${Math.round(lat * 10000)}-${Math.round(lng * 10000)}`;
    
    // Send create control point via WebSocket
    // The backend will automatically determine if this should be a Site
    // based on whether there are already any Sites in the game
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'createControlPoint',
            data: {
                name,
                description: '',
                latitude: lat,
                longitude: lng,
                gameId: currentGame.id
                // Type is not specified - backend will determine automatically
            }
        });
        
        // The marker will be added when we receive the 'controlPointCreated' event
        closeControlPointMenu();
    }
}

// Update control point
export function updateControlPoint(controlPointId) {
    const type = document.getElementById(`controlPointType_${controlPointId}`).value;
    const name = document.getElementById(`controlPointEditName_${controlPointId}`).value.trim();
    const positionChallenge = document.getElementById(`positionChallenge_${controlPointId}`).checked;
    const codeChallenge = document.getElementById(`codeChallenge_${controlPointId}`).checked;
    const bombChallenge = document.getElementById(`bombChallenge_${controlPointId}`).checked;
    
    
    if (!name) {
        showWarning('Por favor ingresa un nombre para el punto');
        return;
    }
    
    // Validate that we're not trying to create a second Site
    if (type === 'site') {
        const hasOtherSite = hasSiteControlPoint();
        if (hasOtherSite) {
            const map = getMap();
            // Find the current marker to check if it's already a Site
            let currentIsSite = false;
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId && layer.controlPointData.type === 'site') {
                    currentIsSite = true;
                }
            });
            
            // If this point is not already a Site and there's already a Site, prevent the change
            if (!currentIsSite) {
                showError('Solo puede haber un punto de tipo Site por juego');
                return;
            }
        }
    }
    
    // Prepare update data - always send all fields
    const updateData = {
        controlPointId,
        name,
        type,
        hasPositionChallenge: positionChallenge,
        hasCodeChallenge: codeChallenge,
        hasBombChallenge: bombChallenge
    };
    
    // Always get position challenge values, regardless of checkbox state
    const minDistanceSelect = document.getElementById(`controlPointMinDistance_${controlPointId}`);
    const minAccuracySelect = document.getElementById(`controlPointMinAccuracy_${controlPointId}`);
    
    const minDistance = minDistanceSelect ? minDistanceSelect.value : '';
    const minAccuracy = minAccuracySelect ? minAccuracySelect.value : '';
    
    
    // Only validate if position challenge is checked
    if (positionChallenge) {
        if (!minDistance || !minAccuracy) {
            showWarning('Para position challenge, debes seleccionar tanto la distancia mínima como el accuracy mínimo');
            return;
        }
    }
    
    // Always send position values (they will be null if not selected)
    updateData.minDistance = minDistance ? parseInt(minDistance) : null;
    updateData.minAccuracy = minAccuracy ? parseInt(minAccuracy) : null;
    
    // Always get code challenge values, regardless of checkbox state
    const code = document.getElementById(`controlPointCode_${controlPointId}`).value.trim();
    
    // Only validate if code challenge is checked
    if (codeChallenge) {
        if (!code) {
            showWarning('Para code challenge, debes ingresar un código');
            return;
        }
    }
    
    // Always send code value (it will be null if empty)
    updateData.code = code || null;
    
    // Always get bomb challenge values, regardless of checkbox state
    const bombTimeSelect = document.getElementById(`controlPointBombTime_${controlPointId}`);
    const armedCode = document.getElementById(`controlPointArmedCode_${controlPointId}`).value.trim();
    const disarmedCode = document.getElementById(`controlPointDisarmedCode_${controlPointId}`).value.trim();
    
    const bombTime = bombTimeSelect ? bombTimeSelect.value : '';
    
    
    // Only validate if bomb challenge is checked
    if (bombChallenge) {
        if (!armedCode || !disarmedCode) {
            showWarning('Para bomb challenge, debes ingresar tanto el código para armar como el código para desarmar');
            return;
        }
    }
    
    // Always send bomb values (they will be null if not selected)
    updateData.bombTime = bombTime ? parseInt(bombTime) : null;
    updateData.armedCode = armedCode || null;
    updateData.disarmedCode = disarmedCode || null;
    
    // Send update via WebSocket
    const socket = getSocket();
    const currentGame = getCurrentGame();
    
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'updateControlPoint',
            data: updateData
        });
        
        // The marker will be updated when we receive the 'controlPointUpdated' event
        showSuccess('Punto actualizado exitosamente');
    }
}

// Delete control point
export function deleteControlPoint(controlPointId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este punto?')) {
        return;
    }
    
    // Send delete via WebSocket
    const socket = getSocket();
    const currentGame = getCurrentGame();
    
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'deleteControlPoint',
            data: {
                controlPointId
            }
        });
        
        // The marker will be removed when we receive the 'controlPointDeleted' event
        showSuccess('Punto eliminado exitosamente');
    }
}

// Enable drag mode for moving control points
export function enableDragMode(controlPointId) {
    
    const map = getMap();
    
    // Find the marker by control point ID instead of marker ID
    let targetMarker = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
            targetMarker = layer;
        }
    });
    
    if (!targetMarker) {
        console.error(`Marker not found for control point ${controlPointId}`);
        return;
    }
    
    // Close the popup menu with multiple approaches to ensure it closes
    if (targetMarker.isPopupOpen()) {
        targetMarker.closePopup();
    }
    
    // Also try closing via map to ensure any open popup is closed
    map.closePopup();
    
    // Make marker draggable
    targetMarker.dragging.enable();
    
    // Change cursor to indicate drag mode
    targetMarker.getElement().style.cursor = 'move';
    
    // Add dragend event listener to update position when dragging stops
    targetMarker.on('dragend', function(event) {
        const marker = event.target;
        const newPosition = marker.getLatLng();
        
        const socket = getSocket();
        const currentGame = getCurrentGame();
        
        // Update control point position via WebSocket
        if (socket && currentGame) {
            socket.emit('gameAction', {
                gameId: currentGame.id,
                action: 'updateControlPointPosition',
                data: {
                    controlPointId: controlPointId,
                    latitude: newPosition.lat,
                    longitude: newPosition.lng
                }
            });
        }
        
        // Disable dragging after placement
        marker.dragging.disable();
        marker.getElement().style.cursor = '';
    });
    
    // Show instruction message
    showSuccess('Arrastra el punto a la nueva ubicación y haz clic para colocarlo');
}

// Assign team to control point
export function assignControlPointTeam(controlPointId, team) {
    
    const socket = getSocket();
    const currentGame = getCurrentGame();
    
    if (socket && currentGame) {
        // Send team assignment via WebSocket
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'assignControlPointTeam',
            data: {
                controlPointId: controlPointId,
                team: team
            }
        });
        
        showSuccess(`Equipo asignado: ${team}`);
    }
}

// Handle control point team assigned event
export function handleControlPointTeamAssigned(data) {
    
    const map = getMap();
    
    // Find the marker and update its data
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === data.controlPointId) {
            // Update the control point data
            layer.controlPointData.ownedByTeam = data.team === 'none' ? null : data.team;
            
            // Update the popup content
            const popupContent = createControlPointEditMenu(layer.controlPointData, layer);
            layer.bindPopup(popupContent, {
                closeOnClick: false,
                autoClose: false,
                closeButton: true
            });
            
            // If popup is open, update it
            if (layer.isPopupOpen()) {
                layer.closePopup();
                layer.openPopup();
            }
            
            // Update the marker icon to reflect the new team color
            // Only refresh the specific marker instead of all markers to preserve owner functionality
            updateSingleOwnerMarker(layer.controlPointData);
        }
    });
}

// Request fresh control point data from server
export function requestControlPointData(controlPointId, marker) {
    const socket = getSocket();
    const currentGame = getCurrentGame();
    
    if (socket && currentGame) {
        
        // Request specific control point data with the new handler
        socket.emit('getControlPointData', {
            gameId: currentGame.id,
            controlPointId: controlPointId
        });
        
        // Also request specific control point times for accurate timer data
        socket.emit('getControlPointTimes', { gameId: currentGame.id });
        
        // Request active bomb timers if applicable
        if (window.requestActiveBombTimers) {
            window.requestActiveBombTimers();
        }
    }
}

// Update control point popup with fresh data
export function updateControlPointPopupWithFreshData(controlPointId, marker) {
    const currentGame = getCurrentGame();
    
    if (!currentGame || !currentGame.controlPoints) return;
    
    // Find the latest control point data from currentGame
    const freshControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
    if (!freshControlPoint) return;
    
    // Update the marker's control point data
    marker.controlPointData = freshControlPoint;
    
    // Create updated popup content
    const popupContent = createControlPointEditMenu(freshControlPoint, marker);
    
    // Update the popup
    marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });
    
    // If popup is open, update it immediately
    if (marker.isPopupOpen()) {
        marker.closePopup();
        marker.openPopup();
    }
}

// Get control point by ID (helper function)
export function getControlPointById(controlPointId) {
    const map = getMap();
    const currentGame = getCurrentGame();
    
    let controlPoint = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
            controlPoint = layer.controlPointData;
        }
    });
    
    // If not found in map layers, try to get from currentGame
    if (!controlPoint && currentGame && currentGame.controlPoints) {
        const latestControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
        if (latestControlPoint) {
            controlPoint = latestControlPoint;
        }
    }
    
    return controlPoint;
}

// Export functions to global scope for backward compatibility
export function setupGlobalFunctions() {
    window.updateControlPoint = updateControlPoint;
    window.deleteControlPoint = deleteControlPoint;
    window.enableDragMode = enableDragMode;
    window.assignControlPointTeam = assignControlPointTeam;
    window.handleControlPointTeamAssigned = handleControlPointTeamAssigned;
    window.requestControlPointData = requestControlPointData;
    window.updateControlPointPopupWithFreshData = updateControlPointPopupWithFreshData;
    window.getControlPointById = getControlPointById;
}