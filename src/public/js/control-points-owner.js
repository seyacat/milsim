// Control points functionality for owners
let controlPointMenuVisible = false;
let mapClickHandler = null;

// Initialize owner control points features
function initializeOwnerControlPoints() {
    
    // Remove any existing click handler first
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
    }
    
    // Add click handler for owners to create control points
    mapClickHandler = function(e) {
        // Only show menu if no menu is currently visible
        if (!controlPointMenuVisible) {
            showControlPointMenu(e.latlng);
        }
    };
    
    // Remove any existing handler first to avoid duplicates
    map.off('click', mapClickHandler);
    map.on('click', mapClickHandler);
    
}

// Show control point creation menu
function showControlPointMenu(latlng) {
    // Remove any existing menu
    const existingMenu = document.getElementById('controlPointMenu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // Remove map click handler to prevent multiple menus
    if (map && mapClickHandler) {
        map.off('click', mapClickHandler);
    }

    // Create menu content
    const menuContent = `
        <div id="controlPointMenu">
            <div style="display: flex; justify-content: center;">
                <button onclick="window.createControlPoint(${latlng.lat}, ${latlng.lng})" style="padding: 8px 16px; margin: 0 10px 0 5px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Crear Punto de Control</button>
            </div>
        </div>
    `;

    // Create Leaflet popup that sticks to the map
    const popup = L.popup()
        .setLatLng(latlng)
        .setContent(menuContent)
        .openOn(map);

    controlPointMenuVisible = true;

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeControlPointMenuOutside);
    }, 200);
}

// Close control point menu when clicking outside
function closeControlPointMenuOutside(e) {
    const menu = document.getElementById('controlPointMenu');
    const teamsDialog = document.getElementById('teamsDialog');
    
    // Don't close if teams dialog is open and click is inside teams dialog
    if (teamsDialog && teamsDialog.style.display === 'flex' && teamsDialog.contains(e.target)) {
        return;
    }
    
    if (menu && !menu.contains(e.target) && !e.target.closest('#controlPointMenu')) {
        closeControlPointMenu();
    }
}

// Close control point menu
function closeControlPointMenu() {
    // Remove the menu element first
    const menu = document.getElementById('controlPointMenu');
    if (menu) {
        menu.remove();
    }
    controlPointMenuVisible = false;
    
    // Remove the click outside listener
    try {
        document.removeEventListener('click', closeControlPointMenuOutside);
    } catch (e) {
        // Ignore if listener doesn't exist
    }
    
    // Close any open popups
    map.closePopup();
    
    // Re-enable map click handler after a short delay to prevent immediate reopening
    setTimeout(() => {
        if (map && mapClickHandler) {
            // Remove any existing handler first to avoid duplicates
            map.off('click', mapClickHandler);
            map.on('click', mapClickHandler);
        }
    }, 200); // Increased delay to ensure menu is fully closed
}

// Check if game already has a Site
function hasSiteControlPoint() {
    let hasSite = false;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.type === 'site') {
            hasSite = true;
        }
    });
    return hasSite;
}

// Create control point
async function createControlPoint(lat, lng) {
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

// Add control point marker to map for owners
function addControlPointMarkerOwner(controlPoint) {
    
    // Create icon based on type, bomb challenge, and ownership
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
    
    // If bomb challenge is active, use bomb emoji regardless of type
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
                <!-- Timer display above marker (only shown when game is running and control point is owned) -->
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
                         display: ${(currentGame && currentGame.status === 'running' && controlPoint.ownedByTeam) ? 'block' : 'none'};
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

    // Add orange circle if position challenge is active
    if (controlPoint.hasPositionChallenge && controlPoint.minDistance) {
        const circle = L.circle([controlPoint.latitude, controlPoint.longitude], {
            radius: controlPoint.minDistance,
            color: '#FF9800', // Orange color
            fillColor: 'transparent', // No fill
            fillOpacity: 0,
            weight: 2,
            opacity: 0.8
        }).addTo(map);
        
        // Store circle reference with marker
        marker.positionCircle = circle;
        circle.controlPointId = controlPoint.id;
    }

    // Create a minimal popup that will be updated with fresh data when opened
    const loadingPopup = L.popup()
        .setContent('Cargando datos del punto...');
    
    marker.bindPopup(loadingPopup, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });

    // Add popup open/close handlers
    marker.on('popupopen', function() {
        // Remove map click handler to prevent conflicts while editing
        if (map && mapClickHandler) {
            map.off('click', mapClickHandler);
        }
        
        // Request fresh control point data when popup opens
        requestControlPointData(controlPoint.id, marker);
        
        // Update bomb button states when popup opens
        if (controlPoint.hasBombChallenge && controlPoint.type !== 'site') {
            setTimeout(() => {
                updateBombButtonStates(controlPoint.id);
            }, 100);
        }
    });

    marker.on('popupclose', function() {
        
        // Re-enable map click handler after popup is closed
        setTimeout(() => {
            if (map && mapClickHandler) {
                map.on('click', mapClickHandler);
            }
        }, 100);
    });

    // Store control point data on marker for reference
    marker.controlPointData = controlPoint;

    return marker;
}

// Create control point edit menu
function createControlPointEditMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.className = 'control-point-edit-menu';
    
    
    // Check if there's already a Site in the game (excluding current point)
    const hasOtherSite = hasSiteControlPoint() && controlPoint.type !== 'site';
    
    let typeOptions = '';
    if (hasOtherSite && controlPoint.type !== 'site') {
        // If there's already a Site and this is not it, only show Control Point
        typeOptions = `
            <option value="control_point" ${controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
        `;
    } else {
        // Show all options
        typeOptions = `
            <option value="site" ${controlPoint.type === 'site' ? 'selected' : ''}>Site</option>
            <option value="control_point" ${!controlPoint.type || controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
        `;
    }
    
    // Position challenge section
    // Check if position challenge should be active based on stored checkbox state
    const positionChallengeChecked = controlPoint.hasPositionChallenge || false;
    
    // Set default values for dropdowns if not already set
    const defaultMinDistance = controlPoint.minDistance || 25; // Default to 25m
    const defaultMinAccuracy = controlPoint.minAccuracy || 20; // Default to 20m
    
    // Distance options (in meters)
    const distanceOptions = `
        <option value="5" ${defaultMinDistance === 5 ? 'selected' : ''}>5m (Muy cercano)</option>
        <option value="10" ${defaultMinDistance === 10 ? 'selected' : ''}>10m (Cercano)</option>
        <option value="25" ${defaultMinDistance === 25 ? 'selected' : ''}>25m (Medio)</option>
        <option value="50" ${defaultMinDistance === 50 ? 'selected' : ''}>50m (Lejano)</option>
        <option value="100" ${defaultMinDistance === 100 ? 'selected' : ''}>100m (Muy lejano)</option>
    `;
    
    // Accuracy options (in meters)
    const accuracyOptions = `
        <option value="5" ${defaultMinAccuracy === 5 ? 'selected' : ''}>5m (Alta precisión)</option>
        <option value="10" ${defaultMinAccuracy === 10 ? 'selected' : ''}>10m (Buena precisión)</option>
        <option value="20" ${defaultMinAccuracy === 20 ? 'selected' : ''}>20m (Precisión media)</option>
        <option value="50" ${defaultMinAccuracy === 50 ? 'selected' : ''}>50m (Baja precisión)</option>
        <option value="100" ${defaultMinAccuracy === 100 ? 'selected' : ''}>100m (Muy baja precisión)</option>
    `;
    const positionInputs = `
        <div class="form-group">
            <label class="form-label">Distancia Mínima:</label>
            <select id="controlPointMinDistance_${controlPoint.id}" class="form-input">
                ${distanceOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Accuracy Mínimo:</label>
            <select id="controlPointMinAccuracy_${controlPoint.id}" class="form-input">
                ${accuracyOptions}
            </select>
        </div>
    `;
    
    // Code challenge section
    // Check if code challenge should be active based on stored checkbox state
    const codeChallengeChecked = controlPoint.hasCodeChallenge || false;
    const codeInputs = `
        <div class="form-group">
            <label class="form-label">Code:</label>
            <input type="text" id="controlPointCode_${controlPoint.id}" value="${controlPoint.code || ''}" class="form-input" placeholder="Código para tomar">
        </div>
    `;

    // Bomb challenge section
    // Check if bomb challenge should be active based on stored checkbox state
    const bombChallengeChecked = controlPoint.hasBombChallenge || false;
    
    // Set default bomb time if not already set
    const defaultBombTime = controlPoint.bombTime || 300; // Default to 5 minutes
    
    // Bomb time options (in seconds)
    const bombTimeOptions = `
        <option value="60" ${defaultBombTime === 60 ? 'selected' : ''}>1 minuto</option>
        <option value="120" ${defaultBombTime === 120 ? 'selected' : ''}>2 minutos</option>
        <option value="180" ${defaultBombTime === 180 ? 'selected' : ''}>3 minutos</option>
        <option value="300" ${defaultBombTime === 300 ? 'selected' : ''}>5 minutos</option>
        <option value="600" ${defaultBombTime === 600 ? 'selected' : ''}>10 minutos</option>
        <option value="900" ${defaultBombTime === 900 ? 'selected' : ''}>15 minutos</option>
    `;
    
    const bombInputs = `
        <div class="form-group">
            <label class="form-label">Bomb Time:</label>
            <select id="controlPointBombTime_${controlPoint.id}" class="form-input">
                ${bombTimeOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Armed Code:</label>
            <input type="text" id="controlPointArmedCode_${controlPoint.id}" value="${controlPoint.armedCode || ''}" class="form-input" placeholder="Código para armar">
        </div>
        <div class="form-group">
            <label class="form-label">Disarmed Code:</label>
            <input type="text" id="controlPointDisarmedCode_${controlPoint.id}" value="${controlPoint.disarmedCode || ''}" class="form-input" placeholder="Código para desarmar">
        </div>
    `;
    
    // Get team count from current game
    const teamCount = currentGame ? currentGame.teamCount : 4; // Default to 4 if not available
    
    // Define teams based on team count
    const teams = [];
    if (teamCount >= 2) {
        teams.push({ id: 'blue', name: 'Azul', color: '#2196F3', textColor: 'white' });
        teams.push({ id: 'red', name: 'Rojo', color: '#F44336', textColor: 'white' });
    }
    if (teamCount >= 3) {
        teams.push({ id: 'green', name: 'Verde', color: '#4CAF50', textColor: 'white' });
    }
    if (teamCount >= 4) {
        teams.push({ id: 'yellow', name: 'Amarillo', color: '#FFEB3B', textColor: '#333' });
    }
    
    // Generate team buttons HTML
    let teamButtonsHTML = '';
    teams.forEach(team => {
        teamButtonsHTML += `
            <button onclick="assignControlPointTeam(${controlPoint.id}, '${team.id}')"
                    class="team-btn ${controlPoint.ownedByTeam === team.id ? 'team-btn-active' : ''}"
                    style="background: ${team.color}; color: ${team.textColor}; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1; min-width: 60px;">
                ${team.name}
            </button>
        `;
    });
    
    // Add "None" button
    teamButtonsHTML += `
        <button onclick="assignControlPointTeam(${controlPoint.id}, 'none')"
                class="team-btn ${!controlPoint.ownedByTeam ? 'team-btn-active' : ''}"
                style="background: #9E9E9E; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1; min-width: 60px;">
            Ninguno
        </button>
    `;

    menu.innerHTML = `
        <div class="control-point-edit-content">
            <h4 class="edit-title">Editar Punto</h4>
            ${controlPoint.ownedByTeam ? `
                <div class="ownership-status" style="background: ${controlPoint.ownedByTeam}; color: white; padding: 5px; border-radius: 4px; margin-bottom: 10px; text-align: center; font-weight: bold;">
                    Controlado por: ${controlPoint.ownedByTeam.toUpperCase()}
                </div>
                <div class="hold-time" style="font-size: 12px; color: #666; text-align: center; margin-bottom: 10px;">
                    Tiempo: ${controlPoint.displayTime || '00:00'}
                </div>
            ` : ''}
            
            <!-- Team Assignment Section -->
            <div class="team-assignment-section" style="margin-bottom: 15px;">
                <h5 class="team-title" style="margin-bottom: 8px; font-size: 14px; color: #333;">Asignar Equipo</h5>
                <div class="team-buttons" style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${teamButtonsHTML}
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Tipo:</label>
                <select id="controlPointType_${controlPoint.id}" class="form-input">
                    ${typeOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Nombre:</label>
                <input type="text" id="controlPointEditName_${controlPoint.id}" value="${controlPoint.name}" class="form-input">
            </div>
            
            ${controlPoint.type !== 'site' ? `
            <div class="challenges-section">
                <h5 class="challenges-title">Challenges</h5>
                
                <!-- Position Challenge -->
                <div class="challenge-group">
                    <label class="challenge-label">
                        <input type="checkbox" id="positionChallenge_${controlPoint.id}" ${positionChallengeChecked ? 'checked' : ''} class="challenge-checkbox">
                        <span class="challenge-text">Position Challenge</span>
                    </label>
                    <div id="positionInputs_${controlPoint.id}" class="challenge-inputs ${positionChallengeChecked ? '' : 'hidden'}">
                        ${positionInputs}
                    </div>
                </div>
                
                <!-- Code Challenge -->
                <div class="challenge-group">
                    <label class="challenge-label">
                        <input type="checkbox" id="codeChallenge_${controlPoint.id}" ${codeChallengeChecked ? 'checked' : ''} class="challenge-checkbox">
                        <span class="challenge-text">Code Challenge</span>
                    </label>
                    <div id="codeInputs_${controlPoint.id}" class="challenge-inputs ${codeChallengeChecked ? '' : 'hidden'}">
                        ${codeInputs}
                    </div>
                </div>
                
                <!-- Bomb Challenge -->
                <div class="challenge-group">
                    <label class="challenge-label">
                        <input type="checkbox" id="bombChallenge_${controlPoint.id}" ${bombChallengeChecked ? 'checked' : ''} class="challenge-checkbox">
                        <span class="challenge-text">Bomb Challenge</span>
                    </label>
                    <div id="bombInputs_${controlPoint.id}" class="challenge-inputs ${bombChallengeChecked ? '' : 'hidden'}">
                        ${bombInputs}
                        ${controlPoint.hasBombChallenge && controlPoint.type !== 'site' && currentGame && currentGame.status === 'running' ? `
                        <!-- Bomb Action Buttons -->
                        <div class="bomb-action-buttons" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <button onclick="window.activateBombAsOwner(${controlPoint.id})"
                                        class="btn btn-danger"
                                        id="activateBombBtnOwner_${controlPoint.id}"
                                        style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">
                                    Activar Bomba
                                </button>
                                <button onclick="window.deactivateBombAsOwner(${controlPoint.id})"
                                        class="btn btn-success"
                                        id="deactivateBombBtnOwner_${controlPoint.id}"
                                        style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">
                                    Desactivar Bomba
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div class="action-buttons">
                <button onclick="window.enableDragMode(${controlPoint.id}, ${marker._leaflet_id})" class="btn btn-move" title="Mover punto" style="background: rgba(33, 150, 243, 0.2); border: 1px solid #2196F3; color: #2196F3;">🧭</button>
                <button onclick="window.updateControlPoint(${controlPoint.id}, ${marker._leaflet_id})" class="btn btn-primary">Actualizar</button>
                <button onclick="window.deleteControlPoint(${controlPoint.id}, ${marker._leaflet_id})" class="btn btn-danger">Eliminar</button>
            </div>
        </div>
    `;
    
    
    // Add inline onclick handlers for checkboxes
    menu.innerHTML = menu.innerHTML.replace(
        'id="positionChallenge_' + controlPoint.id + '"',
        'id="positionChallenge_' + controlPoint.id + '" onclick="togglePositionInputs(\'' + controlPoint.id + '\')"'
    );
    
    menu.innerHTML = menu.innerHTML.replace(
        'id="codeChallenge_' + controlPoint.id + '"',
        'id="codeChallenge_' + controlPoint.id + '" onclick="toggleCodeInputs(\'' + controlPoint.id + '\')"'
    );
    
    menu.innerHTML = menu.innerHTML.replace(
        'id="bombChallenge_' + controlPoint.id + '"',
        'id="bombChallenge_' + controlPoint.id + '" onclick="toggleBombInputs(\'' + controlPoint.id + '\')"'
    );
    
    return menu;
}


// Update control point
function updateControlPoint(controlPointId, markerId) {
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
            // Find the current marker to check if it's already a Site
            let currentIsSite = false;
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer._leaflet_id === markerId && layer.controlPointData && layer.controlPointData.type === 'site') {
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
function deleteControlPoint(controlPointId, markerId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este punto?')) {
        return;
    }
    
    // Send delete via WebSocket
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

// Toggle position inputs visibility
function togglePositionInputs(controlPointId) {
    const checkbox = document.getElementById(`positionChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`positionInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle code inputs visibility
function toggleCodeInputs(controlPointId) {
    const checkbox = document.getElementById(`codeChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`codeInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle bomb inputs visibility
function toggleBombInputs(controlPointId) {
    const checkbox = document.getElementById(`bombChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`bombInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Update all control point popups when game state changes (for owners)
function updateOwnerControlPointPopups() {
    if (!map) return;
    
    
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            const popupContent = createControlPointEditMenu(layer.controlPointData, layer);
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

// Refresh control point markers - remove and recreate with updated settings (for owners)
function refreshOwnerControlPointMarkers(controlPoints) {
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
            addControlPointMarkerOwner(controlPoint);
        });
    } else {
        console.log('REFRESH OWNER: No control points to create');
    }
    
    // Force bomb timer display update after markers are refreshed
    // This ensures bomb timers are shown immediately when markers are recreated
    if (window.updateBombTimerDisplay) {
        setTimeout(() => {
            window.updateBombTimerDisplay();
        }, 500);
    }
}

// Enable drag mode for moving control points
function enableDragMode(controlPointId, markerId) {
    
    // Find the marker
    let targetMarker = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer._leaflet_id === markerId && layer.controlPointData) {
            targetMarker = layer;
        }
    });
    
    if (!targetMarker) {
        console.error(`Marker not found for control point ${controlPointId}`);
        return;
    }
    
    // Close the popup menu
    targetMarker.closePopup();
    
    // Make marker draggable
    targetMarker.dragging.enable();
    
    // Change cursor to indicate drag mode
    targetMarker.getElement().style.cursor = 'move';
    
    // Add dragend event listener to update position when dragging stops
    targetMarker.on('dragend', function(event) {
        const marker = event.target;
        const newPosition = marker.getLatLng();
        
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
function assignControlPointTeam(controlPointId, team) {
    
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
function handleControlPointTeamAssigned(data) {
    
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

// Update a single owner marker without refreshing all markers
function updateSingleOwnerMarker(controlPoint) {
    
    // Find the existing marker
    let existingMarker = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPoint.id) {
            existingMarker = layer;
        }
    });
    
    if (!existingMarker) {
        addControlPointMarkerOwner(controlPoint);
        return;
    }
    
    // Remove the existing marker and its position circle
    if (existingMarker.positionCircle) {
        map.removeLayer(existingMarker.positionCircle);
    }
    map.removeLayer(existingMarker);
    
    // Create a new marker with updated data
    addControlPointMarkerOwner(controlPoint);
    
}

// Make functions available globally
window.initializeOwnerControlPoints = initializeOwnerControlPoints;
window.showControlPointMenu = showControlPointMenu;
window.closeControlPointMenu = closeControlPointMenu;
window.closeControlPointMenuOutside = closeControlPointMenuOutside;
window.createControlPoint = createControlPoint;
window.addOwnerControlPointMarker = addControlPointMarkerOwner;
window.updateControlPoint = updateControlPoint;
window.deleteControlPoint = deleteControlPoint;
window.createOwnerControlPointEditMenu = createControlPointEditMenu;
window.updateOwnerControlPointPopups = updateOwnerControlPointPopups;
window.refreshOwnerControlPointMarkers = refreshOwnerControlPointMarkers;
window.togglePositionInputs = togglePositionInputs;
window.toggleCodeInputs = toggleCodeInputs;
window.toggleBombInputs = toggleBombInputs;
window.enableDragMode = enableDragMode;
window.assignControlPointTeam = assignControlPointTeam;
window.handleControlPointTeamAssigned = handleControlPointTeamAssigned;
window.updateSingleOwnerMarker = updateSingleOwnerMarker;

// Bomb timer functionality for owners
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
        updateBombButtonStates(controlPointId);
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
        updateBombButtonStates(controlPointId);
        
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
    updateBombButtonStates(controlPointId);
    
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
    
    // Update all bomb button states
    updateAllBombButtonStates();
    
    // Start or stop bomb timer interval based on active bombs
    if (activeBombTimers.size > 0) {
        startBombTimerInterval();
    } else {
        stopBombTimerInterval();
    }
}

// Activate bomb function for owners (with code validation)
function activateBomb(controlPointId) {
    if (!socket || !currentGame) return;
    
    // Get the armed code from the input field
    const armedCodeInput = document.getElementById(`controlPointArmedCode_${controlPointId}`);
    if (!armedCodeInput || !armedCodeInput.value.trim()) {
        showError('Debes ingresar el código de activación para armar la bomba');
        return;
    }
    
    const armedCode = armedCodeInput.value.trim();
    
    socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'activateBomb',
        data: {
            controlPointId: controlPointId,
            armedCode: armedCode
        }
    });
    
    // Immediately update button states to provide feedback
    updateBombButtonStates(controlPointId);
    
    // Success message will be shown when we receive the WebSocket event
}

// Deactivate bomb function for owners (with code validation)
function deactivateBomb(controlPointId) {
    if (!socket || !currentGame) return;
    
    // Get the disarmed code from the input field
    const disarmedCodeInput = document.getElementById(`controlPointDisarmedCode_${controlPointId}`);
    if (!disarmedCodeInput || !disarmedCodeInput.value.trim()) {
        showError('Debes ingresar el código de desactivación para desarmar la bomba');
        return;
    }
    
    const disarmedCode = disarmedCodeInput.value.trim();
    
    socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'deactivateBomb',
        data: {
            controlPointId: controlPointId,
            disarmedCode: disarmedCode
        }
    });
    
    // Immediately update button states to provide feedback
    updateBombButtonStates(controlPointId);
    
    // Success message will be shown when we receive the WebSocket event
}

// Activate bomb as owner without code validation
function activateBombAsOwner(controlPointId) {
    if (!socket || !currentGame) return;
    
    socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'activateBombAsOwner',
        data: {
            controlPointId: controlPointId
        }
    });
    
    // Immediately update button states to provide feedback
    updateBombButtonStates(controlPointId);
    
    // Success message will be shown when we receive the WebSocket event
}

// Deactivate bomb as owner without code validation
function deactivateBombAsOwner(controlPointId) {
    if (!socket || !currentGame) return;
    
    socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'deactivateBombAsOwner',
        data: {
            controlPointId: controlPointId
        }
    });
    
    // Immediately update button states to provide feedback
    updateBombButtonStates(controlPointId);
    
    // Success message will be shown when we receive the WebSocket event
}

// Check if bomb is active for a control point
function isBombActive(controlPointId) {
    return activeBombTimers.has(controlPointId) && activeBombTimers.get(controlPointId).isActive;
}

// Update bomb button states for a specific control point
function updateBombButtonStates(controlPointId) {
    const activateBtnOwner = document.getElementById(`activateBombBtnOwner_${controlPointId}`);
    const deactivateBtnOwner = document.getElementById(`deactivateBombBtnOwner_${controlPointId}`);
    
    const isActive = isBombActive(controlPointId);
    
    // Update owner buttons (no code required)
    if (activateBtnOwner && deactivateBtnOwner) {
        activateBtnOwner.disabled = isActive;
        deactivateBtnOwner.disabled = !isActive;
    }
}

// Update all bomb button states
function updateAllBombButtonStates() {
    activeBombTimers.forEach((bombTimer, controlPointId) => {
        updateBombButtonStates(controlPointId);
    });
}

// Make functions available globally
window.handleBombTimeUpdate = handleBombTimeUpdate;
window.updateBombTimerDisplay = updateBombTimerDisplay;
window.requestActiveBombTimers = requestActiveBombTimers;
window.handleActiveBombTimers = handleActiveBombTimers;
window.activateBomb = activateBomb;
window.deactivateBomb = deactivateBomb;
window.isBombActive = isBombActive;
window.updateBombButtonStates = updateBombButtonStates;
window.updateAllBombButtonStates = updateAllBombButtonStates;
window.activateBombAsOwner = activateBombAsOwner;
// Request fresh control point data from server
function requestControlPointData(controlPointId, marker) {
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
function updateControlPointPopupWithFreshData(controlPointId, marker) {
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

// Update position challenge pie chart with team data
function updatePositionChallengeBars(controlPointId, teamPoints) {
  console.log(`[POSITION_CHALLENGE_PIE] START - Updating pie chart for control point ${controlPointId}:`, teamPoints);
  
  // Find the marker
  let marker = null;
  
  map.eachLayer((layer) => {
    if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
      marker = layer;
    }
  });

  if (!marker) {
    console.log(`[POSITION_CHALLENGE_PIE] ERROR: Marker not found for control point ${controlPointId}`);
    return;
  }

  // Calculate total points to determine percentages
  const totalPoints = Object.values(teamPoints).reduce((sum, points) => sum + points, 0);

  console.log(`[POSITION_CHALLENGE_PIE] Total points: ${totalPoints}`);

  // Team colors
  const teamColors = {
    'blue': '#2196F3',
    'red': '#F44336',
    'green': '#4CAF50',
    'yellow': '#FFEB3B'
  };

  // Get control point to determine radius
  const controlPoint = getControlPointById(controlPointId);
  console.log(`[POSITION_CHALLENGE_PIE] Control point data:`, controlPoint);
  console.log(`[POSITION_CHALLENGE_PIE] Game status:`, currentGame?.status);
  
  // Remove existing pie SVG if it exists
  if (marker.pieSvg) {
    console.log(`[POSITION_CHALLENGE_PIE] Removing existing pie SVG overlay`);
    map.removeLayer(marker.pieSvg);
    marker.pieSvg = null;
    marker.pieData = null;
  }

  // Create pie chart if there are points and position challenge is active
  if (totalPoints > 0 && controlPoint && controlPoint.hasPositionChallenge && currentGame && currentGame.status === 'running') {
    console.log(`[POSITION_CHALLENGE_PIE] Creating pie chart for control point ${controlPointId}`);

    // Get the position circle to use its bounds
    const positionCircle = marker.positionCircle;
    if (!positionCircle) {
      console.log(`[POSITION_CHALLENGE_PIE] ERROR: No position circle found for control point ${controlPointId}`);
      return;
    }

    console.log(`[POSITION_CHALLENGE_PIE] Position circle found:`, positionCircle);

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

    console.log(`[POSITION_CHALLENGE_PIE] SVG dimensions: ${svgWidth}x${svgHeight}`);

    // Create Leaflet SVG overlay that moves with the map
    const svgOverlay = L.svgOverlay(svgElement, bounds, {
      opacity: 0.8,
      interactive: false
    }).addTo(map);

    console.log(`[POSITION_CHALLENGE_PIE] SVG overlay created with bounds:`, bounds);

    let startAngle = 0;

    // Create pie slices for each team with points
    Object.entries(teamPoints).forEach(([team, points]) => {
      if (points > 0) {
        const percentage = points / totalPoints;
        const sliceAngle = percentage * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        console.log(`[POSITION_CHALLENGE_PIE] Team ${team}: ${points} points (${(percentage * 100).toFixed(1)}%)`);

        // Calculate arc coordinates relative to SVG center
        const svgCenterX = svgWidth / 2;
        const svgCenterY = svgHeight / 2;
        const startX = svgCenterX + radiusPixels * Math.cos(startAngle);
        const startY = svgCenterY + radiusPixels * Math.sin(startAngle);
        const endX = svgCenterX + radiusPixels * Math.cos(endAngle);
        const endY = svgCenterY + radiusPixels * Math.sin(endAngle);

        // Create large arc flag (1 for angles > 180 degrees, 0 otherwise)
        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

        // Create path for pie slice
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const pathData = [
          `M ${svgCenterX} ${svgCenterY}`,
          `L ${startX} ${startY}`,
          `A ${radiusPixels} ${radiusPixels} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
          'Z'
        ].join(' ');

        path.setAttribute('d', pathData);
        path.setAttribute('fill', teamColors[team] || '#9E9E9E');
        path.setAttribute('opacity', '0.8');
        path.setAttribute('stroke', '#FFFFFF');
        path.setAttribute('stroke-width', '1');
        
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

    console.log(`[POSITION_CHALLENGE_PIE] SUCCESS: Pie chart created for control point ${controlPointId}`);
  } else {
    console.log(`[POSITION_CHALLENGE_PIE] No pie chart created - conditions: totalPoints=${totalPoints}, hasPositionChallenge=${controlPoint?.hasPositionChallenge}, gameRunning=${currentGame?.status === 'running'}`);
  }
}

// Get control point by ID (helper function)
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
    
    return controlPoint;
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

window.deactivateBombAsOwner = deactivateBombAsOwner;
window.requestControlPointData = requestControlPointData;
window.updateControlPointPopupWithFreshData = updateControlPointPopupWithFreshData;
window.updatePositionChallengeBars = updatePositionChallengeBars;
window.handlePositionChallengeUpdate = handlePositionChallengeUpdate;
window.updateAllPositionChallengeBars = updateAllPositionChallengeBars;
window.getControlPointById = getControlPointById;
