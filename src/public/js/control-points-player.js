// Control points functionality for players

// Submit bomb deactivation
function submitBombDeactivation(controlPointId) {
    const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`);
    const disarmedCode = disarmedCodeInput ? disarmedCodeInput.value.trim() : '';
    
    if (!disarmedCode) {
        showToast('Por favor ingresa el código de desactivación', 'error');
        return;
    }
    
    // Send bomb deactivation request to server
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'deactivateBomb',
            data: {
                controlPointId: controlPointId,
                disarmedCode: disarmedCode,
                userId: currentUser.id
            }
        });
        
        // Clear input
        if (disarmedCodeInput) {
            disarmedCodeInput.value = '';
        }
        
        showToast('Enviando código de desactivación...', 'info');
    } else {
        showToast('Error de conexión', 'error');
    }
}

// Create control point interaction menu for players
function createControlPointPlayerMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.className = 'control-point-popup';
    
    // No point type title - only show the control point name
    
    // Debug: Log current game state for troubleshooting
    
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
        // Check if bomb is already active - use activeBombTimers which is working correctly
        let isBombActive = false;
        
        // Check activeBombTimers first (this is what makes the timer work correctly)
        if (activeBombTimers && activeBombTimers.has(controlPoint.id)) {
            const bombTimer = activeBombTimers.get(controlPoint.id);
            if (bombTimer && bombTimer.isActive) {
                isBombActive = true;
            }
        }
        // Fallback to control point data
        else if (controlPoint.bombTimer && controlPoint.bombTimer.isActive) {
            isBombActive = true;
        }
        
        if (isBombActive) {
            // Bomb is active - show disarmed code input and deactivation button (available to ALL teams)
            bombChallengeSection = `
                <div class="bomb-challenge-section" style="margin-top: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Desactivación:</label>
                    <input type="text" id="disarmedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código de desactivación">
                    <button class="submit-bomb-button" onclick="submitBombDeactivation(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Desactivar Bomba</button>
                </div>
            `;
        } else {
            // Bomb is not active - show armed code input and activation button
            bombChallengeSection = `
                <div class="bomb-challenge-section" style="margin-top: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Armado:</label>
                    <input type="text" id="armedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código armado">
                    <button class="submit-bomb-button" onclick="submitBombChallenge(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #FF5722; color: white; border: none; border-radius: 4px; cursor: pointer;">Activar Bomba</button>
                </div>
            `;
        }
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
                <!-- Position challenge bars (only shown when position challenge is active) -->
                <div class="position-challenge-bars"
                     id="position_challenge_bars_${controlPoint.id}"
                     style="
                         position: absolute;
                         top: -45px;
                         left: 50%;
                         transform: translateX(-50%);
                         display: ${(controlPoint.hasPositionChallenge && currentGame && currentGame.status === 'running') ? 'flex' : 'none'};
                         flex-direction: column;
                         gap: 2px;
                         width: 40px;
                         z-index: 1000;
                     ">
                    <!-- Team bars will be dynamically populated -->
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
                <!-- Bomb timer display below marker (dynamically shown/hidden based on bomb status) -->
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
    }

    // Create minimal loading popup initially
    const loadingPopup = document.createElement('div');
    loadingPopup.className = 'control-point-popup';
    loadingPopup.innerHTML = `
        <div class="point-name">${controlPoint.name}</div>
        <div style="text-align: center; padding: 10px; color: #666;">
            Cargando datos del punto...
        </div>
    `;
    
    marker.bindPopup(loadingPopup, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });

    // Add popup open handler to request fresh data and update popup
    marker.on('popupopen', function() {
        // Request fresh control point data when popup opens
        requestPlayerControlPointData(controlPoint.id, marker);
        
        // Update popup with fresh data after a short delay to allow WebSocket response
        setTimeout(() => {
            updatePlayerControlPointPopupWithFreshData(controlPoint.id, marker);
        }, 100);
    });

    // Store control point data on marker for reference
    marker.controlPointData = controlPoint;

    return marker;
}

// Take control point action
function takeControlPoint(controlPointId) {
    
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
    
    // Also try to get the latest control point data from currentGame
    if (currentGame && currentGame.controlPoints) {
        const latestControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
        if (latestControlPoint) {
            controlPoint = latestControlPoint;
        }
    }
    
    // Debug: Check what data we're working with
    
    // Allow taking control points even if already owned by player's team
    // This allows players to submit codes regardless of ownership
    
    // Get code from input if code challenge is active
    let code = '';
    if (controlPoint.hasCodeChallenge) {
        const codeInput = document.getElementById(`codeInput_${controlPointId}`);
        if (codeInput) {
            code = codeInput.value.trim();
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
    
    sendTakeControlPointAction(controlPointId, code);
}

// Submit position challenge
function submitPositionChallenge(controlPointId) {
    
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
    
    // Check if game is running before allowing action
    if (!currentGame || currentGame.status !== 'running') {
        showError('No puedes activar bombas cuando el juego no está en ejecución');
        return;
    }
    
    // Get armed code from input
    const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`);
    
    if (!armedCodeInput) {
        showError('No se pudo encontrar el campo de código armado');
        return;
    }
    
    const armedCode = armedCodeInput.value.trim();
    
    if (!armedCode) {
        showError('Debes ingresar el código armado para activar la bomba');
        return;
    }
    
    // Send bomb activation action via WebSocket
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'activateBomb',
            data: {
                controlPointId: controlPointId,
                armedCode: armedCode,
                userId: currentUser.id
            }
        });
    }
    
    // Clear the input field after submission
    armedCodeInput.value = '';
    
    // Don't show immediate feedback - wait for backend response to avoid double toast
}


// Get control point by ID
function getControlPointById(controlPointId) {
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
    
}

// Update specific control point popup when bomb state changes
function updateControlPointPopupForBomb(controlPointId) {
    if (!map) return;
    
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
            // Update the control point data with the latest bomb state
            if (currentGame && currentGame.controlPoints) {
                const latestControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
                if (latestControlPoint) {
                    layer.controlPointData = latestControlPoint;
                }
            }
            
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
}

// Refresh control point markers - remove and recreate with updated settings
function refreshControlPointMarkers(controlPoints) {
    if (!map) return;
    
    
    // Remove all existing control point markers and circles
    let removedCount = 0;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            // Remove position circle if exists
            if (layer.positionCircle) {
                map.removeLayer(layer.positionCircle);
            }
            map.removeLayer(layer);
            removedCount++;
        }
    });
    
    
    // Recreate all control point markers with updated settings
    if (controlPoints && Array.isArray(controlPoints)) {
        controlPoints.forEach((controlPoint, index) => {
            addControlPointMarkerPlayer(controlPoint);
        });
    } else {
        console.log('REFRESH PLAYER: No control points to create');
    }
    
    
    // Force timer display update after markers are refreshed
    if (window.updateAllTimerDisplays) {
        setTimeout(() => {
            window.updateAllTimerDisplays();
        }, 1000);
    }
    
    // Force bomb timer display update after markers are refreshed
    // This ensures bomb timers are shown immediately when markers are recreated
    if (window.updateBombTimerDisplay) {
        setTimeout(() => {
            window.updateBombTimerDisplay();
        }, 500);
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

// Bomb timer functionality
let activeBombTimers = new Map();
let bombTimerInterval = null;

// Start bomb timer interval for local decrementing
function startBombTimerInterval() {
    // Clear any existing interval
    if (bombTimerInterval) {
        clearInterval(bombTimerInterval);
    }
    
    // Start new interval to decrement bomb timers locally every second
    bombTimerInterval = setInterval(() => {
        decrementBombTimers();
        updateBombTimerDisplay();
    }, 1000);
}

// Stop bomb timer interval
function stopBombTimerInterval() {
    if (bombTimerInterval) {
        clearInterval(bombTimerInterval);
        bombTimerInterval = null;
    }
}

// Decrement bomb timers locally by 1 second each second
function decrementBombTimers() {
    // Only decrement if game is running
    if (!currentGame || currentGame.status !== 'running') {
        return;
    }
    
    activeBombTimers.forEach((bombTimer, controlPointId) => {
        // Only decrement if bomb is active and has remaining time
        if (bombTimer.isActive && bombTimer.remainingTime > 0) {
            bombTimer.remainingTime--;
            
            // If time reaches 0, mark as exploded
            if (bombTimer.remainingTime <= 0) {
                bombTimer.remainingTime = 0;
                // The server will send an exploded event, so we don't need to handle explosion here
            }
        }
    });
}

// Handle bomb time updates from server
function handleBombTimeUpdate(data) {
    
    const { controlPointId, remainingTime, totalTime, isActive, activatedByUserId, activatedByUserName, activatedByTeam, exploded } = data;
    
    // Log when bomb timer receives value from server
    
    if (exploded) {
        // Bomb exploded - remove timer and show explosion notification
        activeBombTimers.delete(controlPointId);
        updateBombTimerDisplay();
        showToast(`Bomba explotó en el punto de control!`, 'error');
        
        // Stop bomb timer interval if no more active bombs
        if (activeBombTimers.size === 0) {
            stopBombTimerInterval();
        }
        return;
    }
    
    if (!isActive) {
        // Bomb timer is no longer active
        activeBombTimers.delete(controlPointId);
        updateBombTimerDisplay();
        
        // Stop bomb timer interval if no more active bombs
        if (activeBombTimers.size === 0) {
            stopBombTimerInterval();
        }
        return;
    }
    
    // Update or add bomb timer - replace the current value with server value
    activeBombTimers.set(controlPointId, {
        controlPointId,
        remainingTime, // This replaces any locally decremented value
        totalTime,
        isActive,
        activatedByUserId,
        activatedByUserName,
        activatedByTeam,
        lastUpdate: Date.now() // Store when we received this update
    });
    
    updateBombTimerDisplay();
    
    // Start bomb timer interval if not already running
    if (!bombTimerInterval && activeBombTimers.size > 0) {
        startBombTimerInterval();
    }
    
    // Debug: Check if bomb timer element exists
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
    if (!bombTimerElement) {
        
        // If bomb timer element doesn't exist, try to update again after a short delay
        // This handles cases where control point markers are still being created
        setTimeout(() => {
            updateBombTimerDisplay();
        }, 1000);
    }
}

// Update bomb timer display in the UI
function updateBombTimerDisplay() {
    
    // Hide all bomb timers first
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            const bombTimerElement = document.getElementById(`bomb_timer_${layer.controlPointData.id}`);
            if (bombTimerElement) {
                bombTimerElement.style.display = 'none';
            }
        }
    });
    
    // Show bomb timers for active bombs
    activeBombTimers.forEach((bombTimer, controlPointId) => {
        const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
        
        if (bombTimerElement) {
            // Format time as MM:SS
            const minutes = Math.floor(bombTimer.remainingTime / 60);
            const seconds = bombTimer.remainingTime % 60;
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            bombTimerElement.textContent = formattedTime;
            
            // Show warning colors when time is running low
            if (bombTimer.remainingTime <= 60) {
                // Less than 1 minute - red background
                bombTimerElement.style.background = 'rgba(244, 67, 54, 0.9)';
            } else if (bombTimer.remainingTime <= 180) {
                // Less than 3 minutes - orange background
                bombTimerElement.style.background = 'rgba(255, 152, 0, 0.9)';
            } else {
                // Normal - red-orange background
                bombTimerElement.style.background = 'rgba(255, 87, 34, 0.9)';
            }
            
            bombTimerElement.style.display = 'block';
        } else {
            console.log(`Bomb timer element not found for control point ${controlPointId}`);
        }
    });
}

// Request active bomb timers when joining a game
function requestActiveBombTimers() {
    if (socket && currentGame) {
        socket.emit('getActiveBombTimers', { gameId: currentGame.id });
    }
}

// Handle active bomb timers response
function handleActiveBombTimers(serverBombTimers) {
    
    // Clear existing bomb timers
    activeBombTimers.clear();
    
    // Add all active bomb timers from the server
    if (serverBombTimers && Array.isArray(serverBombTimers)) {
        serverBombTimers.forEach(bombTimer => {
            activeBombTimers.set(bombTimer.controlPointId, {
                ...bombTimer,
                lastUpdate: Date.now() // Store when we received this update
            });
        });
    }
    
    // Update the display
    updateBombTimerDisplay();
    
    // Start or stop bomb timer interval based on active bombs
    if (activeBombTimers.size > 0) {
        startBombTimerInterval();
    } else {
        stopBombTimerInterval();
    }
}

// Make functions available globally
window.handleBombTimeUpdate = handleBombTimeUpdate;
window.updateBombTimerDisplay = updateBombTimerDisplay;
window.requestActiveBombTimers = requestActiveBombTimers;
window.handleActiveBombTimers = handleActiveBombTimers;
window.submitBombDeactivation = submitBombDeactivation;
// Request fresh control point data from server for players
function requestPlayerControlPointData(controlPointId, marker) {
    if (socket && currentGame) {
        // Request specific control point data using the new handler
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

// Update player control point popup with fresh data
function updatePlayerControlPointPopupWithFreshData(controlPointId, marker) {
    if (!currentGame || !currentGame.controlPoints) return;
    
    // Find the latest control point data from currentGame
    const freshControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
    if (!freshControlPoint) return;
    
    // Update the marker's control point data
    marker.controlPointData = freshControlPoint;
    
    // Create updated popup content
    const popupContent = createControlPointPlayerMenu(freshControlPoint, marker);
    
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

// Update position challenge bars with team data
function updatePositionChallengeBars(controlPointId, teamPoints) {
  const barsContainer = document.getElementById(`position_challenge_bars_${controlPointId}`);
  if (!barsContainer) {
    console.log(`[POSITION_CHALLENGE_BARS] Bars container not found for control point ${controlPointId}`);
    return;
  }

  console.log(`[POSITION_CHALLENGE_BARS] Updating bars for control point ${controlPointId}:`, teamPoints);

  // Clear existing bars
  barsContainer.innerHTML = '';

  // Calculate total points to determine percentages
  const totalPoints = Object.values(teamPoints).reduce((sum, points) => sum + points, 0);

  console.log(`[POSITION_CHALLENGE_BARS] Total points: ${totalPoints}`);

  // Team colors
  const teamColors = {
    'blue': '#2196F3',
    'red': '#F44336',
    'green': '#4CAF50',
    'yellow': '#FFEB3B'
  };

  // Create bars for each team with points
  Object.entries(teamPoints).forEach(([team, points]) => {
    if (points > 0) {
      const percentage = totalPoints > 0 ? (points / totalPoints) * 100 : 0;
      const barWidth = Math.max(2, (percentage / 100) * 40); // Minimum 2px, max 40px
      
      console.log(`[POSITION_CHALLENGE_BARS] Team ${team}: ${points} points (${percentage.toFixed(1)}%) -> ${barWidth}px`);
      
      const bar = document.createElement('div');
      bar.style.cssText = `
        height: 4px;
        width: ${barWidth}px;
        background: ${teamColors[team] || '#9E9E9E'};
        border-radius: 2px;
        transition: width 0.3s ease;
      `;
      barsContainer.appendChild(bar);
    }
  });

  // Show the bars container if there are points and position challenge is active
  const controlPoint = getControlPointById(controlPointId);
  console.log(`[POSITION_CHALLENGE_BARS] Control point data:`, controlPoint);
  console.log(`[POSITION_CHALLENGE_BARS] Current game status:`, currentGame?.status);
  
  if (controlPoint && controlPoint.hasPositionChallenge && currentGame && currentGame.status === 'running') {
    barsContainer.style.display = 'flex';
    console.log(`[POSITION_CHALLENGE_BARS] Showing bars for control point ${controlPointId}`);
  } else {
    barsContainer.style.display = 'none';
    console.log(`[POSITION_CHALLENGE_BARS] Hiding bars for control point ${controlPointId} - hasPositionChallenge: ${controlPoint?.hasPositionChallenge}, gameRunning: ${currentGame?.status === 'running'}`);
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

window.updateControlPointPopupForBomb = updateControlPointPopupForBomb;
window.requestPlayerControlPointData = requestPlayerControlPointData;
window.updatePlayerControlPointPopupWithFreshData = updatePlayerControlPointPopupWithFreshData;
window.updatePositionChallengeBars = updatePositionChallengeBars;
window.handlePositionChallengeUpdate = handlePositionChallengeUpdate;
window.updateAllPositionChallengeBars = updateAllPositionChallengeBars;