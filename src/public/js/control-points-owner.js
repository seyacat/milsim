// Control points functionality for owners
let controlPointMenuVisible = false;
let mapClickHandler = null;

// Initialize owner control points features
function initializeOwnerControlPoints() {
    console.log('Initializing owner control points features');
    console.log('Map available:', !!map);
    console.log('Current game available:', !!currentGame);
    console.log('Current user available:', !!currentUser);
    
    // Remove any existing click handler first
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
    }
    
    // Add click handler for owners to create control points
    mapClickHandler = function(e) {
        console.log('Owner clicked on map at:', e.latlng);
        // Only show menu if no menu is currently visible
        if (!controlPointMenuVisible) {
            showControlPointMenu(e.latlng);
        }
    };
    
    // Remove any existing handler first to avoid duplicates
    map.off('click', mapClickHandler);
    map.on('click', mapClickHandler);
    
    console.log('Owner control points features initialized successfully');
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
        console.log('Map click handler removed for menu');
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
            console.log('Map click handler re-enabled');
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
    console.log('Adding control point marker for owner:', controlPoint);
    console.log('Map available for marker:', !!map);
    console.log('Current game available for marker:', !!currentGame);
    console.log('Current user available for marker:', !!currentUser);
    
    // Create icon based on type and bomb challenge
    let iconColor = '#2196F3'; // Default for control_point
    let iconEmoji = '🚩'; // Default for control_point
    
    // If bomb challenge is active, use bomb emoji regardless of type
    if (controlPoint.hasBombChallenge) {
        iconEmoji = '💣';
        iconColor = '#FF0000'; // Red for bomb
    } else {
        switch (controlPoint.type) {
            case 'site':
                iconColor = '#FF9800';
                iconEmoji = '🏠';
                break;
            case 'control_point':
            default:
                iconColor = '#2196F3';
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
        console.log('Position challenge circle added with radius:', controlPoint.minDistance, 'meters');
    }

    // Create popup with edit options
    console.log('Creating edit menu for control point...');
    const popupContent = createControlPointEditMenu(controlPoint, marker);
    console.log('Edit menu created successfully');
    
    marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });

    // Add popup open/close handlers
    marker.on('popupopen', function() {
        console.log('Control point popup opened');
        // Remove map click handler to prevent conflicts while editing
        if (map && mapClickHandler) {
            map.off('click', mapClickHandler);
        }
    });

    marker.on('popupclose', function() {
        console.log('Control point popup closed');
        
        // Re-enable map click handler after popup is closed
        setTimeout(() => {
            if (map && mapClickHandler) {
                map.on('click', mapClickHandler);
            }
        }, 100);
    });

    // Store control point data on marker for reference
    marker.controlPointData = controlPoint;

    console.log('Owner marker created successfully:', marker);
    return marker;
}

// Create control point edit menu
function createControlPointEditMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.className = 'control-point-edit-menu';
    
    console.log('Creating edit menu with control point data:', {
        id: controlPoint.id,
        minDistance: controlPoint.minDistance,
        minAccuracy: controlPoint.minAccuracy,
        challengeType: controlPoint.challengeType,
        code: controlPoint.code,
        armedCode: controlPoint.armedCode,
        disarmedCode: controlPoint.disarmedCode
    });
    
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
    
    menu.innerHTML = `
        <div class="control-point-edit-content">
            <h4 class="edit-title">Editar Punto</h4>
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
    
    console.log('Menu HTML created for control point:', controlPoint.id);
    console.log('Position challenge checked:', positionChallengeChecked);
    console.log('Code challenge checked:', codeChallengeChecked);
    
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
    
    console.log('Updating control point:', {
        controlPointId,
        type,
        name,
        positionChallenge,
        codeChallenge,
        bombChallenge
    });
    
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
    
    console.log('Position challenge values:', { minDistance, minAccuracy });
    
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
    
    console.log('Bomb challenge values:', { bombTime, armedCode, disarmedCode });
    
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
    
    console.log('Toggle position inputs:', {
        controlPointId,
        checked: checkbox ? checkbox.checked : 'no checkbox',
        inputsDiv: !!inputsDiv
    });
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle code inputs visibility
function toggleCodeInputs(controlPointId) {
    const checkbox = document.getElementById(`codeChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`codeInputs_${controlPointId}`);
    
    console.log('Toggle code inputs:', {
        controlPointId,
        checked: checkbox ? checkbox.checked : 'no checkbox',
        inputsDiv: !!inputsDiv
    });
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle bomb inputs visibility
function toggleBombInputs(controlPointId) {
    const checkbox = document.getElementById(`bombChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`bombInputs_${controlPointId}`);
    
    console.log('Toggle bomb inputs:', {
        controlPointId,
        checked: checkbox ? checkbox.checked : 'no checkbox',
        inputsDiv: !!inputsDiv
    });
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Update all control point popups when game state changes (for owners)
function updateOwnerControlPointPopups() {
    if (!map) return;
    
    console.log('Updating owner control point popups, current game state:', {
        hasCurrentGame: !!currentGame,
        gameStatus: currentGame ? currentGame.status : 'undefined'
    });
    
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
    
    console.log('Owner control point popups updated');
}

// Refresh control point markers - remove and recreate with updated settings (for owners)
function refreshOwnerControlPointMarkers(controlPoints) {
    if (!map) return;
    
    console.log('REFRESH OWNER: Starting refresh with control points:', controlPoints);
    console.log('REFRESH OWNER: Number of control points:', controlPoints ? controlPoints.length : 0);
    
    // Remove all existing control point markers and circles
    let removedCount = 0;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            // Remove position circle if exists
            if (layer.positionCircle) {
                map.removeLayer(layer.positionCircle);
                console.log('REFRESH OWNER: Removed position circle for control point:', layer.controlPointData.id);
            }
            map.removeLayer(layer);
            removedCount++;
        }
    });
    
    console.log('REFRESH OWNER: Removed', removedCount, 'existing markers');
    
    // Recreate all control point markers with updated settings
    if (controlPoints && Array.isArray(controlPoints)) {
        console.log('REFRESH OWNER: Creating', controlPoints.length, 'new markers');
        controlPoints.forEach((controlPoint, index) => {
            console.log('REFRESH OWNER: Creating marker', index + 1, 'for control point:', controlPoint.id, controlPoint.name);
            console.log('REFRESH OWNER: Control point data:', {
                hasPositionChallenge: controlPoint.hasPositionChallenge,
                minDistance: controlPoint.minDistance,
                hasBombChallenge: controlPoint.hasBombChallenge,
                type: controlPoint.type
            });
            addControlPointMarkerOwner(controlPoint);
        });
    } else {
        console.log('REFRESH OWNER: No control points to create');
    }
    
    console.log('REFRESH OWNER: Owner control point markers refreshed successfully');
}

// Enable drag mode for moving control points
function enableDragMode(controlPointId, markerId) {
    console.log(`Enabling drag mode for control point ${controlPointId}, marker ${markerId}`);
    
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
    console.log('Marker dragging enabled');
    
    // Change cursor to indicate drag mode
    targetMarker.getElement().style.cursor = 'move';
    
    // Add dragend event listener to update position when dragging stops
    targetMarker.on('dragend', function(event) {
        const marker = event.target;
        const newPosition = marker.getLatLng();
        console.log(`Marker dragged to new position: ${newPosition.lat}, ${newPosition.lng}`);
        
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
        console.log('Drag mode disabled after placement');
    });
    
    // Show instruction message
    showSuccess('Arrastra el punto a la nueva ubicación y haz clic para colocarlo');
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