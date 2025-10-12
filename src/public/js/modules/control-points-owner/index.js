// Control points owner ES6 module - main entry point
import { setupGlobalFunctions as setupMenuManagement } from './menu-management.js';
import { setupGlobalFunctions as setupControlPointOperations } from './control-point-operations.js';
import { setupGlobalFunctions as setupMarkersPopups } from './markers-popups.js';
import { setupGlobalFunctions as setupEditMenu } from './edit-menu.js';
import { setupGlobalFunctions as setupFormHandlers } from './form-handlers.js';
import { setupGlobalFunctions as setupBombTimer } from './bomb-timer.js';
import { setupGlobalFunctions as setupPositionChallenge } from './position-challenge.js';

// Import all functions for ES6 module usage
export { initializeOwnerControlPoints, showControlPointMenu, closeControlPointMenu, closeControlPointMenuOutside } from './menu-management.js';
export { createControlPoint, updateControlPoint, deleteControlPoint, enableDragMode, assignControlPointTeam, handleControlPointTeamAssigned, requestControlPointData, updateControlPointPopupWithFreshData, getControlPointById } from './control-point-operations.js';
export { addControlPointMarkerOwner, updateOwnerControlPointPopups, refreshOwnerControlPointMarkers, updateSingleOwnerMarker, hasSiteControlPoint } from './markers-popups.js';
export { createControlPointEditMenu } from './edit-menu.js';
export { togglePositionInputs, toggleCodeInputs, toggleBombInputs } from './form-handlers.js';
export { handleBombTimeUpdate, updateBombTimerDisplay, requestActiveBombTimers, handleActiveBombTimers, activateBomb, deactivateBomb, isBombActive, updateBombButtonStates, updateAllBombButtonStates, activateBombAsOwner, deactivateBombAsOwner } from './bomb-timer.js';
export { updatePositionChallengeBars, handlePositionChallengeUpdate, updateAllPositionChallengeBars, createOwnerPositionChallengePieChart } from './position-challenge.js';

// Export state for external access if needed
export { controlPointMenuVisible, mapClickHandler, activeBombTimers, bombTimerInterval } from './state.js';

// Export constants
export { TEAM_COLORS, DISTANCE_OPTIONS, ACCURACY_OPTIONS, BOMB_TIME_OPTIONS, CONTROL_POINT_TYPES } from './constants.js';

// Initialize all global functions for backward compatibility
export function initializeControlPointsOwner() {
    console.log('Starting control points owner initialization...');
    
    setupMenuManagement();
    console.log('Menu management setup complete');
    
    setupControlPointOperations();
    console.log('Control point operations setup complete');
    
    setupMarkersPopups();
    console.log('Markers popups setup complete');
    
    setupEditMenu();
    console.log('Edit menu setup complete');
    
    setupFormHandlers();
    console.log('Form handlers setup complete');
    
    setupBombTimer();
    console.log('Bomb timer setup complete');
    
    setupPositionChallenge();
    console.log('Position challenge setup complete');
    
    console.log('Control points owner ES6 module initialized');
    console.log('Available global functions:', Object.keys(window).filter(key =>
        key.includes('Control') || key.includes('Owner') || key.includes('Bomb') || key.includes('Position')
    ));
}

// Auto-initialize when imported
initializeControlPointsOwner();