// Owner-specific functionality

// Initialize owner features
function initializeOwnerFeatures() {
    
    // Initialize owner control points functionality
    if (window.initializeOwnerControlPoints) {
        window.initializeOwnerControlPoints();
    } else {
        console.error('initializeOwnerControlPoints function not found!');
    }
    
    // Request active bomb timers when game is running
    if (currentGame && currentGame.status === 'running') {
        setTimeout(() => {
            if (window.requestActiveBombTimers) {
                window.requestActiveBombTimers();
            }
        }, 1000);
    }
}

// Close teams dialog
function closeTeamsDialog() {
    const teamsDialog = document.getElementById('teamsDialog');
    if (teamsDialog) {
        teamsDialog.style.display = 'none';
    }
}

// Make functions available globally
window.initializeOwnerFeatures = initializeOwnerFeatures;
window.closeTeamsDialog = closeTeamsDialog;