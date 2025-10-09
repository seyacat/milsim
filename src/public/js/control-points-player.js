// Control points functionality for players

// Create control point interaction menu for players
function createControlPointPlayerMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.className = 'control-point-popup';
    
    // No point type title - only show the control point name
    
    // Debug: Log current game state for troubleshooting
    console.log('Creating control point menu:', {
        controlPointId: controlPoint.id,
        gameStatus: currentGame ? currentGame.status : 'no currentGame',
        isGameRunning: currentGame && currentGame.status === 'running'
    });
    
    // Show ownership status and hold time
    let ownershipStatus = '';
    if (controlPoint.ownedByTeam) {
        const teamColors = {
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
    
    // Only show challenge buttons when game is running (don't check ownership)
    const isGameRunning = currentGame && currentGame.status === 'running';
    const canTakePoint = isGameRunning;
    
    // Show code challenge input and submit button if code challenge is active
    let codeChallengeSection = '';
    if (canTakePoint && controlPoint.hasCodeChallenge) {
        codeChallengeSection = `
            <div class="code-challenge-section" style="margin-top: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código:</label>
                <input type="text" id="codeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código">
                <button class="submit-code-button" onclick="submitCodeChallenge(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Enviar Código</button>
            </div>
        `;
    }
    
    // Show position challenge button if position challenge is active
    let positionChallengeSection = '';
    if (canTakePoint && controlPoint.hasPositionChallenge) {
        positionChallengeSection = `
            <div class="position-challenge-section" style="margin-top: 10px;">
                <button class="submit-position-button" onclick="submitPositionChallenge(${controlPoint.id})" style="width: 100%; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">Verificar Posición</button>
            </div>
        `;
    }
    
    // Show bomb challenge inputs and submit button if bomb challenge is active
    let bombChallengeSection = '';
    if (canTakePoint && controlPoint.hasBombChallenge) {
        bombChallengeSection = `
            <div class="bomb-challenge-section" style="margin-top: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Armado:</label>
                <input type="text" id="armedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código armado">
                <label style="display: block; margin-bottom: 5px; font-weight: bold; margin-top: 10px;">Código Desarmado:</label>
                <input type="text" id="disarmedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código desarmado">
                <button class="submit-bomb-button" onclick="submitBombChallenge(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #FF5722; color: white; border: none; border-radius: 4px; cursor: pointer;">Enviar Códigos Bomba</button>
            </div>
        `;
    }
    
    menu.innerHTML = `
        <div class="point-name">${controlPoint.name}</div>
        ${ownershipStatus}
        ${codeChallengeSection}
        ${positionChallengeSection}
        ${bombChallengeSection}
    `;
    
    return menu;
}

// Add control point marker to map for players
function addControlPointMarkerPlayer(controlPoint) {
    console.log('Adding control point marker for player:', controlPoint);
    console.log('Control point challenge data:', {
        hasCodeChallenge: controlPoint.hasCodeChallenge,
        hasBombChallenge: controlPoint.hasBombChallenge,
        hasPositionChallenge: controlPoint.hasPositionChallenge,
        // Don't log code values for security
    });
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
    } else {
        // When not owned by any team, use gray color to distinguish from blue team
        iconColor = '#9E9E9E'; // Gray for unowned points
    }
    
    // Check for bomb challenge - use bomb emoji if active
    if (controlPoint.hasBombChallenge) {
        iconEmoji = '💣';
        // Keep the current background color (team color or gray for unowned)
        // Don't change the background color for bomb challenge
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
                // Don't override the color for unowned control points - keep the gray color
                // Only use blue color for control point if owned by blue team (handled above)
                iconEmoji = '🚩';
                break;
        }
    }
    
    const controlPointIcon = L.divIcon({
        className: 'control-point-marker',
        html: `
            <div style="
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
            ">
                <!-- Timer display above marker (dynamically shown/hidden based on ownership) -->
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
                         display: none;
                         z-index: 1000;
                     ">00:00</div>
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
            </div>
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
            console.log('Found control point data for action:', {
                id: controlPoint.id,
                name: controlPoint.name,
                hasCodeChallenge: controlPoint.hasCodeChallenge,
                hasBombChallenge: controlPoint.hasBombChallenge,
                hasPositionChallenge: controlPoint.hasPositionChallenge,
                minDistance: controlPoint.minDistance,
                minAccuracy: controlPoint.minAccuracy
                // Don't log code values for security
            });
        }
    });
    
    if (!controlPoint) {
        showError('No se pudo encontrar el punto de control');
        return;
    }
    
    // Also try to get the latest control point data from currentGame
    if (currentGame && currentGame.controlPoints) {
        const latestControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
        if (latestControlPoint) {
            console.log('Found updated control point data from currentGame:', {
                id: latestControlPoint.id,
                name: latestControlPoint.name,
                hasCodeChallenge: latestControlPoint.hasCodeChallenge,
                hasBombChallenge: latestControlPoint.hasBombChallenge,
                hasPositionChallenge: latestControlPoint.hasPositionChallenge,
                minDistance: latestControlPoint.minDistance,
                minAccuracy: latestControlPoint.minAccuracy
                // Don't log code values for security
            });
            controlPoint = latestControlPoint;
        }
    }
    
    // Debug: Check what data we're working with
    console.log('Final control point data for action:', {
        id: controlPoint.id,
        name: controlPoint.name,
        hasCodeChallenge: controlPoint.hasCodeChallenge,
        hasBombChallenge: controlPoint.hasBombChallenge,
        hasPositionChallenge: controlPoint.hasPositionChallenge,
        minDistance: controlPoint.minDistance,
        minAccuracy: controlPoint.minAccuracy
        // Don't log code values for security
    });
    
    // Allow taking control points even if already owned by player's team
    // This allows players to submit codes regardless of ownership
    
    // Get code from input if code challenge is active
    let code = '';
    if (controlPoint.hasCodeChallenge) {
        const codeInput = document.getElementById(`codeInput_${controlPointId}`);
        if (codeInput) {
            code = codeInput.value.trim();
            console.log('Code entered by user:', code);
        }
        
        // Validate that code was entered
        if (!code) {
            showError('Debes ingresar el código para tomar este punto');
            return;
        }
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
                
                // Position challenge passed, send take action with code
                console.log('Position challenge passed, sending take action with code:', code);
                sendTakeControlPointAction(controlPointId, code);
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
    } else {
        // No position challenge, send take action directly with code
        console.log('No position challenge, sending take action with code:', code);
        sendTakeControlPointAction(controlPointId, code);
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
        
        // Success toast will be shown by the backend response
        // Don't show immediate success toast here to avoid double toasts
    }
}

// Submit code challenge
function submitCodeChallenge(controlPointId) {
    console.log('Submitting code challenge for control point:', controlPointId);
    
    // Check if game is running before allowing action
    if (!currentGame || currentGame.status !== 'running') {
        showError('No puedes tomar puntos de control cuando el juego no está en ejecución');
        return;
    }
    
    // Get code from input
    const codeInput = document.getElementById(`codeInput_${controlPointId}`);
    if (!codeInput) {
        showError('No se pudo encontrar el campo de código');
        return;
    }
    
    const code = codeInput.value.trim();
    if (!code) {
        showError('Debes ingresar el código');
        return;
    }
    
    console.log('Submitting code:', code);
    sendTakeControlPointAction(controlPointId, code);
}

// Submit position challenge
function submitPositionChallenge(controlPointId) {
    console.log('Submitting position challenge for control point:', controlPointId);
    
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
    
    // Check if position challenge is enabled
    if (!controlPoint.minDistance && !controlPoint.minAccuracy) {
        showError('Este punto no tiene desafío de posición activo');
        return;
    }
    
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
            
            // Position challenge passed, send take action
            console.log('Position challenge passed, sending take action');
            sendTakeControlPointAction(controlPointId);
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
}

// Submit bomb challenge
function submitBombChallenge(controlPointId) {
    console.log('Submitting bomb challenge for control point:', controlPointId);
    
    // Check if game is running before allowing action
    if (!currentGame || currentGame.status !== 'running') {
        showError('No puedes tomar puntos de control cuando el juego no está en ejecución');
        return;
    }
    
    // Get codes from inputs
    const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`);
    const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`);
    
    if (!armedCodeInput || !disarmedCodeInput) {
        showError('No se pudieron encontrar los campos de código');
        return;
    }
    
    const armedCode = armedCodeInput.value.trim();
    const disarmedCode = disarmedCodeInput.value.trim();
    
    if (!armedCode || !disarmedCode) {
        showError('Debes ingresar ambos códigos');
        return;
    }
    
    // For bomb challenges, we need to send one of the codes
    // The backend will validate both codes
    console.log('Submitting bomb codes - armed:', armedCode, 'disarmed:', disarmedCode);
    
    // Send the armed code (the backend will validate both)
    sendTakeControlPointAction(controlPointId, armedCode);
}


// Get control point by ID
function getControlPointById(controlPointId) {
    let controlPoint = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
            controlPoint = layer.controlPointData;
            console.log('Found control point in map layers:', {
                id: controlPoint.id,
                name: controlPoint.name,
                hasCodeChallenge: controlPoint.hasCodeChallenge,
                hasBombChallenge: controlPoint.hasBombChallenge
            });
        }
    });
    
    // If not found in map layers, try to get from currentGame
    if (!controlPoint && currentGame && currentGame.controlPoints) {
        const latestControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
        if (latestControlPoint) {
            console.log('Found control point in currentGame:', {
                id: latestControlPoint.id,
                name: latestControlPoint.name,
                hasCodeChallenge: latestControlPoint.hasCodeChallenge,
                hasBombChallenge: latestControlPoint.hasBombChallenge
            });
            controlPoint = latestControlPoint;
        }
    }
    
    if (!controlPoint) {
        console.log('Control point not found in map layers or currentGame:', controlPointId);
    }
    
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
                hasCodeChallenge: controlPoint.hasCodeChallenge,
                type: controlPoint.type
            });
            addControlPointMarkerPlayer(controlPoint);
        });
    } else {
        console.log('REFRESH PLAYER: No control points to create');
    }
    
    console.log('REFRESH PLAYER: Player control point markers refreshed successfully');
    
    // Force timer display update after markers are refreshed
    if (window.updateAllTimerDisplays) {
        setTimeout(() => {
            console.log('Forcing timer display update after marker refresh');
            window.updateAllTimerDisplays();
        }, 1000);
    }
}

// Update timer display visibility based on ownership and game state
function updateTimerDisplay(controlPointId, ownedByTeam, displayTime) {
    const timerElement = document.getElementById(`timer_${controlPointId}`);
    if (timerElement) {
        // Show timer only when game is running and control point is owned
        const shouldShow = currentGame && currentGame.status === 'running' && ownedByTeam;
        timerElement.style.display = shouldShow ? 'block' : 'none';
        
        if (shouldShow && displayTime) {
            timerElement.textContent = displayTime;
        }
    }
}

// Make functions available globally
window.addPlayerControlPointMarker = addControlPointMarkerPlayer;
window.takeControlPoint = takeControlPoint;
window.createPlayerControlPointMenu = createControlPointPlayerMenu;
window.updatePlayerControlPointPopups = updateControlPointPopups;
window.refreshPlayerControlPointMarkers = refreshControlPointMarkers;
window.calculateDistance = calculateDistance;
window.getControlPointById = getControlPointById;
window.sendTakeControlPointAction = sendTakeControlPointAction;
window.submitCodeChallenge = submitCodeChallenge;
window.submitPositionChallenge = submitPositionChallenge;
window.submitBombChallenge = submitBombChallenge;
window.updateTimerDisplay = updateTimerDisplay;