// Owner-specific functionality

// Initialize owner features
function initializeOwnerFeatures() {
    
    // Initialize owner control points functionality
    if (window.initializeOwnerControlPoints) {
        window.initializeOwnerControlPoints();
    } else {
        console.error('initializeOwnerControlPoints function not found!');
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