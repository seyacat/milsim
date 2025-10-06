// Control points functionality for players

// Create control point interaction menu for players
function createControlPointPlayerMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.className = 'control-point-popup';
    
    const isSite = controlPoint.type === 'site';
    let pointType = 'Control Point';
    
    if (isSite) {
        pointType = 'Site';
    }
    
    // Debug: Log current game state for troubleshooting
    console.log('Creating control point menu:', {
        controlPointId: controlPoint.id,
        gameStatus: currentGame ? currentGame.status : 'no currentGame',
        isGameRunning: currentGame && currentGame.status === 'running'
    });
    
    // Show ownership status
    let ownershipStatus = '';
    if (controlPoint.ownedByTeam) {
        const teamColors = {
            'blue': 'Azul',
            'red': 'Rojo',
            'green': 'Verde',
            'yellow': 'Amarillo'
        };
        ownershipStatus = `<div class="ownership-status" style="color: ${controlPoint.ownedByTeam}; font-weight: bold;">Controlado por: ${teamColors[controlPoint.ownedByTeam] || controlPoint.ownedByTeam}</div>`;
    }
    
    // Only show "Take" button when game is running and point is not owned by player's team
    const isGameRunning = currentGame && currentGame.status === 'running';
    const playerTeam = currentUser && currentUser.team;
    const isOwnedByPlayerTeam = controlPoint.ownedByTeam === playerTeam;
    const canTakePoint = isGameRunning && !isOwnedByPlayerTeam;
    
    const takeButton = canTakePoint ? `
        <div class="action-buttons">
            <button class="take-button" onclick="takeControlPoint(${controlPoint.id})">Tomar</button>
        </div>
    ` : '';
    
    menu.innerHTML = `
        <h4>${pointType}</h4>
        <div class="point-name">${controlPoint.name}</div>
        ${ownershipStatus}
        ${takeButton}
    `;
    
    return menu;
}

// Add control point marker to map for players
function addControlPointMarkerPlayer(controlPoint) {
    console.log('Adding control point marker for player:', controlPoint);
    console.log('Current game state when adding marker:', {
        hasCurrentGame: !!currentGame,
        gameStatus: currentGame ? currentGame.status : 'undefined',
        gameId: currentGame ? currentGame.id : 'undefined'
    });
    
    // Create icon based on type, challenges, and ownership
    let iconColor = '#2196F3'; // Default for control_point
    let iconEmoji = '🚩'; // Default for control_point
    
    // Check ownership first - override color based on team
    if (controlPoint.ownedByTeam) {
        const teamColors = {
            'blue': '#2196F3',
            'red': '#F44336',
            'green': '#4CAF50',
            'yellow': '#FFEB3B'
        };
        iconColor = teamColors[controlPoint.ownedByTeam] || '#2196F3';
    }
    
    // Check for bomb challenge - use bomb emoji if active
    if (controlPoint.hasBombChallenge) {
        iconEmoji = '💣';
        // Only use red color for bomb if not owned by a team
        if (!controlPoint.ownedByTeam) {
            iconColor = '#FF0000'; // Red for bomb
        }
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
                // Only use blue color for control point if not owned by a team
                if (!controlPoint.ownedByTeam) {
                    iconColor = '#2196F3';
                }
                iconEmoji = '🚩';
                break;
        }
    }
    
    const controlPointIcon = L.divIcon({
        className: 'control-point-marker',
        html: `
            <div style="
                background: ${iconColor}33;
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
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const marker = L.marker([controlPoint.latitude, controlPoint.longitude], {
        icon: controlPointIcon
    }).addTo(map);

    // Add orange circle for position challenge if active
    if (controlPoint.hasPositionChallenge && controlPoint.minDistance) {
        const circle = L.circle([controlPoint.latitude, controlPoint.longitude], {
            radius: controlPoint.minDistance,
            color: '#FF9800', // Orange color
            fillColor: 'transparent', // No fill
            fillOpacity: 0,
            weight: 2,
            opacity: 0.8
        }).addTo(map);
        
        // Store circle reference on marker for later removal
        marker.positionCircle = circle;
        console.log('Added position challenge circle with radius:', controlPoint.minDistance, 'meters');
    }

    // Create popup with "Tomar" option for players
    const popupContent = createControlPointPlayerMenu(controlPoint, marker);
    
    marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });

    // Store control point data on marker for reference
    marker.controlPointData = controlPoint;

    console.log('Player marker created successfully:', marker);
    return marker;
}

// Take control point action
function takeControlPoint(controlPointId) {
    console.log('Taking control point:', controlPointId);
    
    // Check if game is running before allowing action
    if (!currentGame || currentGame.status !== 'running') {
        showError('No puedes tomar puntos de control cuando el juego no está en ejecución');
        return;
    }
    
    // Find the control point data
    let controlPoint = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
            controlPoint = layer.controlPointData;
        }
    });
    
    if (!controlPoint) {
        showError('No se pudo encontrar el punto de control');
        return;
    }
    
    // Check if point is already owned by player's team
    const playerTeam = currentUser && currentUser.team;
    if (controlPoint.ownedByTeam === playerTeam) {
        showError('Este punto ya está controlado por tu equipo');
        return;
    }
    
    // Check position challenge if enabled
    if (controlPoint.minDistance || controlPoint.minAccuracy) {
        if (!navigator.geolocation) {
            showError('Tu navegador no soporta geolocalización');
            return;
        }
        
        // Get current position
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const userAccuracy = position.coords.accuracy;
                
                // Calculate distance to control point
                const distance = calculateDistance(
                    userLat, userLng,
                    controlPoint.latitude, controlPoint.longitude
                );
                
                // Check distance requirement
                if (controlPoint.minDistance && distance > controlPoint.minDistance) {
                    showError(`Debes estar a menos de ${controlPoint.minDistance}m del punto. Estás a ${Math.round(distance)}m`);
                    return;
                }
                
                // Check accuracy requirement
                if (controlPoint.minAccuracy && userAccuracy > controlPoint.minAccuracy) {
                    showError(`Tu precisión GPS debe ser mejor que ${controlPoint.minAccuracy}m. Actual: ${Math.round(userAccuracy)}m`);
                    return;
                }
                
                // If code challenge is also enabled, show code input
                if (controlPoint.hasCodeChallenge || controlPoint.hasBombChallenge) {
                    showCodeInputDialog(controlPoint);
                } else {
                    // Only position challenge, send take action
                    sendTakeControlPointAction(controlPointId);
                }
            },
            (error) => {
                showError('No se pudo obtener tu ubicación: ' + error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else if (controlPoint.hasCodeChallenge || controlPoint.hasBombChallenge) {
        // Only code challenge, show code input
        showCodeInputDialog(controlPoint);
    } else {
        // No challenges, send take action directly
        sendTakeControlPointAction(controlPointId);
    }
}

// Send take control point action via WebSocket
function sendTakeControlPointAction(controlPointId, code) {
    if (socket && currentGame) {
        const actionData = {
            controlPointId,
            userId: currentUser.id
        };
        
        // Include code if provided
        if (code) {
            actionData.code = code;
        }
        
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'takeControlPoint',
            data: actionData
        });
        
        showSuccess('¡Punto tomado!');
    }
}

// Show code input dialog
function showCodeInputDialog(controlPoint) {
    const dialog = document.createElement('div');
    dialog.className = 'code-input-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        min-width: 300px;
    `;
    
    // Determine which codes to show
    const hasRegularCode = !!controlPoint.code;
    const hasArmedCode = !!controlPoint.armedCode;
    const hasDisarmedCode = !!controlPoint.disarmedCode;
    
    let codeInputs = '';
    
    if (hasRegularCode) {
        codeInputs = `
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código:</label>
                <input type="text" id="codeInput" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código">
            </div>
        `;
    } else if (hasArmedCode && hasDisarmedCode) {
        codeInputs = `
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Armado:</label>
                <input type="text" id="armedCodeInput" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código armado">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Desarmado:</label>
                <input type="text" id="disarmedCodeInput" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código desarmado">
            </div>
        `;
    }
    
    dialog.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: #333;">Ingresa el código</h4>
        ${codeInputs}
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="submitCode(${controlPoint.id})" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Enviar</button>
            <button onclick="closeCodeDialog()" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 999;
    `;
    overlay.onclick = closeCodeDialog;
    document.body.appendChild(overlay);
    
    // Store references for cleanup
    window.currentCodeDialog = dialog;
    window.currentCodeOverlay = overlay;
}

// Submit code and take control point
function submitCode(controlPointId) {
    const controlPoint = getControlPointById(controlPointId);
    if (!controlPoint) {
        showError('No se pudo encontrar el punto de control');
        closeCodeDialog();
        return;
    }
    
    let isValid = true;
    
    if (controlPoint.code) {
        const codeInput = document.getElementById('codeInput');
        if (!codeInput || codeInput.value.trim() !== controlPoint.code) {
            showError('Código incorrecto');
            isValid = false;
        }
    } else if (controlPoint.armedCode && controlPoint.disarmedCode) {
        const armedCodeInput = document.getElementById('armedCodeInput');
        const disarmedCodeInput = document.getElementById('disarmedCodeInput');
        
        if (!armedCodeInput || armedCodeInput.value.trim() !== controlPoint.armedCode) {
            showError('Código armado incorrecto');
            isValid = false;
        } else if (!disarmedCodeInput || disarmedCodeInput.value.trim() !== controlPoint.disarmedCode) {
            showError('Código desarmado incorrecto');
            isValid = false;
        }
    }
    
    if (isValid) {
        let code = '';
        if (controlPoint.code) {
            const codeInput = document.getElementById('codeInput');
            code = codeInput ? codeInput.value.trim() : '';
        } else if (controlPoint.armedCode && controlPoint.disarmedCode) {
            const armedCodeInput = document.getElementById('armedCodeInput');
            code = armedCodeInput ? armedCodeInput.value.trim() : '';
        }
        sendTakeControlPointAction(controlPointId, code);
        closeCodeDialog();
    }
}

// Close code input dialog
function closeCodeDialog() {
    if (window.currentCodeDialog) {
        window.currentCodeDialog.remove();
        window.currentCodeDialog = null;
    }
    if (window.currentCodeOverlay) {
        window.currentCodeOverlay.remove();
        window.currentCodeOverlay = null;
    }
}

// Get control point by ID
function getControlPointById(controlPointId) {
    let controlPoint = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
            controlPoint = layer.controlPointData;
        }
    });
    return controlPoint;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Update all control point popups when game state changes
function updateControlPointPopups() {
    if (!map) return;
    
    console.log('Updating control point popups, current game state:', {
        hasCurrentGame: !!currentGame,
        gameStatus: currentGame ? currentGame.status : 'undefined'
    });
    
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            const popupContent = createControlPointPlayerMenu(layer.controlPointData, layer);
            layer.bindPopup(popupContent, {
                closeOnClick: false,
                autoClose: false,
                closeButton: true
            });
            
            // If popup is currently open, update it
            if (layer.isPopupOpen()) {
                layer.closePopup();
                layer.openPopup();
            }
        }
    });
    
    console.log('Control point popups updated');
}

// Refresh control point markers - remove and recreate with updated settings
function refreshControlPointMarkers(controlPoints) {
    if (!map) return;
    
    console.log('REFRESH PLAYER: Starting refresh with control points:', controlPoints);
    console.log('REFRESH PLAYER: Number of control points:', controlPoints ? controlPoints.length : 0);
    
    // Remove all existing control point markers and circles
    let removedCount = 0;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            // Remove position circle if exists
            if (layer.positionCircle) {
                map.removeLayer(layer.positionCircle);
                console.log('REFRESH PLAYER: Removed position circle for control point:', layer.controlPointData.id);
            }
            map.removeLayer(layer);
            removedCount++;
        }
    });
    
    console.log('REFRESH PLAYER: Removed', removedCount, 'existing markers');
    
    // Recreate all control point markers with updated settings
    if (controlPoints && Array.isArray(controlPoints)) {
        console.log('REFRESH PLAYER: Creating', controlPoints.length, 'new markers');
        controlPoints.forEach((controlPoint, index) => {
            console.log('REFRESH PLAYER: Creating marker', index + 1, 'for control point:', controlPoint.id, controlPoint.name);
            console.log('REFRESH PLAYER: Control point data:', {
                hasPositionChallenge: controlPoint.hasPositionChallenge,
                minDistance: controlPoint.minDistance,
                hasBombChallenge: controlPoint.hasBombChallenge,
                type: controlPoint.type
            });
            addControlPointMarkerPlayer(controlPoint);
        });
    } else {
        console.log('REFRESH PLAYER: No control points to create');
    }
    
    console.log('REFRESH PLAYER: Player control point markers refreshed successfully');
}

// Make functions available globally
window.addPlayerControlPointMarker = addControlPointMarkerPlayer;
window.takeControlPoint = takeControlPoint;
window.createPlayerControlPointMenu = createControlPointPlayerMenu;
window.updatePlayerControlPointPopups = updateControlPointPopups;
window.refreshPlayerControlPointMarkers = refreshControlPointMarkers;
window.submitCode = submitCode;
window.closeCodeDialog = closeCodeDialog;
window.calculateDistance = calculateDistance;
window.getControlPointById = getControlPointById;
window.sendTakeControlPointAction = sendTakeControlPointAction;
window.showCodeInputDialog = showCodeInputDialog;