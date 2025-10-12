// Control point menu management for owners
import { controlPointMenuVisible, mapClickHandler, setMapClickHandler } from './state.js';
import { createControlPoint } from './control-point-operations.js';
import { hasSiteControlPoint } from './markers-popups.js';
import { getMap } from '../game-core/index.js';

// Initialize owner control points features
export function initializeOwnerControlPoints() {
    
    // Get map reference (lazy loading)
    const map = getMap();
    
    // Check if map is available
    if (!map) {
        console.warn('Map not available for owner control points initialization, retrying...');
        setTimeout(() => {
            const retryMap = getMap();
            if (retryMap) {
                console.log('Map obtained on retry, initializing owner control points');
                initializeOwnerControlPoints();
            } else {
                console.error('Map still not available after retry');
            }
        }, 1000);
        return;
    }
    
    // Remove any existing click handler first
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
    }
    
    // Create new click handler for owners to create control points
    const newMapClickHandler = function(e) {
        // Only show menu if no menu is currently visible
        if (!controlPointMenuVisible) {
            showControlPointMenu(e.latlng);
        }
    };
    
    // Update the state variable using setter
    setMapClickHandler(newMapClickHandler);
    
    // Remove any existing handler first to avoid duplicates
    map.off('click', mapClickHandler);
    map.on('click', mapClickHandler);
    
    console.log('Owner control points initialized successfully');
    
}

// Show control point creation menu
export function showControlPointMenu(latlng) {
    // Get map reference
    const map = getMap();
    if (!map) {
        console.error('Map not available for showing control point menu');
        return;
    }
    
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
export function closeControlPointMenuOutside(e) {
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
export function closeControlPointMenu() {
    // Get map reference
    const map = getMap();
    
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
    if (map) {
        map.closePopup();
    }
    
    // Re-enable map click handler after a short delay to prevent immediate reopening
    setTimeout(() => {
        if (map && mapClickHandler) {
            // Remove any existing handler first to avoid duplicates
            map.off('click', mapClickHandler);
            map.on('click', mapClickHandler);
        }
    }, 200); // Increased delay to ensure menu is fully closed
}

// Export functions to global scope for backward compatibility
export function setupGlobalFunctions() {
    window.initializeOwnerControlPoints = initializeOwnerControlPoints;
    window.showControlPointMenu = showControlPointMenu;
    window.closeControlPointMenu = closeControlPointMenu;
    window.closeControlPointMenuOutside = closeControlPointMenuOutside;
    window.createControlPoint = createControlPoint;
    window.hasSiteControlPoint = hasSiteControlPoint;
}