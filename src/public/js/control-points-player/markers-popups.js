// Control point markers and popups functionality for players

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

// Export functions
window.addPlayerControlPointMarker = addControlPointMarkerPlayer;
window.createPlayerControlPointMenu = createControlPointPlayerMenu;
window.updatePlayerControlPointPopups = updateControlPointPopups;
window.refreshPlayerControlPointMarkers = refreshControlPointMarkers;
window.updateTimerDisplay = updateTimerDisplay;
window.updateControlPointPopupForBomb = updateControlPointPopupForBomb;
window.requestPlayerControlPointData = requestPlayerControlPointData;
window.updatePlayerControlPointPopupWithFreshData = updatePlayerControlPointPopupWithFreshData;