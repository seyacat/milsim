// Main control points player functionality - imports and exports all modules

// Import all functionality from separate modules
// These files are loaded via script tags in the HTML

// This file serves as the main entry point that ensures all functions
// are properly exported to the global window object

// All individual modules export their functions to window object
// This file doesn't need to do anything else since the modules
// handle their own exports

// The following functions are now available globally from their respective modules:

// From bomb-timer.js:
// - handleBombTimeUpdate
// - updateBombTimerDisplay
// - requestActiveBombTimers
// - handleActiveBombTimers

// From position-challenge.js:
// - updatePositionChallengeBars
// - handlePositionChallengeUpdate
// - updateAllPositionChallengeBars

// From markers-popups.js:
// - addPlayerControlPointMarker
// - createPlayerControlPointMenu
// - updatePlayerControlPointPopups
// - refreshPlayerControlPointMarkers
// - updateTimerDisplay
// - updateControlPointPopupForBomb
// - requestPlayerControlPointData
// - updatePlayerControlPointPopupWithFreshData

// From challenge-submissions.js:
// - takeControlPoint
// - calculateDistance
// - getControlPointById
// - sendTakeControlPointAction
// - submitCodeChallenge
// - submitPositionChallenge
// - submitBombChallenge
// - submitBombDeactivation

// Global variables that need to be shared across modules
// These are defined in the original file and should remain global
// - activeBombTimers (defined in bomb-timer.js)
// - bombTimerInterval (defined in bomb-timer.js)

// Note: This refactoring maintains full backward compatibility
// All existing function calls and global references will continue to work