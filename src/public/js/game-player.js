// Player-specific functionality

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
            const response = await fetch(`/api/games/${currentGame.id}`);
            if (response.ok) {
                const updatedGame = await response.json();
                currentGame = updatedGame;
                currentPlayer = currentGame.players?.find(p => p.user.id === currentUser.id);
                currentTeam = currentPlayer?.team || 'none';
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
                    onclick="selectPlayerTeam('${team}')"
                    style="margin: 2px; padding: 8px 12px; border: 1px solid #666; border-radius: 3px; cursor: pointer; font-size: 12px;">
                ${team.toUpperCase()}
            </button>
        `;
    });
    
    // Add "none" button
    const isNoneActive = currentTeam === 'none';
    teamButtons += `
        <button class="team-btn none ${isNoneActive ? 'active' : ''}"
                onclick="selectPlayerTeam('none')"
                style="margin: 2px; padding: 8px 12px; border: 1px solid #666; border-radius: 3px; cursor: pointer; font-size: 12px; background: #666; color: white;">
            NONE
        </button>
    `;
    
    teamSelection.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: white; font-size: 14px;">Selecciona tu equipo:</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
            ${teamButtons}
        </div>
        <div style="margin-top: 10px; font-size: 12px; color: #ccc;">
            Equipo actual: <strong>${currentTeam === 'none' ? 'NONE' : currentTeam.toUpperCase()}</strong>
        </div>
    `;
    
    document.body.appendChild(teamSelection);
}

// Hide team selection interface
function hidePlayerTeamSelection() {
    const existingSelection = document.getElementById('playerTeamSelection');
    if (existingSelection) {
        existingSelection.remove();
    }
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

// Create control point interaction menu for players
function createControlPointPlayerMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.style.cssText = `
        min-width: 200px;
        padding: 10px;
    `;
    
    const isSite = controlPoint.type === 'site';
    const pointType = isSite ? 'Site' : 'Control Point';
    
    menu.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #333;">${pointType}</h4>
        <div style="margin-bottom: 10px;">
            <strong>${controlPoint.name}</strong>
        </div>
        <div style="margin-bottom: 10px;">
            <small>${controlPoint.description || 'Sin descripción'}</small>
        </div>
        <div style="display: flex; gap: 5px; justify-content: flex-end;">
            <button onclick="takeControlPoint(${controlPoint.id})" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Tomar</button>
        </div>
    `;
    
    return menu;
}

// Add control point marker to map for players
function addControlPointMarkerPlayer(controlPoint) {
    console.log('Adding control point marker for player:', controlPoint);
    
    // Create icon based on type
    const isSite = controlPoint.type === 'site';
    const iconColor = isSite ? '#FF9800' : '#2196F3';
    const iconEmoji = isSite ? '🏠' : '🚩';
    
    const controlPointIcon = L.divIcon({
        className: 'control-point-marker',
        html: `
            <div style="
                background: ${iconColor}33;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: white;
                font-weight: bold;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            ">${iconEmoji}</div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const marker = L.marker([controlPoint.latitude, controlPoint.longitude], {
        icon: controlPointIcon
    }).addTo(map);

    // Create popup with "Tomar" option for players
    const popupContent = createControlPointPlayerMenu(controlPoint, marker);
    
    marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
    });

    // Store control point data on marker for reference
    marker.controlPointData = controlPoint;

    console.log('Player marker created successfully:', marker);
    return marker;
}

// Take control point action
function takeControlPoint(controlPointId) {
    console.log('Taking control point:', controlPointId);
    
    // Send take control point action via WebSocket
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'takeControlPoint',
            data: {
                controlPointId,
                userId: currentUser.id
            }
        });
        
        showSuccess('¡Punto tomado!');
    }
}

// Make functions available globally
window.initializePlayerFeatures = initializePlayerFeatures;
window.addControlPointMarkerPlayer = addControlPointMarkerPlayer;
window.takeControlPoint = takeControlPoint;
window.updatePlayerTeamSelection = updatePlayerTeamSelection;
window.selectPlayerTeam = selectPlayerTeam;
window.createControlPointPlayerMenu = createControlPointPlayerMenu;