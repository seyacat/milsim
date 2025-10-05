// Owner-specific functionality

// Initialize owner features
function initializeOwnerFeatures() {
    console.log('Initializing owner features');
    
    // Initialize owner control points functionality
    if (window.initializeOwnerControlPoints) {
        console.log('Found initializeOwnerControlPoints function, calling it...');
        window.initializeOwnerControlPoints();
    } else {
        console.error('initializeOwnerControlPoints function not found!');
        console.log('Available window functions:', Object.keys(window).filter(key => typeof window[key] === 'function' && key.includes('ControlPoint')));
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