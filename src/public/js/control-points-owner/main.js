// Main control points owner functionality - imports and exports all modules

// Import all functionality from separate modules
// These files are loaded via script tags in the HTML

// This file serves as the main entry point that ensures all functions
// are properly exported to the global window object

// All individual modules export their functions to window object
// This file doesn't need to do anything else since the modules
// handle their own exports

// The following functions are now available globally from their respective modules:

// From menu-management.js:
// - initializeOwnerControlPoints
// - showControlPointMenu
// - closeControlPointMenu
// - closeControlPointMenuOutside
// - createControlPoint
// - hasSiteControlPoint

// From markers-popups.js:
// - addOwnerControlPointMarker
// - updateOwnerControlPointPopups
// - refreshOwnerControlPointMarkers
// - updateSingleOwnerMarker

// From edit-menu.js:
// - createOwnerControlPointEditMenu
// - togglePositionInputs
// - toggleCodeInputs
// - toggleBombInputs

// From control-point-operations.js:
// - updateControlPoint
// - deleteControlPoint
// - enableDragMode
// - assignControlPointTeam
// - handleControlPointTeamAssigned
// - requestControlPointData
// - updateControlPointPopupWithFreshData
// - getControlPointById

// From bomb-timer.js:
// - handleBombTimeUpdate
// - updateBombTimerDisplay
// - requestActiveBombTimers
// - handleActiveBombTimers
// - activateBomb
// - deactivateBomb
// - isBombActive
// - updateBombButtonStates
// - updateAllBombButtonStates
// - activateBombAsOwner
// - deactivateBombAsOwner

// From position-challenge.js:
// - updatePositionChallengeBars
// - handlePositionChallengeUpdate
// - updateAllPositionChallengeBars
// - createOwnerPositionChallengePieChart

// Global variables that need to be shared across modules
// These are defined in their respective modules and should remain global
// - controlPointMenuVisible (defined in menu-management.js)
// - mapClickHandler (defined in menu-management.js)
// - activeBombTimers (defined in bomb-timer.js)
// - bombTimerInterval (defined in bomb-timer.js)

// Note: This refactoring maintains full backward compatibility
// All existing function calls and global references will continue to work