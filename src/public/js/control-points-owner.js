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
            <h3 style="margin: 0 0 10px 0; color: #333;">Crear Punto de Control</h3>
            <div style="display: flex; gap: 5px; justify-content: flex-end;">
                <button onclick="window.createControlPoint(${latlng.lat}, ${latlng.lng})" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Crear</button>
                <button onclick="window.closeControlPointMenu()" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Cancelar</button>
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
    // Check if this is the first control point (no control points exist yet)
    let isFirstControlPoint = true;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            isFirstControlPoint = false;
        }
    });
    
    // Determine default type: first point is Site, others are Control Point
    const defaultType = isFirstControlPoint ? 'site' : 'control_point';
    
    // Generate a default name based on coordinates
    const name = `Punto ${Math.round(lat * 10000)}-${Math.round(lng * 10000)}`;
    
    // Send create control point via WebSocket
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'createControlPoint',
            data: {
                name,
                description: '',
                latitude: lat,
                longitude: lng,
                gameId: currentGame.id,
                type: defaultType
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
    
    // Create icon based on type
    let iconColor = '#2196F3'; // Default for control_point
    let iconEmoji = '🚩'; // Default for control_point
    
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
    menu.style.cssText = `
        min-width: 350px;
        padding: 10px;
    `;
    
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
    
    // Distance options (in meters)
    const distanceOptions = `
        <option value="5" ${controlPoint.minDistance === 5 ? 'selected' : ''}>5m (Muy cercano)</option>
        <option value="10" ${controlPoint.minDistance === 10 ? 'selected' : ''}>10m (Cercano)</option>
        <option value="25" ${controlPoint.minDistance === 25 ? 'selected' : ''}>25m (Medio)</option>
        <option value="50" ${controlPoint.minDistance === 50 ? 'selected' : ''}>50m (Lejano)</option>
        <option value="100" ${controlPoint.minDistance === 100 ? 'selected' : ''}>100m (Muy lejano)</option>
    `;
    
    // Accuracy options (in meters)
    const accuracyOptions = `
        <option value="5" ${controlPoint.minAccuracy === 5 ? 'selected' : ''}>5m (Alta precisión)</option>
        <option value="10" ${controlPoint.minAccuracy === 10 ? 'selected' : ''}>10m (Buena precisión)</option>
        <option value="20" ${controlPoint.minAccuracy === 20 ? 'selected' : ''}>20m (Precisión media)</option>
        <option value="50" ${controlPoint.minAccuracy === 50 ? 'selected' : ''}>50m (Baja precisión)</option>
        <option value="100" ${controlPoint.minAccuracy === 100 ? 'selected' : ''}>100m (Muy baja precisión)</option>
    `;
    
    // Position challenge section
    const positionChallengeChecked = controlPoint.challengeType === 'position' || controlPoint.minDistance || controlPoint.minAccuracy;
    const positionInputs = `
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Distancia Mínima:</label>
            <select id="controlPointMinDistance_${controlPoint.id}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px;">
                <option value="">Sin restricción</option>
                ${distanceOptions}
            </select>
        </div>
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Accuracy Mínimo:</label>
            <select id="controlPointMinAccuracy_${controlPoint.id}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px;">
                <option value="">Sin restricción</option>
                ${accuracyOptions}
            </select>
        </div>
    `;
    
    // Code challenge section
    const codeChallengeChecked = controlPoint.challengeType === 'code' || controlPoint.code || controlPoint.armedCode || controlPoint.disarmedCode;
    const codeInputs = `
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Code:</label>
            <input type="text" id="controlPointCode_${controlPoint.id}" value="${controlPoint.code || ''}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px;" placeholder="Código para tomar">
        </div>
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Armed Code:</label>
            <input type="text" id="controlPointArmedCode_${controlPoint.id}" value="${controlPoint.armedCode || ''}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px;" placeholder="Código para armar">
        </div>
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Disarmed Code:</label>
            <input type="text" id="controlPointDisarmedCode_${controlPoint.id}" value="${controlPoint.disarmedCode || ''}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px;" placeholder="Código para desarmar">
        </div>
    `;
    
    menu.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #333;">Editar Punto</h4>
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tipo:</label>
            <select id="controlPointType_${controlPoint.id}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px;">
                ${typeOptions}
            </select>
        </div>
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre:</label>
            <input type="text" id="controlPointEditName_${controlPoint.id}" value="${controlPoint.name}" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 3px;">
        </div>
        
        <div style="margin-bottom: 15px; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
            <h5 style="margin: 0 0 10px 0; color: #555;">Challenges</h5>
            
            <!-- Position Challenge -->
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; margin-bottom: 5px;">
                    <input type="checkbox" id="positionChallenge_${controlPoint.id}" ${positionChallengeChecked ? 'checked' : ''} style="margin-right: 8px;">
                    <span style="font-weight: bold;">Position Challenge</span>
                </label>
                <div id="positionInputs_${controlPoint.id}" style="margin-left: 20px; ${positionChallengeChecked ? '' : 'display: none;'}">
                    ${positionInputs}
                </div>
            </div>
            
            <!-- Code Challenge -->
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center; margin-bottom: 5px;">
                    <input type="checkbox" id="codeChallenge_${controlPoint.id}" ${codeChallengeChecked ? 'checked' : ''} style="margin-right: 8px;">
                    <span style="font-weight: bold;">Code Challenge</span>
                </label>
                <div id="codeInputs_${controlPoint.id}" style="margin-left: 20px; ${codeChallengeChecked ? '' : 'display: none;'}">
                    ${codeInputs}
                </div>
            </div>
        </div>
        
        <div style="display: flex; gap: 5px; justify-content: flex-end;">
            <button onclick="window.updateControlPoint(${controlPoint.id}, ${marker._leaflet_id})" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Actualizar</button>
            <button onclick="window.deleteControlPoint(${controlPoint.id}, ${marker._leaflet_id})" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Eliminar</button>
        </div>
    `;
    
    console.log('Menu HTML created for control point:', controlPoint.id);
    console.log('Position challenge checked:', positionChallengeChecked);
    console.log('Code challenge checked:', codeChallengeChecked);
    
    // Add event listeners to show/hide inputs based on checkboxes
    setTimeout(() => {
        const positionCheckbox = document.getElementById(`positionChallenge_${controlPoint.id}`);
        const codeCheckbox = document.getElementById(`codeChallenge_${controlPoint.id}`);
        const codeInputsDiv = document.getElementById(`codeInputs_${controlPoint.id}`);
        const positionInputsDiv = document.getElementById(`positionInputs_${controlPoint.id}`);
        const typeSelect = document.getElementById(`controlPointType_${controlPoint.id}`);
        
        console.log('Setting up event listeners for control point:', {
            positionCheckbox: !!positionCheckbox,
            codeCheckbox: !!codeCheckbox,
            positionInputsDiv: !!positionInputsDiv,
            codeInputsDiv: !!codeInputsDiv
        });
        
        if (positionCheckbox && positionInputsDiv) {
            console.log('Adding position checkbox listener');
            positionCheckbox.addEventListener('change', function() {
                console.log('Position checkbox changed:', this.checked);
                positionInputsDiv.style.display = this.checked ? 'block' : 'none';
            });
        }
        
        if (codeCheckbox && codeInputsDiv) {
            console.log('Adding code checkbox listener');
            codeCheckbox.addEventListener('change', function() {
                console.log('Code checkbox changed:', this.checked);
                codeInputsDiv.style.display = this.checked ? 'block' : 'none';
            });
        }
        
        if (typeSelect) {
            typeSelect.addEventListener('change', function() {
                console.log('Type select changed');
                // Update inputs when type changes
                setTimeout(() => {
                    const positionCheckbox = document.getElementById(`positionChallenge_${controlPoint.id}`);
                    const codeCheckbox = document.getElementById(`codeChallenge_${controlPoint.id}`);
                    const codeInputsDiv = document.getElementById(`codeInputs_${controlPoint.id}`);
                    const positionInputsDiv = document.getElementById(`positionInputs_${controlPoint.id}`);
                    
                    if (positionCheckbox && positionInputsDiv) {
                        positionInputsDiv.style.display = positionCheckbox.checked ? 'block' : 'none';
                    }
                    if (codeCheckbox && codeInputsDiv) {
                        codeInputsDiv.style.display = codeCheckbox.checked ? 'block' : 'none';
                    }
                }, 100);
            });
        }
    }, 100);
    
    return menu;
}


// Update control point
function updateControlPoint(controlPointId, markerId) {
    const type = document.getElementById(`controlPointType_${controlPointId}`).value;
    const name = document.getElementById(`controlPointEditName_${controlPointId}`).value.trim();
    const positionChallenge = document.getElementById(`positionChallenge_${controlPointId}`).checked;
    const codeChallenge = document.getElementById(`codeChallenge_${controlPointId}`).checked;
    
    console.log('Updating control point:', {
        controlPointId,
        type,
        name,
        positionChallenge,
        codeChallenge
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
    
    // Prepare update data
    const updateData = {
        controlPointId,
        name,
        type,
        challengeType: null // We'll handle this differently now
    };
    
    // Handle position challenge
    if (positionChallenge) {
        const minDistanceSelect = document.getElementById(`controlPointMinDistance_${controlPointId}`);
        const minAccuracySelect = document.getElementById(`controlPointMinAccuracy_${controlPointId}`);
        
        const minDistance = minDistanceSelect ? minDistanceSelect.value : '';
        const minAccuracy = minAccuracySelect ? minAccuracySelect.value : '';
        
        console.log('Position challenge values:', { minDistance, minAccuracy });
        
        updateData.minDistance = minDistance ? parseInt(minDistance) : null;
        updateData.minAccuracy = minAccuracy ? parseInt(minAccuracy) : null;
    } else {
        // Clear position fields if position challenge is not checked
        updateData.minDistance = null;
        updateData.minAccuracy = null;
    }
    
    // Handle code challenge
    if (codeChallenge) {
        // Get all code fields
        const code = document.getElementById(`controlPointCode_${controlPointId}`).value.trim();
        const armedCode = document.getElementById(`controlPointArmedCode_${controlPointId}`).value.trim();
        const disarmedCode = document.getElementById(`controlPointDisarmedCode_${controlPointId}`).value.trim();
        
        // Validate that at least one code is provided
        if (!code && !armedCode && !disarmedCode) {
            showWarning('Para challenges de código, debes ingresar al menos un código');
            return;
        }
        
        updateData.code = code || null;
        updateData.armedCode = armedCode || null;
        updateData.disarmedCode = disarmedCode || null;
    } else {
        // Clear code fields if code challenge is not checked
        updateData.code = null;
        updateData.armedCode = null;
        updateData.disarmedCode = null;
    }
    
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