// Control point menu management for owners

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

// Make functions available globally
window.initializeOwnerControlPoints = initializeOwnerControlPoints;
window.showControlPointMenu = showControlPointMenu;
window.closeControlPointMenu = closeControlPointMenu;
window.closeControlPointMenuOutside = closeControlPointMenuOutside;
window.createControlPoint = createControlPoint;
window.hasSiteControlPoint = hasSiteControlPoint;