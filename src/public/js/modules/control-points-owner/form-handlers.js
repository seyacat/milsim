// Form input handlers for control point edit menu

// Toggle position inputs visibility
export function togglePositionInputs(controlPointId) {
    const checkbox = document.getElementById(`positionChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`positionInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle code inputs visibility
export function toggleCodeInputs(controlPointId) {
    const checkbox = document.getElementById(`codeChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`codeInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle bomb inputs visibility
export function toggleBombInputs(controlPointId) {
    const checkbox = document.getElementById(`bombChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`bombInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Export functions to global scope for backward compatibility
export function setupGlobalFunctions() {
    window.togglePositionInputs = togglePositionInputs;
    window.toggleCodeInputs = toggleCodeInputs;
    window.toggleBombInputs = toggleBombInputs;
}