// Control points functionality for players

// Create control point interaction menu for players
function createControlPointPlayerMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.className = 'control-point-popup';
    
    const isSite = controlPoint.type === 'site';
    let pointType = 'Control Point';
    
    if (isSite) {
        pointType = 'Site';
    }
    
    // Debug: Log current game state for troubleshooting
    console.log('Creating control point menu:', {
        controlPointId: controlPoint.id,
        gameStatus: currentGame ? currentGame.status : 'no currentGame',
        isGameRunning: currentGame && currentGame.status === 'running'
    });
    
    // Only show "Take" button when game is running
    const isGameRunning = currentGame && currentGame.status === 'running';
    const takeButton = isGameRunning ? `
        <div class="action-buttons">
            <button class="take-button" onclick="takeControlPoint(${controlPoint.id})">Tomar</button>
        </div>
    ` : '';
    
    menu.innerHTML = `
        <h4>${pointType}</h4>
        <div class="point-name">${controlPoint.name}</div>
        ${takeButton}
    `;
    
    return menu;
}

// Add control point marker to map for players
function addControlPointMarkerPlayer(controlPoint) {
    console.log('Adding control point marker for player:', controlPoint);
    console.log('Current game state when adding marker:', {
        hasCurrentGame: !!currentGame,
        gameStatus: currentGame ? currentGame.status : 'undefined',
        gameId: currentGame ? currentGame.id : 'undefined'
    });
    
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

    // Create popup with "Tomar" option for players
    const popupContent = createControlPointPlayerMenu(controlPoint, marker);
    
    marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });

    // Store control point data on marker for reference
    marker.controlPointData = controlPoint;

    console.log('Player marker created successfully:', marker);
    return marker;
}

// Take control point action
function takeControlPoint(controlPointId) {
    console.log('Taking control point:', controlPointId);
    
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
                
                // If code challenge is also enabled, show code input
                if (controlPoint.code || controlPoint.armedCode || controlPoint.disarmedCode) {
                    showCodeInputDialog(controlPoint);
                } else {
                    // Only position challenge, send take action
                    sendTakeControlPointAction(controlPointId);
                }
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
    } else if (controlPoint.code || controlPoint.armedCode || controlPoint.disarmedCode) {
        // Only code challenge, show code input
        showCodeInputDialog(controlPoint);
    } else {
        // No challenges, send take action directly
        sendTakeControlPointAction(controlPointId);
    }
}

// Send take control point action via WebSocket
function sendTakeControlPointAction(controlPointId) {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'takeControlPoint',
            data: {
                controlPointId,
                userId: currentUser.id
            }
        });
        
        showSuccess('¡Punto tomado!');
    }
}

// Show code input dialog
function showCodeInputDialog(controlPoint) {
    const dialog = document.createElement('div');
    dialog.className = 'code-input-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        min-width: 300px;
    `;
    
    // Determine which codes to show
    const hasRegularCode = !!controlPoint.code;
    const hasArmedCode = !!controlPoint.armedCode;
    const hasDisarmedCode = !!controlPoint.disarmedCode;
    
    let codeInputs = '';
    
    if (hasRegularCode) {
        codeInputs = `
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código:</label>
                <input type="text" id="codeInput" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código">
            </div>
        `;
    } else if (hasArmedCode && hasDisarmedCode) {
        codeInputs = `
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Armado:</label>
                <input type="text" id="armedCodeInput" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código armado">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Desarmado:</label>
                <input type="text" id="disarmedCodeInput" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código desarmado">
            </div>
        `;
    }
    
    dialog.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: #333;">Ingresa el código</h4>
        ${codeInputs}
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="submitCode(${controlPoint.id})" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Enviar</button>
            <button onclick="closeCodeDialog()" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 999;
    `;
    overlay.onclick = closeCodeDialog;
    document.body.appendChild(overlay);
    
    // Store references for cleanup
    window.currentCodeDialog = dialog;
    window.currentCodeOverlay = overlay;
}

// Submit code and take control point
function submitCode(controlPointId) {
    const controlPoint = getControlPointById(controlPointId);
    if (!controlPoint) {
        showError('No se pudo encontrar el punto de control');
        closeCodeDialog();
        return;
    }
    
    let isValid = true;
    
    if (controlPoint.code) {
        const codeInput = document.getElementById('codeInput');
        if (!codeInput || codeInput.value.trim() !== controlPoint.code) {
            showError('Código incorrecto');
            isValid = false;
        }
    } else if (controlPoint.armedCode && controlPoint.disarmedCode) {
        const armedCodeInput = document.getElementById('armedCodeInput');
        const disarmedCodeInput = document.getElementById('disarmedCodeInput');
        
        if (!armedCodeInput || armedCodeInput.value.trim() !== controlPoint.armedCode) {
            showError('Código armado incorrecto');
            isValid = false;
        } else if (!disarmedCodeInput || disarmedCodeInput.value.trim() !== controlPoint.disarmedCode) {
            showError('Código desarmado incorrecto');
            isValid = false;
        }
    }
    
    if (isValid) {
        sendTakeControlPointAction(controlPointId);
        closeCodeDialog();
    }
}

// Close code input dialog
function closeCodeDialog() {
    if (window.currentCodeDialog) {
        window.currentCodeDialog.remove();
        window.currentCodeDialog = null;
    }
    if (window.currentCodeOverlay) {
        window.currentCodeOverlay.remove();
        window.currentCodeOverlay = null;
    }
}

// Get control point by ID
function getControlPointById(controlPointId) {
    let controlPoint = null;
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === controlPointId) {
            controlPoint = layer.controlPointData;
        }
    });
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
    
    console.log('Updating control point popups, current game state:', {
        hasCurrentGame: !!currentGame,
        gameStatus: currentGame ? currentGame.status : 'undefined'
    });
    
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
    
    console.log('Control point popups updated');
}

// Make functions available globally
window.addPlayerControlPointMarker = addControlPointMarkerPlayer;
window.takeControlPoint = takeControlPoint;
window.createPlayerControlPointMenu = createControlPointPlayerMenu;
window.updatePlayerControlPointPopups = updateControlPointPopups;
window.submitCode = submitCode;
window.closeCodeDialog = closeCodeDialog;
window.calculateDistance = calculateDistance;
window.getControlPointById = getControlPointById;
window.sendTakeControlPointAction = sendTakeControlPointAction;
window.showCodeInputDialog = showCodeInputDialog;