// Main module for game player functionality
import { PLAYER_FEATURES } from './constants.js';
import { resetTeamSelectionState, getPlayerState } from './state.js';
import { 
    updatePlayerTeamSelection, 
    showPlayerTeamSelection, 
    hidePlayerTeamSelection, 
    selectPlayerTeam,
    canSelectTeam,
    getCurrentPlayerTeam 
} from './team-selection.js';
import { initializeControlPointsPlayer } from '../control-points-player/index.js';
import { showToast, getCurrentGame, getCurrentUser } from '../game-core/index.js';

// Initialize player features
export function initializePlayerFeatures() {
    console.log('Initializing player features');
    
    try {
        // Players don't need map click handlers for creating control points
        // They only interact with existing control points
        
        // Initialize player control points functionality
        if (typeof initializeControlPointsPlayer === 'function') {
            initializeControlPointsPlayer();
            console.log('Player control points initialized');
        } else {
            console.error('initializeControlPointsPlayer function not found!');
            showToast('Error initializando puntos de control del jugador', 'error');
        }
        
        // Show team selection for players when game is stopped
        updatePlayerTeamSelection();
        
        // Set up player-specific event listeners
        setupPlayerEventListeners();
        
        console.log('Player features initialized successfully');
        
    } catch (error) {
        console.error('Error initializing player features:', error);
        showToast('Error inicializando funciones del jugador', 'error');
    }
}

// Set up player-specific event listeners
function setupPlayerEventListeners() {
    // Listen for game state changes
    window.addEventListener('gameStateChanged', (event) => {
        handleGameStateChange(event.detail);
    });
    
    // Listen for player updates
    window.addEventListener('playerUpdated', (event) => {
        handlePlayerUpdate(event.detail);
    });
    
    // Listen for team updates
    window.addEventListener('teamUpdated', (event) => {
        handleTeamUpdate(event.detail);
    });
    
    console.log('Player event listeners set up');
}

// Handle game state changes
function handleGameStateChange(game) {
    console.log('Player: Game state changed to', game.status);
    
    // Update team selection based on game state
    updatePlayerTeamSelection();
    
    // Reset team selection state when game starts
    if (game.status === 'running') {
        resetTeamSelectionState();
    }
}

// Handle player updates
function handlePlayerUpdate(player) {
    const currentUser = getCurrentUser();
    
    // Check if this update is for the current player
    if (currentUser && player.user && player.user.id === currentUser.id) {
        console.log('Player: Current player updated', player);
        
        // Update team selection if team changed
        updatePlayerTeamSelection();
    }
}

// Handle team updates
function handleTeamUpdate(teamData) {
    console.log('Player: Team data updated', teamData);
    
    // Update team selection interface if needed
    updatePlayerTeamSelection();
}

// Check if player features are available
export function arePlayerFeaturesAvailable() {
    return typeof initializeControlPointsPlayer === 'function' && 
           typeof updatePlayerTeamSelection === 'function';
}

// Get player feature status
export function getPlayerFeatureStatus() {
    const status = {};
    
    status[PLAYER_FEATURES.TEAM_SELECTION] = typeof updatePlayerTeamSelection === 'function';
    status[PLAYER_FEATURES.CONTROL_POINT_INTERACTION] = typeof initializeControlPointsPlayer === 'function';
    status[PLAYER_FEATURES.POSITION_CHALLENGE] = true; // Always available for players
    
    return status;
}

// Get player information
export function getPlayerInfo() {
    const currentGame = getCurrentGame();
    const currentUser = getCurrentUser();
    
    if (!currentGame || !currentUser) {
        return null;
    }
    
    const currentPlayer = currentGame.players?.find(p => p && p.user && p.user.id === currentUser.id);
    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
    
    return {
        player: currentPlayer,
        isOwner: isOwner,
        team: currentPlayer?.team || 'none',
        canSelectTeam: canSelectTeam(),
        state: getPlayerState()
    };
}

// Global functions for HTML event handlers
window.initializePlayerFeatures = initializePlayerFeatures;
window.updatePlayerTeamSelection = updatePlayerTeamSelection;
window.selectPlayerTeam = selectPlayerTeam;
window.showPlayerTeamSelection = showPlayerTeamSelection;
window.hidePlayerTeamSelection = hidePlayerTeamSelection;