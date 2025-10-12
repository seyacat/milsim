// Team selection functionality for players
import { TEAM_COLORS, TEAM_NAMES, TEAM_SELECTION_STATES } from './constants.js';
import { setShowingTeamSelection, updateCurrentPlayerTeam, updateTeamSelectionState, isShowingTeamSelection } from './state.js';
import { showToast, getCurrentGame, getCurrentUser, getSocket } from '../game-core/index.js';

// Show team selection interface for players
export async function showPlayerTeamSelection() {
    // Prevent multiple simultaneous calls
    if (isShowingTeamSelection) {
        return;
    }

    setShowingTeamSelection(true);
    updateTeamSelectionState(TEAM_SELECTION_STATES.LOADING);

    // Remove existing team selection if any
    const existingSelection = document.getElementById('playerTeamSelection');
    if (existingSelection) {
        existingSelection.remove();
    }

    // Create team selection container
    const teamSelection = document.createElement('div');
    teamSelection.id = 'playerTeamSelection';
    teamSelection.style.cssText = `
        position: absolute;
        bottom: 25%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 8px;
        padding: 15px;
        color: white;
        backdrop-filter: blur(10px);
        max-width: 300px;
        pointer-events: auto;
    `;

    // Get current game and user
    const currentGame = getCurrentGame();
    const currentUser = getCurrentUser();
    
    if (!currentGame || !currentUser) {
        console.error('Current game or user not available');
        setShowingTeamSelection(false);
        updateTeamSelectionState(TEAM_SELECTION_STATES.HIDDEN);
        return;
    }

    // Get current player's team - ensure we have the latest data
    let currentPlayer = currentGame.players?.find(p => p && p.user && p.user.id === currentUser.id);
    let currentTeam = 'none';

    if (currentPlayer) {
        currentTeam = currentPlayer.team || 'none';
    } else {
        // If player not found, try to get the latest game data
        console.warn('Current player not found in game data, trying to reload...');
        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Include authorization header if token exists
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(`/api/games/${currentGame.id}`, {
                headers: headers,
                credentials: 'include'
            });
            if (response.ok) {
                const updatedGame = await response.json();
                currentGame = updatedGame;
                currentPlayer = currentGame.players?.find(p => p && p.user && p.user.id === currentUser.id);
                currentTeam = currentPlayer?.team || 'none';
            } else {
                console.warn('Failed to reload game data:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Failed to reload game data:', error);
        }
    }

    // Create team buttons based on game team count
    const availableTeams = ['blue', 'red', 'green', 'yellow'];
    const teamCount = currentGame.teamCount || 2;
    const teams = availableTeams.slice(0, teamCount);
    let teamButtons = '';

    teams.forEach(team => {
        const isActive = currentTeam === team;
        teamButtons += `
            <button class="team-btn ${team} ${isActive ? 'active' : ''}"
                    onclick="selectPlayerTeam('${team}')">
                ${team.toUpperCase()}
            </button>
        `;
    });

    // Add "none" button
    const isNoneActive = currentTeam === 'none';
    teamButtons += `
        <button class="team-btn none ${isNoneActive ? 'active' : ''}"
                onclick="selectPlayerTeam('none')">
            NONE
        </button>
    `;

    teamSelection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0; color: white; font-size: 14px;">Selecciona tu equipo:</h4>
            <button onclick="hidePlayerTeamSelection()" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer; padding: 0; width: 20px; height: 20px;">×</button>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
            ${teamButtons}
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #ccc;">
            Equipo actual: <strong>${currentTeam === 'none' ? 'NONE' : currentTeam.toUpperCase()}</strong>
        </div>
    `;

    document.body.appendChild(teamSelection);
    
    // Reset flag after successful creation
    setShowingTeamSelection(false);
    updateTeamSelectionState(TEAM_SELECTION_STATES.SHOWING);
    
    console.log('Team selection interface shown');
}

// Hide team selection interface
export function hidePlayerTeamSelection() {
    const existingSelection = document.getElementById('playerTeamSelection');
    if (existingSelection) {
        existingSelection.remove();
    }
    setShowingTeamSelection(false);
    updateTeamSelectionState(TEAM_SELECTION_STATES.HIDDEN);
    
    console.log('Team selection interface hidden');
}

// Select player team
export function selectPlayerTeam(team) {
    const socket = getSocket();
    const currentGame = getCurrentGame();
    const currentUser = getCurrentUser();
    
    if (!socket || !currentGame || !currentUser) {
        showToast('Error: No hay conexión o datos del juego', 'error');
        return;
    }

    // Find current player - try multiple approaches
    let currentPlayer = currentGame.players?.find(p => p && p.user && p.user.id === currentUser.id);

    // If player not found in currentGame.players, try to get player ID from the DOM or use a fallback
    if (!currentPlayer) {
        console.warn('Player not found in currentGame.players, trying alternative approach');
        
        // Try to get player data from the server or use a fallback
        // For now, we'll send the update with the user ID and let the server handle it
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'updatePlayerTeam',
            data: {
                userId: currentUser.id,
                team: team
            }
        });
        
        showToast(`Equipo seleccionado: ${team === 'none' ? 'NONE' : team.toUpperCase()}`, 'success');
        updateCurrentPlayerTeam(team);
        return;
    }

    // Send team update via WebSocket
    socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'updatePlayerTeam',
        data: {
            playerId: currentPlayer.id,
            team: team
        }
    });

    // Update local player data immediately
    if (currentPlayer) {
        currentPlayer.team = team;
    }

    // Update the team selection interface
    updateCurrentPlayerTeam(team);
    
    showToast(`Equipo seleccionado: ${team === 'none' ? 'NINGUNO' : team.toUpperCase()}`, 'success');
    
    console.log('Player team selected:', team);
}

// Update player team selection interface
export function updatePlayerTeamSelection() {
    const currentGame = getCurrentGame();
    const currentUser = getCurrentUser();
    
    if (!currentGame || !currentUser) return;

    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
    const isStopped = currentGame.status === 'stopped';

    // Only show team selection for non-owners when game is stopped
    if (!isOwner && isStopped) {
        showPlayerTeamSelection().catch(error => {
            console.error('Error showing team selection:', error);
        });
    } else {
        hidePlayerTeamSelection();
    }

    console.log('Player team selection updated');
}

// Get current player team
export function getCurrentPlayerTeam() {
    const currentGame = getCurrentGame();
    const currentUser = getCurrentUser();
    
    if (!currentGame || !currentUser) return 'none';

    const currentPlayer = currentGame.players?.find(p => p && p.user && p.user.id === currentUser.id);
    return currentPlayer?.team || 'none';
}

// Check if player can select team
export function canSelectTeam() {
    const currentGame = getCurrentGame();
    const currentUser = getCurrentUser();
    
    if (!currentGame || !currentUser) return false;

    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
    const isStopped = currentGame.status === 'stopped';

    return !isOwner && isStopped;
}

// Global functions for HTML event handlers
window.selectPlayerTeam = selectPlayerTeam;
window.showPlayerTeamSelection = showPlayerTeamSelection;
window.hidePlayerTeamSelection = hidePlayerTeamSelection;