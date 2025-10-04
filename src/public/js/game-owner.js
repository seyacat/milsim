// Owner-specific functionality
let controlPointMenuVisible = false;
let mapClickHandler = null;

// Initialize owner features
function initializeOwnerFeatures() {
    console.log('Initializing owner features');
    
    // Remove any existing click handler first
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
    }
    
    // Add click handler for owners to create control points
    mapClickHandler = function(e) {
        console.log('Owner clicked on map');
        showControlPointMenu(e.latlng);
    };
    
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
            <h3 style="margin: 0 0 10px 0; color: #333;">Crear Punto de Control</h3>
            <div style="display: flex; gap: 5px; justify-content: flex-end;">
                <button onclick="createControlPoint(${latlng.lat}, ${latlng.lng})" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Crear</button>
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
    // Close any open popups
    map.closePopup();
    
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
    
    // Re-enable map click handler after a short delay to prevent immediate reopening
    setTimeout(() => {
        if (map && mapClickHandler) {
            map.on('click', mapClickHandler);
        }
    }, 100);
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

// Add control point marker to map
function addControlPointMarker(controlPoint) {
    console.log('Adding control point marker:', controlPoint);
    
    // Create icon based on type
    const isSite = controlPoint.type === 'site';
    const iconColor = isSite ? '#FF9800' : '#2196F3';
    const iconEmoji = isSite ? '🏠' : '🚩';
    
    const controlPointIcon = L.divIcon({
        className: 'control-point-marker',
        html: `
            <div style="
                background: ${iconColor};
                border: 2px solid white;
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
    const popupContent = createControlPointEditMenu(controlPoint, marker);
    
    marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });

    // Add click outside listener for popup
    marker.on('popupopen', function() {
        setTimeout(() => {
            document.addEventListener('click', closeControlPointEditPopup);
        }, 100);
    });

    marker.on('popupclose', function() {
        document.removeEventListener('click', closeControlPointEditPopup);
    });

    // Store control point data on marker for reference
    marker.controlPointData = controlPoint;

    console.log('Marker created successfully:', marker);
    return marker;
}

// Create control point edit menu
function createControlPointEditMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.style.cssText = `
        min-width: 200px;
        padding: 10px;
    `;
    
    // Check if there's already a Site in the game (excluding current point)
    const hasOtherSite = hasSiteControlPoint() && controlPoint.type !== 'site';
    
    let typeOptions = '';
    if (hasOtherSite && controlPoint.type !== 'site') {
        // If there's already a Site and this is not it, only show Control Point
        typeOptions = `
            <option value="control_point" selected>Control Point</option>
        `;
    } else {
        // Show both options
        typeOptions = `
            <option value="site" ${controlPoint.type === 'site' ? 'selected' : ''}>Site</option>
            <option value="control_point" ${!controlPoint.type || controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
        `;
    }
    
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
        <div style="display: flex; gap: 5px; justify-content: flex-end;">
            <button onclick="updateControlPoint(${controlPoint.id}, ${marker._leaflet_id})" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Actualizar</button>
            <button onclick="deleteControlPoint(${controlPoint.id}, ${marker._leaflet_id})" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Eliminar</button>
        </div>
    `;
    
    return menu;
}

// Close control point edit popup when clicking outside
function closeControlPointEditPopup(e) {
    const popup = document.querySelector('.leaflet-popup');
    if (popup && !popup.contains(e.target) && !e.target.closest('.leaflet-popup')) {
        // Close all open popups
        map.closePopup();
    }
}

// Update control point
function updateControlPoint(controlPointId, markerId) {
    const type = document.getElementById(`controlPointType_${controlPointId}`).value;
    const name = document.getElementById(`controlPointEditName_${controlPointId}`).value.trim();
    
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
    
    // Send update via WebSocket
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'updateControlPoint',
            data: {
                controlPointId,
                name,
                type
            }
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

// Make functions available globally
window.initializeOwnerFeatures = initializeOwnerFeatures;
window.showControlPointMenu = showControlPointMenu;
window.closeControlPointMenu = closeControlPointMenu;
window.closeControlPointMenuOutside = closeControlPointMenuOutside;
window.createControlPoint = createControlPoint;
window.addControlPointMarker = addControlPointMarker;
window.updateControlPoint = updateControlPoint;
window.deleteControlPoint = deleteControlPoint;
window.closeControlPointEditPopup = closeControlPointEditPopup;