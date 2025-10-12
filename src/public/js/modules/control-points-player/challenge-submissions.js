// Challenge submissions and WebSocket communication for players
import { showToast, getCurrentGame, getSocket } from '../game-core/index.js';

// Get references to global variables
const currentGame = getCurrentGame();
const socket = getSocket();

// Request fresh control point data when popup opens
export function requestPlayerControlPointData(controlPointId, marker) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'request_control_point_data',
            controlPointId: controlPointId
        }));
    } else {
        console.log('WebSocket not connected, cannot request control point data');
    }
}

// Handle position challenge submission (automatic)
export function handlePositionChallengeSubmission(controlPointId, playerPosition) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('WebSocket not connected, cannot submit position challenge');
        return;
    }

    // Send position challenge submission
    socket.send(JSON.stringify({
        type: 'submit_position_challenge',
        controlPointId: controlPointId,
        latitude: playerPosition.lat,
        longitude: playerPosition.lng
    }));
}

// Handle code challenge submission
export function submitCodeChallenge(controlPointId, code) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        showToast('Error de conexión', 'error');
        return false;
    }

    if (!code || code.trim() === '') {
        showToast('Por favor ingresa un código', 'error');
        return false;
    }

    socket.send(JSON.stringify({
        type: 'submit_code_challenge',
        controlPointId: controlPointId,
        code: code.trim()
    }));

    showToast('Código enviado', 'success');
    return true;
}

// Handle bomb challenge submission (activate bomb)
export function submitBombChallenge(controlPointId, armedCode) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        showToast('Error de conexión', 'error');
        return false;
    }

    if (!armedCode || armedCode.trim() === '') {
        showToast('Por favor ingresa el código armado', 'error');
        return false;
    }

    socket.send(JSON.stringify({
        type: 'submit_bomb_challenge',
        controlPointId: controlPointId,
        armedCode: armedCode.trim()
    }));

    showToast('Bomba activada', 'success');
    return true;
}

// Handle bomb deactivation submission
export function submitBombDeactivation(controlPointId, disarmedCode) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        showToast('Error de conexión', 'error');
        return false;
    }

    if (!disarmedCode || disarmedCode.trim() === '') {
        showToast('Por favor ingresa el código de desactivación', 'error');
        return false;
    }

    socket.send(JSON.stringify({
        type: 'submit_bomb_deactivation',
        controlPointId: controlPointId,
        disarmedCode: disarmedCode.trim()
    }));

    showToast('Bomba desactivada', 'success');
    return true;
}

// Handle WebSocket responses for challenge submissions
export function handleChallengeResponse(response) {
    if (response.success) {
        showToast(response.message || 'Acción completada exitosamente', 'success');
        
        // Handle specific success cases
        switch (response.type) {
            case 'code_challenge_success':
                // Code challenge was successful
                break;
            case 'bomb_challenge_success':
                // Bomb challenge was successful
                break;
            case 'bomb_deactivation_success':
                // Bomb deactivation was successful
                break;
            case 'position_challenge_success':
                // Position challenge was successful
                break;
        }
    } else {
        showToast(response.message || 'Error en la acción', 'error');
        
        // Handle specific error cases
        switch (response.type) {
            case 'code_challenge_error':
                // Code challenge failed
                break;
            case 'bomb_challenge_error':
                // Bomb challenge failed
                break;
            case 'bomb_deactivation_error':
                // Bomb deactivation failed
                break;
            case 'position_challenge_error':
                // Position challenge failed
                break;
        }
    }
}

// Check if player can submit challenges for a control point
export function canSubmitChallenges(controlPoint) {
    if (!currentGame || currentGame.status !== 'running') {
        return false;
    }

    // Players can always submit challenges regardless of ownership
    // The server will handle the logic for which challenges are allowed
    return true;
}

// Get challenge status for a control point
export function getChallengeStatus(controlPoint) {
    const status = {
        canSubmitCode: false,
        canSubmitBomb: false,
        canSubmitPosition: false,
        bombActive: false
    };

    if (!currentGame || currentGame.status !== 'running') {
        return status;
    }

    // Code challenge - can submit if control point has code challenge
    status.canSubmitCode = controlPoint.hasCodeChallenge;

    // Bomb challenge - can submit if control point has bomb challenge
    status.canSubmitBomb = controlPoint.hasBombChallenge;

    // Position challenge - can submit if control point has position challenge
    status.canSubmitPosition = controlPoint.hasPositionChallenge;

    // Check if bomb is active
    if (controlPoint.bombTimer && controlPoint.bombTimer.isActive) {
        status.bombActive = true;
    }

    return status;
}

// Validate challenge inputs
export function validateChallengeInput(input, challengeType) {
    if (!input || input.trim() === '') {
        return {
            valid: false,
            message: 'Por favor ingresa un valor'
        };
    }

    // Basic validation - can be extended for specific challenge types
    const trimmedInput = input.trim();
    
    switch (challengeType) {
        case 'code':
            // Code validation - at least 1 character
            if (trimmedInput.length < 1) {
                return {
                    valid: false,
                    message: 'El código debe tener al menos 1 carácter'
                };
            }
            break;
            
        case 'bomb_armed':
        case 'bomb_disarmed':
            // Bomb code validation - at least 1 character
            if (trimmedInput.length < 1) {
                return {
                    valid: false,
                    message: 'El código de bomba debe tener al menos 1 carácter'
                };
            }
            break;
            
        default:
            // Default validation
            break;
    }

    return {
        valid: true,
        message: 'Entrada válida'
    };
}

// Clear challenge inputs for a control point
export function clearChallengeInputs(controlPointId) {
    // Clear code input
    const codeInput = document.getElementById(`codeInput_${controlPointId}`);
    if (codeInput) {
        codeInput.value = '';
    }

    // Clear bomb armed input
    const armedInput = document.getElementById(`armedCodeInput_${controlPointId}`);
    if (armedInput) {
        armedInput.value = '';
    }

    // Clear bomb disarmed input
    const disarmedInput = document.getElementById(`disarmedCodeInput_${controlPointId}`);
    if (disarmedInput) {
        disarmedInput.value = '';
    }
}

// Update challenge UI based on current state
export function updateChallengeUI(controlPointId, challengeStatus) {
    // This function can be used to dynamically update the UI
    // based on the current challenge status
    
    // For example, disable/enable buttons, show/hide inputs, etc.
    // This is a placeholder for future UI updates
}

// Global functions for HTML event handlers
window.submitCodeChallenge = function(controlPointId) {
    const codeInput = document.getElementById(`codeInput_${controlPointId}`);
    if (!codeInput) return;
    
    const code = codeInput.value.trim();
    submitCodeChallenge(controlPointId, code);
    
    // Clear input after submission
    codeInput.value = '';
};

window.submitBombChallenge = function(controlPointId) {
    const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`);
    if (!armedCodeInput) return;
    
    const armedCode = armedCodeInput.value.trim();
    submitBombChallenge(controlPointId, armedCode);
    
    // Clear input after submission
    armedCodeInput.value = '';
};

window.submitBombDeactivation = function(controlPointId) {
    const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`);
    if (!disarmedCodeInput) return;
    
    const disarmedCode = disarmedCodeInput.value.trim();
    submitBombDeactivation(controlPointId, disarmedCode);
    
    // Clear input after submission
    disarmedCodeInput.value = '';
};

// Get control point by ID
export function getControlPointById(controlPointId) {
    let controlPoint = null;
    
    // Search through all control points in current game
    if (currentGame && currentGame.controlPoints) {
        controlPoint = currentGame.controlPoints.find(cp => cp.id === controlPointId);
    }
    
    // If not found in current game, check if it's in the global controlPoints array
    if (!controlPoint && window.controlPoints) {
        controlPoint = window.controlPoints.find(cp => cp.id === controlPointId);
    }
    
    return controlPoint;
}