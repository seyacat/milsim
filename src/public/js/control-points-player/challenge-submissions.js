// Challenge submission functions for players

// Submit bomb deactivation
function submitBombDeactivation(controlPointId) {
    const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`);
    const disarmedCode = disarmedCodeInput ? disarmedCodeInput.value.trim() : '';
    
    if (!disarmedCode) {
        showToast('Por favor ingresa el código de desactivación', 'error');
        return;
    }
    
    // Send bomb deactivation request to server
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'deactivateBomb',
            data: {
                controlPointId: controlPointId,
                disarmedCode: disarmedCode,
                userId: currentUser.id
            }
        });
        
        // Clear input
        if (disarmedCodeInput) {
            disarmedCodeInput.value = '';
        }
        
        showToast('Enviando código de desactivación...', 'info');
    } else {
        showToast('Error de conexión', 'error');
    }
}

// Take control point action
function takeControlPoint(controlPointId) {
    
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
    
    // Also try to get the latest control point data from currentGame
    if (currentGame && currentGame.controlPoints) {
        const latestControlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
        if (latestControlPoint) {
            controlPoint = latestControlPoint;
        }
    }
    
    // Debug: Check what data we're working with
    
    // Allow taking control points even if already owned by player's team
    // This allows players to submit codes regardless of ownership
    
    // Get code from input if code challenge is active
    let code = '';
    if (controlPoint.hasCodeChallenge) {
        const codeInput = document.getElementById(`codeInput_${controlPointId}`);
        if (codeInput) {
            code = codeInput.value.trim();
        }
        
        // Validate that code was entered
        if (!code) {
            showError('Debes ingresar el código para tomar este punto');
            return;
        }
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
                
                // Position challenge passed, send take action with code
                sendTakeControlPointAction(controlPointId, code);
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
    } else {
        // No position challenge, send take action directly with code
        sendTakeControlPointAction(controlPointId, code);
    }
}

// Send take control point action via WebSocket
function sendTakeControlPointAction(controlPointId, code) {
    if (socket && currentGame) {
        const actionData = {
            controlPointId,
            userId: currentUser.id
        };
        
        // Include code if provided
        if (code) {
            actionData.code = code;
        }
        
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'takeControlPoint',
            data: actionData
        });
        
        // Success toast will be shown by the backend response
        // Don't show immediate success toast here to avoid double toasts
    }
}

// Submit code challenge
function submitCodeChallenge(controlPointId) {
    
    // Check if game is running before allowing action
    if (!currentGame || currentGame.status !== 'running') {
        showError('No puedes tomar puntos de control cuando el juego no está en ejecución');
        return;
    }
    
    // Get code from input
    const codeInput = document.getElementById(`codeInput_${controlPointId}`);
    if (!codeInput) {
        showError('No se pudo encontrar el campo de código');
        return;
    }
    
    const code = codeInput.value.trim();
    if (!code) {
        showError('Debes ingresar el código');
        return;
    }
    
    sendTakeControlPointAction(controlPointId, code);
}

// Submit position challenge
function submitPositionChallenge(controlPointId) {
    
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
    
    // Check if position challenge is enabled
    if (!controlPoint.minDistance && !controlPoint.minAccuracy) {
        showError('Este punto no tiene desafío de posición activo');
        return;
    }
    
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
            
            // Position challenge passed, send take action
            sendTakeControlPointAction(controlPointId);
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
}

// Submit bomb challenge
function submitBombChallenge(controlPointId) {
    
    // Check if game is running before allowing action
    if (!currentGame || currentGame.status !== 'running') {
        showError('No puedes activar bombas cuando el juego no está en ejecución');
        return;
    }
    
    // Get armed code from input
    const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`);
    
    if (!armedCodeInput) {
        showError('No se pudo encontrar el campo de código armado');
        return;
    }
    
    const armedCode = armedCodeInput.value.trim();
    
    if (!armedCode) {
        showError('Debes ingresar el código armado para activar la bomba');
        return;
    }
    
    // Send bomb activation action via WebSocket
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'activateBomb',
            data: {
                controlPointId: controlPointId,
                armedCode: armedCode,
                userId: currentUser.id
            }
        });
    }
    
    // Clear the input field after submission
    armedCodeInput.value = '';
    
    // Don't show immediate feedback - wait for backend response to avoid double toast
}

// Get control point by ID
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
    
    if (!controlPoint) {
        console.log('Control point not found in map layers or currentGame:', controlPointId);
    }
    
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

// Export functions
window.takeControlPoint = takeControlPoint;
window.calculateDistance = calculateDistance;
window.getControlPointById = getControlPointById;
window.sendTakeControlPointAction = sendTakeControlPointAction;
window.submitCodeChallenge = submitCodeChallenge;
window.submitPositionChallenge = submitPositionChallenge;
window.submitBombChallenge = submitBombChallenge;
window.submitBombDeactivation = submitBombDeactivation;