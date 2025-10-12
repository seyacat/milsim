// Control point markers and popups management for owners

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
        
        // Create empty pie chart SVG that will be updated when team points arrive
        createOwnerPositionChallengePieChart(marker, controlPoint, circle);
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
    
    
    // Close all open control point popups before removing markers
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.isPopupOpen()) {
            layer.closePopup();
        }
    });
    
    // Remove all existing control point markers and circles
    let removedCount = 0;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            // Remove position circle if exists
            if (layer.positionCircle) {
                map.removeLayer(layer.positionCircle);
            }
            // Remove pie chart SVG overlay if exists
            if (layer.pieSvg) {
                map.removeLayer(layer.pieSvg);
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
window.addOwnerControlPointMarker = addControlPointMarkerOwner;
window.updateOwnerControlPointPopups = updateOwnerControlPointPopups;
window.refreshOwnerControlPointMarkers = refreshOwnerControlPointMarkers;
window.updateSingleOwnerMarker = updateSingleOwnerMarker;