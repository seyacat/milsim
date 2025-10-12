// Main game-core module - exports all functionality and maintains backward compatibility
import * as constants from './constants.js';
import * as state from './state.js';
import * as toast from './toast.js';
import * as map from './map.js';
import * as auth from './auth.js';

// Export all modules for ES6 usage
export { constants, state, toast, map, auth };

// Export individual functions for convenience
export { showToast, showSuccess, showError, showWarning, showInfo } from './toast.js';
export { initMap, centerOnUser, centerOnSite } from './map.js';
export { checkAuth, loadGame } from './auth.js';

// Getter functions for state
export function getCurrentGame() {
    return state.currentGame;
}

export function getCurrentUser() {
    return state.currentUser;
}

export function getMap() {
    return state.map;
}

export function getSocket() {
    return state.socket;
}

// Initialize the game core system
export function initialize() {
    map.initMap();
    auth.checkAuth();
}

// Setup global functions for backward compatibility
export function setupGlobalFunctions() {
    // Toast functions
    window.showToast = toast.showToast;
    window.showSuccess = toast.showSuccess;
    window.showError = toast.showError;
    window.showWarning = toast.showWarning;
    window.showInfo = toast.showInfo;
    
    // Map functions
    window.centerOnUser = map.centerOnUser;
    window.centerOnSite = map.centerOnSite;
    window.reloadPage = () => window.location.reload();
    window.goBack = () => window.location.href = 'dashboard.html';
    
    // Game control functions (these would be implemented in other modules)
    window.startGame = () => console.log('startGame - to be implemented');
    window.pauseGame = () => console.log('pauseGame - to be implemented');
    window.resumeGame = () => console.log('resumeGame - to be implemented');
    window.endGame = () => console.log('endGame - to be implemented');
    window.restartGame = () => console.log('restartGame - to be implemented');
    window.addTime = () => console.log('addTime - to be implemented');
    window.leaveGame = () => console.log('leaveGame - to be implemented');
    
    // Teams management functions (these would be implemented in other modules)
    window.openTeamsDialog = () => console.log('openTeamsDialog - to be implemented');
    window.closeTeamsDialog = () => console.log('closeTeamsDialog - to be implemented');
    window.setTeamCount = () => console.log('setTeamCount - to be implemented');
    window.updatePlayerTeam = () => console.log('updatePlayerTeam - to be implemented');
    window.updateGameTime = () => console.log('updateGameTime - to be implemented');
    
    // Game name editing functions (these would be implemented in other modules)
    window.enableGameNameEdit = () => console.log('enableGameNameEdit - to be implemented');
    window.updateGameName = () => console.log('updateGameName - to be implemented');
    
    // Timer functions (these would be implemented in other modules)
    window.updateTimeDisplay = () => console.log('updateTimeDisplay - to be implemented');
    window.openGameSummaryDialog = () => console.log('openGameSummaryDialog - to be implemented');
    window.closeGameSummaryDialog = () => console.log('closeGameSummaryDialog - to be implemented');
    
    // Control point functions (these would be implemented in other modules)
    window.closeControlPointPopup = () => console.log('closeControlPointPopup - to be implemented');
    window.updateOpenControlPointPopups = () => console.log('updateOpenControlPointPopups - to be implemented');
    window.handleControlPointData = () => console.log('handleControlPointData - to be implemented');
    window.handlePositionChallengeUpdate = () => console.log('handlePositionChallengeUpdate - to be implemented');
    window.updatePositionChallengePieCharts = () => console.log('updatePositionChallengePieCharts - to be implemented');
    
    // Marker functions (these would be implemented in other modules)
    window.createUserMarker = () => console.log('createUserMarker - to be implemented');
    window.cleanupInvalidMarkers = () => console.log('cleanupInvalidMarkers - to be implemented');
    window.validateMarker = () => console.log('validateMarker - to be implemented');
    window.clearAllControlPointTimerData = () => console.log('clearAllControlPointTimerData - to be implemented');
    
    // Timer display functions (these would be implemented in other modules)
    window.updateAllTimerDisplays = () => console.log('updateAllTimerDisplays - to be implemented');
    window.startControlPointTimerInterval = () => console.log('startControlPointTimerInterval - to be implemented');
    window.stopControlPointTimerInterval = () => console.log('stopControlPointTimerInterval - to be implemented');
    window.incrementControlPointTimers = () => console.log('incrementControlPointTimers - to be implemented');
    window.formatTime = () => console.log('formatTime - to be implemented');
    window.clearControlPointTimerData = () => console.log('clearControlPointTimerData - to be implemented');
    
    // Current user functions (these would be implemented in other modules)
    window.updateCurrentUserTeam = () => console.log('updateCurrentUserTeam - to be implemented');
    
    // Sync functions (these would be implemented in other modules)
    window.syncTimeSelector = () => console.log('syncTimeSelector - to be implemented');
}

// Auto-initialize when imported
setupGlobalFunctions();

// Export the initialize function as the default export
export default initialize;