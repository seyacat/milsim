// Map initialization and management
import { setMap, userMarker, map as stateMap } from './state.js';

// Initialize Leaflet map
export function initMap() {
    const map = L.map('map', {
        zoomControl: true,
        maxZoom: 22,
        minZoom: 1
    }).setView([0, 0], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 22,
        minZoom: 1
    }).addTo(map);

    // Add scale control
    L.control.scale().addTo(map);

    setMap(map);
    return map;
}

// Map control functions
export function centerOnUser() {
    if (userMarker && stateMap) {
        const userPosition = userMarker.getLatLng();
        stateMap.setView(userPosition, 16);
    }
}

export function centerOnSite() {
    if (!stateMap) return;

    stateMap.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.type === 'site') {
            const sitePosition = layer.getLatLng();
            stateMap.setView(sitePosition, 16);
        }
    });
}

// Make functions available globally for backward compatibility
export function setupGlobalMapFunctions() {
    window.centerOnUser = centerOnUser;
    window.centerOnSite = centerOnSite;
}