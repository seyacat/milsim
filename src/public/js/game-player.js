// Player-specific functionality
let isShowingTeamSelection = false;

// Initialize player features
function initializePlayerFeatures() {
    console.log('Initializing player features');
    
    // Players don't need map click handlers for creating control points
    // They only interact with existing control points
    
    // Show team selection for players when game is stopped
    updatePlayerTeamSelection();
}

// Update player team selection interface
function updatePlayerTeamSelection() {
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
    
    // Debug: Log current state for troubleshooting
    console.log('Team selection update:', {
        isOwner,
        isStopped,
        currentUser: currentUser.id,
        gameStatus: currentGame.status,
        teamCount: currentGame.teamCount,
        players: currentGame.players?.length,
        currentPlayer: currentGame.players?.find(p => p.user.id === currentUser.id)
    });
}

// Show team selection interface for players
async function showPlayerTeamSelection() {
    // Prevent multiple simultaneous calls
    if (isShowingTeamSelection) {
        return;
    }
    
    isShowingTeamSelection = true;
    
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
    
    // Get current player's team - ensure we have the latest data
    let currentPlayer = currentGame.players?.find(p => p.user.id === currentUser.id);
    let currentTeam = 'none';
    
    if (currentPlayer) {
        currentTeam = currentPlayer.team || 'none';
    } else {
        // If player not found, try to get the latest game data
        console.warn('Current player not found in game data, trying to reload...');
        try {
            const response = await fetch(`/api/games/${currentGame.id}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const updatedGame = await response.json();
                currentGame = updatedGame;
                currentPlayer = currentGame.players?.find(p => p.user.id === currentUser.id);
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
    isShowingTeamSelection = false;
}

// Hide team selection interface
function hidePlayerTeamSelection() {
    const existingSelection = document.getElementById('playerTeamSelection');
    if (existingSelection) {
        existingSelection.remove();
    }
    isShowingTeamSelection = false;
}

// Select player team
function selectPlayerTeam(team) {
    if (!socket || !currentGame || !currentUser) return;
    
    // Find current player - try multiple approaches
    let currentPlayer = currentGame.players?.find(p => p.user.id === currentUser.id);
    
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
        
        showSuccess(`Equipo seleccionado: ${team === 'none' ? 'NONE' : team.toUpperCase()}`);
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
    updatePlayerTeamSelection();
    
    showSuccess(`Equipo seleccionado: ${team === 'none' ? 'NINGUNO' : team.toUpperCase()}`);
}

// Make functions available globally
window.initializePlayerFeatures = initializePlayerFeatures;
window.updatePlayerTeamSelection = updatePlayerTeamSelection;
window.selectPlayerTeam = selectPlayerTeam;
window.showPlayerTeamSelection = showPlayerTeamSelection;
window.hidePlayerTeamSelection = hidePlayerTeamSelection;