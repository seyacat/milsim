// State management for game player functionality
export let isShowingTeamSelection = false;
export let currentPlayerTeam = 'none';
export let teamSelectionState = 'hidden';

// Update team selection state
export function updateTeamSelectionState(state) {
    teamSelectionState = state;
}

// Set showing team selection flag
export function setShowingTeamSelection(flag) {
    isShowingTeamSelection = flag;
}

// Update current player team
export function updateCurrentPlayerTeam(team) {
    currentPlayerTeam = team;
}

// Get current player team
export function getCurrentPlayerTeam() {
    return currentPlayerTeam;
}

// Check if team selection is showing
export function isTeamSelectionShowing() {
    return isShowingTeamSelection;
}

// Reset team selection state
export function resetTeamSelectionState() {
    isShowingTeamSelection = false;
    teamSelectionState = 'hidden';
}

// Get player state
export function getPlayerState() {
    return {
        isShowingTeamSelection,
        currentPlayerTeam,
        teamSelectionState
    };
}