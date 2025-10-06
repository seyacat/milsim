// Core game functionality - shared between owner and player
let currentUser = null;
let currentGame = null;
let socket = null;
let map = null;
let userMarker = null;
let playerMarkers = {};
let watchId = null;
let localTimer = null;
let lastTimeUpdate = null;

// Initialize map and game
function initialize() {
    initMap();
    checkAuth();
}

// Initialize Leaflet map
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        maxZoom: 22, // Increased from default 18
        minZoom: 1
    }).setView([0, 0], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 22, // Match the map maxZoom
        minZoom: 1
    }).addTo(map);

    // Add scale control
    L.control.scale().addTo(map);
}

// Check if user is logged in and get game ID from URL
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Get game ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('id');
    
    if (!gameId) {
        showError('ID del juego no especificado');
        // Redirect to dashboard when no game ID is specified
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
        return;
    }
    
    // Decode JWT token to get user info
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUser = {
            id: payload.id || 1,
            name: payload.name || 'Usuario'
        };
    } catch (error) {
        // Fallback to dummy user if token decoding fails
        currentUser = { id: 1, name: 'Usuario' };
    }
    
    // Load current user's team from game data after game is loaded
    // This will be updated when the game data is loaded
    
    // Initialize WebSocket connection
    initializeWebSocket(gameId);
    loadGame(gameId);
    startGPS();
}

// Initialize WebSocket connection
function initializeWebSocket(gameId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    // Get authentication token
    const token = localStorage.getItem('token');
    
    socket = io(wsUrl, {
        auth: {
            token: token
        }
    });

    socket.on('connect', () => {
        console.log('WebSocket connected');
        // Join the game room
        socket.emit('joinGame', {
            gameId: parseInt(gameId)
        });
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        showError('Conexión perdida con el servidor');
        // Don't redirect on disconnect - just show error
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        showError('Error de conexión con el servidor: ' + error.message);
        // Don't redirect on connection error - just show error
    });

    socket.on('gameUpdate', (data) => {
        console.log('Game update received:', data);
        console.log('Game update type:', data.type);
        // Update the game state when changes occur
        if (data.game) {
            currentGame = data.game;
            updateGameInfo();
            updatePlayerMarkers();
            
            // Debug: Check if this is a gameUpdated event with control points
            if (data.type === 'gameUpdated' && data.game.controlPoints) {
                console.log('GameUpdated event received with control points:', data.game.controlPoints.length);
                console.log('First control point data:', data.game.controlPoints[0]);
                
                // Also refresh control point markers when gameUpdate event contains control points
                const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                if (userIsOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                    console.log('Refreshing owner control point markers from gameUpdate event');
                    window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
                } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                    console.log('Refreshing player control point markers from gameUpdate event');
                    window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
                }
            }
        }
    });

    socket.on('gameAction', (data) => {
        console.log('Game action received:', data);
        // Handle game actions from other players
        handleGameAction(data);
    });

    socket.on('gameActionError', (data) => {
        console.log('Game action error:', data);
        showError('Error: ' + data.error);
    });

    socket.on('gameState', (game) => {
        console.log('Game state received:', game);
        currentGame = game;
        // Update current user's team information from game data
        updateCurrentUserTeam();
        updateGameInfo();
        updatePlayerMarkers();
    });

    socket.on('joinSuccess', (data) => {
        console.log('Successfully joined game room');
        // Update current user with authenticated data from server
        if (data.user) {
            currentUser = data.user;
            // Update current user's team information from game data
            updateCurrentUserTeam();
            updateGameInfo();
        }
        
        // If user is owner, request current positions from all players
        if (currentGame && currentGame.owner && currentGame.owner.id === currentUser.id) {
            requestPlayerPositions();
        }
        
        // Request current game time
        if (socket && currentGame) {
            socket.emit('getGameTime', { gameId: currentGame.id });
        }
    });

    socket.on('joinError', (data) => {
        showError('Error al unirse al juego: ' + data.message);
        // Always redirect to dashboard on join error after showing the error
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
    });

    socket.on('forceDisconnect', (data) => {
        showError(data.message);
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
    });

    socket.on('timeUpdate', (data) => {
        console.log('Time update received:', data);
        if (data) {
            console.log(`[FRONTEND] Time update - Played: ${data.playedTime}s, Remaining: ${data.remainingTime}, Total: ${data.totalTime}`);
            handleTimeUpdate(data);
        } else {
            // Handle case when there's no timer (unlimited game)
            console.log('[FRONTEND] No time data received, using defaults');
            handleTimeUpdate({ remainingTime: null, playedTime: 0, totalTime: null });
        }
    });

    socket.on('gameTime', (data) => {
        console.log('Game time received:', data);
        if (data) {
            console.log(`[FRONTEND] Game time - Played: ${data.playedTime}s, Remaining: ${data.remainingTime}, Total: ${data.totalTime}`);
            handleTimeUpdate(data);
        } else {
            // Handle case when there's no timer (unlimited game)
            console.log('[FRONTEND] No game time data received, using defaults');
            handleTimeUpdate({ remainingTime: null, playedTime: 0, totalTime: null });
        }
    });

    socket.on('gameTimeError', (data) => {
        console.error('Game time error:', data);
        showError('Error al obtener el tiempo del juego: ' + data.message);
    });
}

// Load game data
async function loadGame(gameId) {
    try {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Include authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/games/${gameId}`, {
            headers: headers
        });
        if (!response.ok) {
            // Check if it's a 404 (game not found) error
            if (response.status === 404) {
                throw new Error('Game not found');
            }
            throw new Error('Error al cargar el juego');
        }
        currentGame = await response.json();
        console.log('Game loaded:', currentGame);
        // Update current user's team information from game data
        updateCurrentUserTeam();
        updateGameInfo();
        updatePlayerMarkers();
        loadControlPoints(gameId);
    } catch (error) {
        showError('Error al cargar el juego: ' + error.message);
        // Always redirect to dashboard on load error after showing the error
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
    }
}

// Load control points for the game
async function loadControlPoints(gameId) {
    try {
        // Use refresh functions to load all control points with proper visualizations
        const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
        if (isOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
            console.log('Loading owner control points with refresh function');
            console.log('Control points data for owner:', currentGame.controlPoints);
            window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
        } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
            console.log('Loading player control points with refresh function');
            window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
        } else {
            // Fallback: Clear existing control point markers and add them individually
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer.controlPointData) {
                    map.removeLayer(layer);
                }
            });

            // Load control points from the game data
            if (currentGame && currentGame.controlPoints && Array.isArray(currentGame.controlPoints)) {
                currentGame.controlPoints.forEach(controlPoint => {
                    // Use appropriate function based on user role
                    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                    if (isOwner && window.addOwnerControlPointMarker) {
                        window.addOwnerControlPointMarker(controlPoint);
                    } else if (window.addPlayerControlPointMarker) {
                        window.addPlayerControlPointMarker(controlPoint);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error loading control points:', error);
    }
}

// Update current user's team information from game data
function updateCurrentUserTeam() {
    if (!currentGame || !currentUser || !currentGame.players) return;
    
    // Find the current player in the game's players list
    const currentPlayer = currentGame.players.find(p => p.user && p.user.id === currentUser.id);
    if (currentPlayer) {
        // Update current user with team information
        currentUser.team = currentPlayer.team || 'none';
        console.log('Updated current user team:', currentUser.team);
        
        // Refresh player markers to update colors based on new team
        updatePlayerMarkers();
        updateUserMarkerTeam();
    } else {
        console.log('Current user not found in game players list');
    }
}

// Update game information display
function updateGameInfo() {
    document.getElementById('gameTitle').textContent = currentGame.name;
    
    // Show/hide edit pencil for game owner
    const editPencil = document.getElementById('editPencil');
    if (editPencil) {
        const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
        editPencil.style.display = isOwner ? 'block' : 'none';
    }
    document.getElementById('gameStatus').textContent = currentGame.status;
    document.getElementById('playerCount').textContent = `${currentGame.players ? currentGame.players.length : 0}/${currentGame.maxPlayers}`;
    document.getElementById('gameOwner').textContent = currentGame.owner ? currentGame.owner.name : 'Desconocido';
    document.getElementById('currentUser').textContent = currentUser ? currentUser.name : 'Desconocido';
    
    // Update time display based on game state
    const timePlayedContainer = document.getElementById('timePlayedContainer');
    if (timePlayedContainer) {
        if (currentGame.status === 'running') {
            timePlayedContainer.style.display = 'block';
            // Initialize time display if we have time data
            if (currentGame.remainingTime !== undefined) {
                updateTimeDisplay(currentGame.remainingTime);
            }
        } else {
            timePlayedContainer.style.display = 'none';
        }
    }
    
    // Update controls visibility
    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
    const isPlayer = currentGame.players && currentGame.players.some(p => p.user.id === currentUser.id);
    
    if (isOwner) {
        document.getElementById('ownerControls').style.display = 'block';
        document.getElementById('playersBtn').style.display = 'block';
        
        // Update game state controls
        updateGameStateControls();
        
        // Sync time selector with current game time
        syncTimeSelector();
        
        // Initialize owner-specific functionality
        if (window.initializeOwnerFeatures) {
            window.initializeOwnerFeatures();
        }
    } else if (isPlayer) {
        document.getElementById('ownerControls').style.display = 'none';
        document.getElementById('playersBtn').style.display = 'none';
        document.getElementById('timeSelectorContainer').style.display = 'none';
        
        // Add or remove team selection button based on game state
        addTeamSelectionButton();
        
        // Initialize player-specific functionality
        if (window.initializePlayerFeatures) {
            window.initializePlayerFeatures();
        }
    }
    
    // Update player team selection (for non-owners when game is stopped)
    if (window.updatePlayerTeamSelection) {
        window.updatePlayerTeamSelection();
    }
    
    // Update control point popups when game info is updated
    const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
    if (userIsOwner && window.updateOwnerControlPointPopups) {
        console.log('Updating owner control point popups due to game info update');
        window.updateOwnerControlPointPopups();
    } else if (window.updatePlayerControlPointPopups) {
        console.log('Updating player control point popups due to game info update');
        window.updatePlayerControlPointPopups();
    }
    
    // Show game summary dialog if game is in finished state
    if (currentGame.status === 'finished') {
        console.log('Game is in finished state, opening summary dialog');
        openGameSummaryDialog();
    } else if (currentGame.status === 'stopped') {
        // Close game summary dialog when returning to stopped state (for all users)
        closeGameSummaryDialog();
    }
}

// Update player markers on map
function updatePlayerMarkers() {
    // Clear existing markers (except user's own marker)
    Object.entries(playerMarkers).forEach(([playerId, marker]) => {
        if (playerId !== currentUser.id.toString() && marker) {
            map.removeLayer(marker);
        }
    });
    
    // Keep only user's own marker
    const userMarkerId = currentUser.id.toString();
    if (playerMarkers[userMarkerId]) {
        const tempMarker = playerMarkers[userMarkerId];
        playerMarkers = {};
        playerMarkers[userMarkerId] = tempMarker;
    } else {
        playerMarkers = {};
    }

    // Check if we have valid game and players data
    if (!currentGame || !currentGame.players || !Array.isArray(currentGame.players)) {
        return;
    }

    // Add markers for all players (will be updated with real positions via WebSocket)
    currentGame.players.forEach(player => {
        // Skip if player data is incomplete or it's the current user
        if (!player || !player.user || !player.user.id || player.user.id === currentUser.id) {
            return;
        }

        // Check visibility rules
        const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
        const isStopped = currentGame.status === 'stopped';
        const currentPlayer = currentGame.players?.find(p => p.user.id === currentUser.id);
        
        // Owner can always see all players
        if (!isOwner) {
            // For non-owners, check team visibility rules
            if (!isStopped) {
                // In running/paused state, only show same team players
                if (!currentPlayer || !player || currentPlayer.team !== player.team) {
                    return; // Skip creating marker for this player
                }
            }
            // In stopped state, all players can see each other
        }

        // Create initial marker at default position (will be updated when position data arrives)
        const targetIsOwner = currentGame.owner && player.user.id === currentGame.owner.id;
        const teamClass = player.team && player.team !== 'none' ? player.team : 'none';
        console.log('Creating player marker with team class:', teamClass, 'for player:', player.user.name);
        const marker = L.marker([0, 0], {
            icon: L.divIcon({
                className: `player-marker ${teamClass}`,
                iconSize: [24, 24],
            })
        }).addTo(map);
        
        const teamInfo = player.team && player.team !== 'none' ? `<br>Equipo: ${player.team.toUpperCase()}` : '';
        
        marker.bindPopup(`
            <strong>${player.user.name || 'Jugador'}</strong><br>
            ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
            <em>Esperando posición GPS...</em>
        `);
        
        playerMarkers[player.user.id] = marker;
    });
}

// Update individual player marker with real position data
function updatePlayerMarker(positionData) {
    const { userId, userName, lat, lng, accuracy } = positionData;
    
    // Skip if it's the current user
    if (userId === currentUser.id) {
        return;
    }

    // Check if current user should see this player's position
    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
    const isStopped = currentGame.status === 'stopped';
    
    // Owner can always see all players
    if (isOwner) {
        // Owner can see everyone
    } else {
        // For non-owners, check team visibility rules
        const currentPlayer = currentGame.players?.find(p => p.user.id === currentUser.id);
        const targetPlayer = currentGame.players?.find(p => p.user.id === userId);
        
        if (!isStopped) {
            // In running/paused state, only show same team players
            if (!currentPlayer || !targetPlayer || currentPlayer.team !== targetPlayer.team) {
                // Remove marker if it exists and shouldn't be visible
                if (playerMarkers[userId]) {
                    map.removeLayer(playerMarkers[userId]);
                    delete playerMarkers[userId];
                }
                return;
            }
        }
        // In stopped state, all players can see each other
    }

    let marker = playerMarkers[userId];
    const targetPlayer = currentGame.players?.find(p => p.user.id === userId);
    const teamClass = targetPlayer?.team && targetPlayer.team !== 'none' ? targetPlayer.team : 'none';
    
    if (!marker) {
        // Create new marker if it doesn't exist
        const targetIsOwner = currentGame.owner && userId === currentGame.owner.id;
        console.log('Creating new player marker with team class:', teamClass, 'for user:', userName);
        marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: `player-marker ${teamClass}`,
                iconSize: [24, 24],
            })
        }).addTo(map);
        playerMarkers[userId] = marker;
        
        // No accuracy circles - using decorative background circles instead
    } else {
        // Update existing marker position
        marker.setLatLng([lat, lng]);
        
        // No accuracy circles - using decorative background circles instead
    }
    
    // Store accuracy for popup info only
    marker.accuracy = accuracy;
    
    // Update popup with position info
    const targetIsOwner = currentGame.owner && userId === currentGame.owner.id;
    const teamInfo = targetPlayer?.team && targetPlayer.team !== 'none' ? `<br>Equipo: ${targetPlayer.team.toUpperCase()}` : '';
    
    marker.bindPopup(`
        <strong>${userName || 'Jugador'}</strong><br>
        ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
        <small>Precisión: ${Math.round(accuracy)}m</small>
    `);
}

// Start GPS tracking
function startGPS() {
    if (!navigator.geolocation) {
        document.getElementById('gpsStatus').textContent = 'GPS no soportado';
        return;
    }

    document.getElementById('gpsStatus').textContent = 'Activando...';

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            document.getElementById('currentLat').textContent = lat.toFixed(6);
            document.getElementById('currentLng').textContent = lng.toFixed(6);
            document.getElementById('accuracy').textContent = Math.round(accuracy);
            document.getElementById('gpsStatus').textContent = 'Activo';

            // Update user marker on map
            if (!userMarker) {
                const currentPlayer = currentGame?.players?.find(p => p.user.id === currentUser.id);
                const teamClass = currentPlayer?.team && currentPlayer.team !== 'none' ? currentPlayer.team : 'none';
                console.log('Creating user marker with team class:', teamClass);
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: `user-marker ${teamClass}`,
                        iconSize: [24, 24],
                    })
                }).addTo(map);
                
                // Create popup with custom class for positioning
                const popup = L.popup({
                    className: 'user-marker-popup'
                }).setContent('<strong>Tú.</strong>');
                
                userMarker.bindPopup(popup).openPopup();
                
                // No accuracy circles for user
                
                // Set view to user's location when GPS is first available
                map.setView([lat, lng], 16);
            } else {
                userMarker.setLatLng([lat, lng]);
                
                // No accuracy circles for user
            }

            // Update player markers when user moves
            updatePlayerMarkers();

            // Send position update via WebSocket
            if (socket && currentGame) {
                socket.emit('gameAction', {
                    gameId: currentGame.id,
                    action: 'positionUpdate',
                    data: { lat, lng, accuracy }
                });
            }
        },
        (error) => {
            console.error('GPS error:', error);
            let message = 'Error de GPS';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Permiso denegado';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Ubicación no disponible';
                    break;
                case error.TIMEOUT:
                    message = 'Tiempo agotado';
                    break;
            }
            document.getElementById('gpsStatus').textContent = message;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}


// Game control functions
async function startGame() {
    // TODO: Implement start game logic
    showInfo('Función de iniciar juego en desarrollo');
}

async function endGame() {
    // TODO: Implement end game logic
    showInfo('Función de finalizar juego en desarrollo');
}

async function leaveGame() {
    if (confirm('¿Estás seguro de que quieres abandonar este juego?')) {
        try {
            // Leave via WebSocket first
            if (socket) {
                socket.emit('leaveGame', {
                    gameId: currentGame.id
                });
            }

            // Also call the REST API to leave
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/games/${currentGame.id}/leave`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                showSuccess('Has abandonado el juego');
                window.location.href = 'dashboard.html';
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Error al abandonar el juego');
            }
        } catch (error) {
            showError('Error: ' + error.message);
        }
    }
}

// Toast notification system
function showToast(message, type = 'info', duration = 5000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    // Add to container
    container.appendChild(toast);

    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                }, 300);
            }
        }, duration);
    }

    return toast;
}

// Toast utility functions
function showSuccess(message, duration = 5000) {
    return showToast(message, 'success', duration);
}

function showError(message, duration = 5000) {
    return showToast(message, 'error', duration);
}

function showWarning(message, duration = 5000) {
    return showToast(message, 'warning', duration);
}

function showInfo(message, duration = 5000) {
    return showToast(message, 'info', duration);
}

// Utility functions
function goBack() {
    window.location.href = 'dashboard.html';
}

// Map control functions
function reloadPage() {
    window.location.reload();
}

function centerOnUser() {
    if (userMarker) {
        const userPosition = userMarker.getLatLng();
        map.setView(userPosition, 16);
    }
}

function centerOnSite() {
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.type === 'site') {
            const sitePosition = layer.getLatLng();
            map.setView(sitePosition, 16);
        }
    });
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
    if (socket) {
        socket.disconnect();
    }
    if (localTimer) {
        clearInterval(localTimer);
        localTimer = null;
    }
});

// Make functions available globally
window.showToast = showToast;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.reloadPage = reloadPage;
window.centerOnUser = centerOnUser;
window.centerOnSite = centerOnSite;

// Teams management functionality
let selectedTeamCount = 2;
let playersData = [];

// Open teams dialog
function openTeamsDialog() {
    document.getElementById('teamsDialog').style.display = 'flex';
    loadPlayersData();
}

// Close teams dialog
function closeTeamsDialog() {
    document.getElementById('teamsDialog').style.display = 'none';
}

// Set team count
function setTeamCount(count) {
    selectedTeamCount = count;
    
    // Update active state of buttons
    document.querySelectorAll('.team-count-btn').forEach(btn => {
        if (btn.dataset.count === count.toString()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Send team count update to server
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'updateTeamCount',
            data: {
                teamCount: count
            }
        });
    }
    
    // Refresh players list immediately for owner
    if (currentGame && currentGame.owner && currentGame.owner.id === currentUser.id) {
        loadPlayersData();
    } else {
        renderPlayersList();
    }
}

// Load players data
async function loadPlayersData() {
    try {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Include authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/games/${currentGame.id}/players`, {
            headers: headers
        });
        if (!response.ok) {
            throw new Error('Error al cargar jugadores');
        }
        playersData = await response.json();
        renderPlayersList();
    } catch (error) {
        showError('Error al cargar jugadores: ' + error.message);
    }
}

// Render players list
function renderPlayersList() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    playersData.forEach(player => {
        const playerRow = document.createElement('div');
        playerRow.className = 'player-row';
        
        const teamButtons = createTeamButtons(player);
        
        playerRow.innerHTML = `
            <div class="player-name">${player.user.name}</div>
            <div class="player-teams">${teamButtons}</div>
        `;
        
        playersList.appendChild(playerRow);
    });
}

// Create team buttons for a player
function createTeamButtons(player) {
    const teamCount = currentGame?.teamCount || 2;
    const teams = ['blue', 'red', 'green', 'yellow'].slice(0, teamCount);
    let buttons = '';
    
    // Add team buttons
    teams.forEach(team => {
        const isActive = player.team === team;
        buttons += `
            <button class="team-btn ${team} ${isActive ? 'active' : ''}"
                    onclick="event.stopPropagation(); updatePlayerTeam(${player.id}, '${team}')">
                ${team.toUpperCase()}
            </button>
        `;
    });
    
    // Add "none" button
    const isNoneActive = player.team === 'none';
    buttons += `
        <button class="team-btn none ${isNoneActive ? 'active' : ''}"
                onclick="event.stopPropagation(); updatePlayerTeam(${player.id}, 'none')">
            NONE
        </button>
    `;
    
    return buttons;
}

// Update player team
function updatePlayerTeam(playerId, team) {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'updatePlayerTeam',
            data: {
                playerId,
                team
            }
        });
    }
}

// Handle player team updates
function handlePlayerTeamUpdate(data) {
    // Update local players data for owner dialog
    const playerIndex = playersData.findIndex(p => p.id === data.playerId);
    if (playerIndex !== -1) {
        playersData[playerIndex].team = data.team;
        renderPlayersList();
    }
    
    // Update currentGame players data for team selection interface
    if (currentGame && currentGame.players) {
        const gamePlayerIndex = currentGame.players.findIndex(p => p.id === data.playerId);
        if (gamePlayerIndex !== -1) {
            currentGame.players[gamePlayerIndex].team = data.team;
        }
    }
    
    // Update player marker with new team color
    updatePlayerMarkerTeam(data.playerId, data.team);
    
    // Show notification
    if (data.userId !== currentUser.id) {
        showInfo(`${data.userName} ha sido asignado al equipo ${data.team || 'none'}`);
    }
}

// Update player marker with new team
function updatePlayerMarkerTeam(playerId, team) {
    // Find the player by playerId to get the userId
    const targetPlayer = currentGame.players?.find(p => p.id === playerId);
    if (!targetPlayer) {
        return;
    }
    
    const userId = targetPlayer.user.id;
    const marker = playerMarkers[userId];
    if (marker) {
        const teamClass = team && team !== 'none' ? team : 'none';
        const currentPosition = marker.getLatLng();
        const currentAccuracy = marker.accuracy || 0;
        
        // Remove existing marker
        map.removeLayer(marker);
        
        // Create new marker with updated team class
        const newMarker = L.marker(currentPosition, {
            icon: L.divIcon({
                className: `player-marker ${teamClass}`,
                iconSize: [24, 24],
            })
        }).addTo(map);
        
        // Update popup with current info
        const targetIsOwner = currentGame.owner && userId === currentGame.owner.id;
        const teamInfo = targetPlayer?.team && targetPlayer.team !== 'none' ? `<br>Equipo: ${targetPlayer.team.toUpperCase()}` : '';
        
        newMarker.bindPopup(`
            <strong>${targetPlayer?.user?.name || 'Jugador'}</strong><br>
            ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
            <small>Precisión: ${Math.round(currentAccuracy)}m</small>
        `);
        
        playerMarkers[userId] = newMarker;
    }
}

// Add event listener for players button
document.addEventListener('DOMContentLoaded', function() {
    const playersBtn = document.getElementById('playersBtn');
    if (playersBtn) {
        playersBtn.addEventListener('click', openTeamsDialog);
    }
    
    // Initialize team count buttons
    document.querySelectorAll('.team-count-btn').forEach(btn => {
        btn.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent event from bubbling up to modal
            setTeamCount(parseInt(this.dataset.count));
        });
    });
    
    // Set initial team count from game data (only after currentGame is loaded)
    if (currentGame) {
        if (currentGame.teamCount) {
            setTeamCount(currentGame.teamCount);
        } else {
            setTeamCount(2);
        }
    }
    
    // Add event listener for time selector
    const timeSelector = document.getElementById('timeSelector');
    if (timeSelector) {
        timeSelector.addEventListener('change', function() {
            const selectedTime = parseInt(this.value);
            updateGameTime(selectedTime);
        });
    }
});

// Handle game actions from other players
function handleGameAction(data) {
    switch (data.action) {
        case 'positionUpdate':
            // Update other player positions with real GPS data
            if (data.data.userId !== currentUser.id) {
                updatePlayerMarker(data.data);
            }
            break;
        case 'playerJoined':
        case 'playerLeft':
            // Reload game data to reflect changes
            loadGame(currentGame.id);
            break;
        case 'controlPointCreated':
            console.log('Control point created:', data.data);
            // Use appropriate function based on user role
            const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
            if (isOwner && window.addOwnerControlPointMarker) {
                window.addOwnerControlPointMarker(data.data);
            } else if (window.addPlayerControlPointMarker) {
                window.addPlayerControlPointMarker(data.data);
            }
            break;
        case 'controlPointUpdated':
            console.log('Control point updated - Full data:', data.data);
            console.log('Control point updated - Challenge fields:', {
                hasCodeChallenge: data.data.hasCodeChallenge,
                hasBombChallenge: data.data.hasBombChallenge,
                hasPositionChallenge: data.data.hasPositionChallenge,
                code: data.data.code,
                armedCode: data.data.armedCode,
                disarmedCode: data.data.disarmedCode,
                bombTime: data.data.bombTime
            });
            
            // Update the local control point data in currentGame
            if (currentGame && currentGame.controlPoints) {
                const controlPointIndex = currentGame.controlPoints.findIndex(cp => cp.id === data.data.id);
                if (controlPointIndex !== -1) {
                    currentGame.controlPoints[controlPointIndex] = data.data;
                    console.log('Updated local control point data with latest changes');
                } else {
                    console.log('Control point not found in currentGame.controlPoints, adding it');
                    currentGame.controlPoints.push(data.data);
                }
            } else {
                console.log('No currentGame.controlPoints array found, creating one');
                currentGame.controlPoints = [data.data];
            }
            
            // Refresh all control point markers to apply visual changes (circles, bomb emoji, etc.)
            const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
            if (userIsOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                console.log('Refreshing owner control point markers with updated settings');
                console.log('Control points to refresh:', currentGame.controlPoints.length);
                console.log('First control point:', currentGame.controlPoints[0]);
                window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
            } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                console.log('Refreshing player control point markers with updated settings');
                console.log('Control points to refresh:', currentGame.controlPoints.length);
                console.log('First control point:', currentGame.controlPoints[0]);
                window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
            } else {
                console.log('Using fallback method to update individual control point marker');
                // Fallback: Update existing marker individually
                map.eachLayer((layer) => {
                    if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === data.data.id) {
                        layer.controlPointData = data.data;
                        
                        // Use appropriate popup function based on user role
                        if (userIsOwner && window.createOwnerControlPointEditMenu) {
                            layer.bindPopup(window.createOwnerControlPointEditMenu(data.data, layer));
                        } else if (window.createPlayerControlPointMenu) {
                            layer.bindPopup(window.createPlayerControlPointMenu(data.data, layer));
                        }
                        
                        // Close popup if it's open
                        if (layer.isPopupOpen()) {
                            layer.closePopup();
                        }
                    }
                });
            }
            break;
        case 'controlPointDeleted':
            console.log('Control point deleted:', data.data);
            // Remove marker and position circle
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === data.data.controlPointId) {
                    // Remove position circle if exists
                    if (layer.positionCircle) {
                        map.removeLayer(layer.positionCircle);
                        console.log('Removed position circle for deleted control point:', layer.controlPointData.id);
                    }
                    map.removeLayer(layer);
                }
            });
            break;
        case 'controlPointTaken':
            // Show notification when a control point is taken
            if (data.data.userId !== currentUser.id) {
                showInfo(`${data.data.userName} ha tomado un punto de control`);
            }
            break;
        case 'playerTeamUpdated':
            handlePlayerTeamUpdate(data.data);
            
            // Update the affected player's data in currentGame
            if (currentGame && currentGame.players) {
                const playerIndex = currentGame.players.findIndex(p => p.id === data.data.playerId);
                if (playerIndex !== -1) {
                    currentGame.players[playerIndex].team = data.data.team;
                }
            }
            
            // Update player team selection interface for the affected user
            if (data.data.userId === currentUser.id && window.updatePlayerTeamSelection) {
                window.updatePlayerTeamSelection();
                // Also update user marker with new team color
                updateUserMarkerTeam();
            }
            break;
        case 'gameStateChanged':
            // Update game state and controls
            if (data.data && data.data.game) {
                const previousStatus = currentGame ? currentGame.status : null;
                currentGame = data.data.game;
                // Update current user's team information from game data
                updateCurrentUserTeam();
                updateGameInfo();
                
                // Show game summary dialog when game enters finished state
                if (currentGame.status === 'finished' && previousStatus !== 'finished') {
                    openGameSummaryDialog();
                }
                
                // Handle local timer based on game state
                if (currentGame.status !== 'running') {
                    if (localTimer) {
                        clearInterval(localTimer);
                        localTimer = null;
                        console.log('[FRONTEND] Local timer stopped - game not running');
                    }
                } else if (!localTimer && lastTimeUpdate) {
                    // Game is running, start local timer if not already running
                    console.log('[FRONTEND] Starting local timer - game resumed');
                    localTimer = setInterval(() => {
                        updateTimeDisplay();
                    }, 1000);
                }
                
                // Update player team selection when game state changes
                if (window.updatePlayerTeamSelection) {
                    window.updatePlayerTeamSelection();
                }
                
                // Update control point popups when game state changes
                const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                if (isOwner && window.updateOwnerControlPointPopups) {
                    console.log('Updating owner control point popups due to game state change');
                    window.updateOwnerControlPointPopups();
                } else if (window.updatePlayerControlPointPopups) {
                    console.log('Updating player control point popups due to game state change');
                    window.updatePlayerControlPointPopups();
                }
            }
            break;
        case 'teamCountUpdated':
            // Update game data and refresh team selection
            if (data.data && data.data.game) {
                currentGame = data.data.game;
                
                // Update only the team count and refresh team selection without full game reload
                // This prevents the teams dialog from closing
                updateGameInfo();
                
                // Update player team selection interface
                if (window.updatePlayerTeamSelection) {
                    window.updatePlayerTeamSelection();
                }
                
                // Reload players data for owner's dialog (this doesn't close the dialog)
                if (currentGame.owner && currentGame.owner.id === currentUser.id) {
                    loadPlayersData();
                }
            }
            break;
            
        case 'gameUpdated':
            // Handle complete game updates (including control points)
            if (data && data.game) {
                console.log('GameUpdated event received with full game data');
                console.log('Game control points count:', data.game.controlPoints ? data.game.controlPoints.length : 0);
                
                const previousGame = currentGame;
                currentGame = data.game;
                // Update current user's team information from game data
                updateCurrentUserTeam();
                updateGameInfo();

                // Always refresh control point markers with the latest data from server
                const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                if (userIsOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                    console.log('Refreshing owner control point markers due to game update with latest data');
                    console.log('Game update control points:', currentGame.controlPoints.length);
                    console.log('First control point:', currentGame.controlPoints[0]);
                    window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
                } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                    console.log('Refreshing player control point markers due to game update with latest data');
                    console.log('Game update control points:', currentGame.controlPoints.length);
                    console.log('First control point:', currentGame.controlPoints[0]);
                    window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
                }
            }
            break;
            
        case 'playerPositionsResponse':
            // Handle response with current player positions
            if (data.data && Array.isArray(data.data.positions)) {
                data.data.positions.forEach(position => {
                    if (position.userId !== currentUser.id) {
                        updatePlayerMarker(position);
                    }
                });
            }
            break;

        case 'timeUpdate':
            // Handle time updates (countdown or timer)
            console.log('Time update received:', data.data);
            if (data.data && data.data.remainingTime !== undefined) {
                updateTimeDisplay(data.data.remainingTime);
            }
            break;
        case 'gameTimeUpdated':
            // Update game data when time is changed
            if (data.data && data.data.game) {
                currentGame = data.data.game;
                // Sync the time selector with the new value
                if (window.syncTimeSelector) {
                    window.syncTimeSelector();
                }
            }
            break;
        case 'controlPointTeamAssigned':
            console.log('Control point team assigned:', data.data);
            // Update the local control point data with the new team assignment
            if (currentGame && currentGame.controlPoints) {
                const controlPointIndex = currentGame.controlPoints.findIndex(cp => cp.id === data.data.controlPointId);
                if (controlPointIndex !== -1) {
                    currentGame.controlPoints[controlPointIndex].ownedByTeam = data.data.team;
                    console.log('Updated local control point with team assignment:', data.data.team);
                }
            }
            
            // Refresh control point markers to show the new team assignment visually
            const isUserOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
            if (isUserOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                console.log('Refreshing owner control point markers with team assignment');
                window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
            } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                console.log('Refreshing player control point markers with team assignment');
                window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
            }
            break;
            
        default:
            console.log('Unhandled game action:', data.action);
    }
}

// Update game state controls based on current game status
function updateGameStateControls() {
    if (!currentGame) return;
    
    const status = currentGame.status || 'stopped';
    console.log('Updating game state controls for status:', status);
    
    const timeSelector = document.getElementById('timeSelectorContainer');
    const timeControls = document.getElementById('timeControls');
    const startBtn = document.getElementById('startGameBtn');
    const pauseBtn = document.getElementById('pauseGameBtn');
    const resumeBtn = document.getElementById('resumeGameBtn');
    const endBtn = document.getElementById('endGameBtn');
    const restartBtn = document.getElementById('restartGameBtn');
    
    // Reset all controls
    if (timeSelector) timeSelector.style.display = 'none';
    if (timeControls) timeControls.style.display = 'none';
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
    
    switch (status) {
        case 'stopped':
            console.log('Showing stopped state controls');
            if (timeSelector) timeSelector.style.display = 'block';
            if (startBtn) startBtn.style.display = 'block';
            break;
        case 'running':
            console.log('Showing running state controls');
            if (timeControls) timeControls.style.display = 'flex';
            if (pauseBtn) pauseBtn.style.display = 'block';
            // End button should NOT be visible in running state
            if (endBtn) endBtn.style.display = 'none';
            // Only close Teams Management dialog when game starts, not when team count is updated
            const teamsDialog = document.getElementById('teamsDialog');
            if (teamsDialog && teamsDialog.style.display === 'flex') {
                // Teams dialog is open, don't close it when updating team count
                console.log('Teams dialog is open, keeping it open for team management');
            } else {
                // Teams dialog is not open, close it normally when game starts
                closeTeamsDialog();
            }
            break;
        case 'paused':
            console.log('Showing paused state controls');
            if (timeControls) timeControls.style.display = 'flex';
            if (resumeBtn) resumeBtn.style.display = 'block';
            if (endBtn) endBtn.style.display = 'block';
            break;
        case 'finished':
            console.log('Showing finished state controls');
            // Show restart button in finished state
            if (restartBtn) restartBtn.style.display = 'block';
            break;
    }
    
    // Debug: Log current state of elements
    console.log('Controls state:', {
        timeSelector: timeSelector ? timeSelector.style.display : 'not found',
        timeControls: timeControls ? timeControls.style.display : 'not found',
        startBtn: startBtn ? startBtn.style.display : 'not found',
        pauseBtn: pauseBtn ? pauseBtn.style.display : 'not found',
        resumeBtn: resumeBtn ? resumeBtn.style.display : 'not found',
        endBtn: endBtn ? endBtn.style.display : 'not found'
    });
}

// Update game time
function updateGameTime(timeInSeconds) {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'updateGameTime',
            data: {
                timeInSeconds: timeInSeconds
            }
        });
        
        let timeText = 'indefinido';
        if (timeInSeconds > 0) {
            const minutes = timeInSeconds / 60;
            timeText = `${minutes} min`;
        }
        
        showSuccess(`Tiempo del juego actualizado: ${timeText}`);
    }
}

// Game state management functions
function startGame() {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'startGame'
        });
    }
}

function pauseGame() {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'pauseGame'
        });
    }
}

function resumeGame() {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'resumeGame'
        });
    }
}

function endGame() {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'endGame'
        });
    }
}

function restartGame() {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'restartGame'
        });
    }
}

function addTime(seconds) {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'addTime',
            data: {
                seconds: seconds
            }
        });
        
        const minutes = seconds / 60;
        showSuccess(`Se agregaron ${minutes} minutos al juego`);
    }
}

// Update user marker with current team
function updateUserMarkerTeam() {
    if (userMarker) {
        const currentPlayer = currentGame.players?.find(p => p.user.id === currentUser.id);
        const teamClass = currentPlayer?.team && currentPlayer.team !== 'none' ? currentPlayer.team : 'none';
        const currentPosition = userMarker.getLatLng();
        
        // Remove existing marker
        map.removeLayer(userMarker);
        
        // Create new marker with updated team class
        userMarker = L.marker(currentPosition, {
            icon: L.divIcon({
                className: `user-marker ${teamClass}`,
                iconSize: [24, 24],
            })
        }).addTo(map);
        
        // Create popup with custom class for positioning
        const popup = L.popup({
            className: 'user-marker-popup'
        }).setContent('<strong>Tú.</strong>');
        
        userMarker.bindPopup(popup);
    }
}

// Make functions available globally
window.openTeamsDialog = openTeamsDialog;
window.closeTeamsDialog = closeTeamsDialog;
window.setTeamCount = setTeamCount;
window.updatePlayerTeam = updatePlayerTeam;
window.updateGameTime = updateGameTime;
window.startGame = startGame;
window.pauseGame = pauseGame;
window.resumeGame = resumeGame;
window.updateUserMarkerTeam = updateUserMarkerTeam;
window.syncTimeSelector = syncTimeSelector;
// Sync time selector with current game time
function syncTimeSelector() {
    const timeSelector = document.getElementById('timeSelector');
    if (timeSelector && currentGame) {
        let selectedValue = '0'; // Default to indefinite
        
        if (currentGame.totalTime !== null && currentGame.totalTime !== undefined) {
            // Find the closest matching option
            const options = [
                { value: 20, label: '20 seg (test)' },
                { value: 300, label: '5 min' },
                { value: 600, label: '10 min' },
                { value: 1200, label: '20 min' },
                { value: 3600, label: '1 hora' },
                { value: 0, label: 'indefinido' }
            ];
            
            // Find exact match first
            const exactMatch = options.find(opt => opt.value === currentGame.totalTime);
            if (exactMatch) {
                selectedValue = exactMatch.value.toString();
            } else {
                // If no exact match, use the current value as is
                selectedValue = currentGame.totalTime.toString();
            }
        }
        
        timeSelector.value = selectedValue;
        console.log('Time selector synced to:', selectedValue, 'for game totalTime:', currentGame.totalTime);
    }
}

// Handle time updates from server and start local timer
function handleTimeUpdate(timeData) {
    console.log('Handling time update:', timeData);
    
    // Store the last time update from server
    lastTimeUpdate = {
        ...timeData,
        receivedAt: Date.now()
    };
    
    // Stop existing local timer
    if (localTimer) {
        clearInterval(localTimer);
        localTimer = null;
    }
    
    // Start local timer for smooth updates
    if (currentGame && currentGame.status === 'running') {
        console.log('[FRONTEND] Starting local timer');
        localTimer = setInterval(() => {
            updateTimeDisplay();
        }, 1000);
    }
    
    // Update display immediately with server data
    updateTimeDisplay();
}

// Update time display using local timer or server data
function updateTimeDisplay() {
    let timeData = lastTimeUpdate;
    
    if (!timeData) {
        console.log('No time data available');
        return;
    }
    
    const gameStatusElement = document.getElementById('gameStatus');
    const timePlayedElement = document.getElementById('timePlayed');
    const timeRemainingContainer = document.getElementById('timeRemainingContainer');
    const timeRemainingElement = document.getElementById('timeRemaining');
    
    if (gameStatusElement && timePlayedElement && timeRemainingContainer && timeRemainingElement) {
        // Calculate elapsed time since last server update
        let elapsedSinceUpdate = 0;
        if (timeData.receivedAt) {
            elapsedSinceUpdate = Math.floor((Date.now() - timeData.receivedAt) / 1000);
        }
        
        // Calculate current played time (server time + local elapsed time)
        const currentPlayedTime = timeData.playedTime + elapsedSinceUpdate;
        
        // Format time played
        const playedMinutes = Math.floor(currentPlayedTime / 60);
        const playedSeconds = currentPlayedTime % 60;
        const timePlayedText = `${playedMinutes}:${playedSeconds.toString().padStart(2, '0')}`;
        timePlayedElement.textContent = timePlayedText;
        
        // Handle remaining time
        if (timeData.remainingTime === null || timeData.remainingTime === undefined) {
            // Time indefinite - only show time played
            gameStatusElement.textContent = currentGame ? currentGame.status : 'indefinido';
            timeRemainingContainer.style.display = 'none';
        } else {
            // Time limited - show both time played and remaining
            const currentRemainingTime = Math.max(0, timeData.remainingTime - elapsedSinceUpdate);
            const minutes = Math.floor(currentRemainingTime / 60);
            const seconds = currentRemainingTime % 60;
            const timeRemainingText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Keep game status showing the actual game state
            gameStatusElement.textContent = currentGame ? currentGame.status : 'running';
            timeRemainingElement.textContent = timeRemainingText;
            timeRemainingContainer.style.display = 'block';
            
            // If time is up, stop local timer
            if (currentRemainingTime <= 0 && localTimer) {
                clearInterval(localTimer);
                localTimer = null;
                console.log('[FRONTEND] Local timer stopped - time expired');
            }
        }
        
        // Debug log every 10 seconds
        if (currentPlayedTime % 10 === 0) {
            console.log(`[FRONTEND] Local timer - Played: ${currentPlayedTime}s, Elapsed since update: ${elapsedSinceUpdate}s`);
        }
    }
}

// Open game summary dialog
function openGameSummaryDialog() {
    console.log('Attempting to open game summary dialog');
    const dialog = document.getElementById('gameSummaryDialog');
    if (dialog) {
        console.log('Game summary dialog found, setting display to flex');
        dialog.style.display = 'flex';
        updateGameSummaryContent();
    } else {
        console.error('Game summary dialog element not found!');
    }
}

// Close game summary dialog
function closeGameSummaryDialog() {
    document.getElementById('gameSummaryDialog').style.display = 'none';
}

// Update game summary content
function updateGameSummaryContent() {
    if (!currentGame) return;
    
    // Calculate duration (you can enhance this with actual game history data)
    const durationElement = document.getElementById('summaryDuration');
    const playersElement = document.getElementById('summaryPlayers');
    const teamsElement = document.getElementById('summaryTeams');
    const controlPointsElement = document.getElementById('summaryControlPoints');
    
    if (durationElement) {
        durationElement.textContent = 'Por implementar';
    }
    
    if (playersElement) {
        playersElement.textContent = currentGame.players ? currentGame.players.length : 0;
    }
    
    if (teamsElement) {
        teamsElement.textContent = currentGame.teamCount || 2;
    }
    
    if (controlPointsElement) {
        controlPointsElement.textContent = currentGame.controlPoints ? currentGame.controlPoints.length : 0;
    }
}

window.endGame = endGame;
window.restartGame = restartGame;
window.addTime = addTime;
window.updateTimeDisplay = updateTimeDisplay;
window.openGameSummaryDialog = openGameSummaryDialog;
window.closeGameSummaryDialog = closeGameSummaryDialog;

// Request current player positions (for owners)
function requestPlayerPositions() {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'requestPlayerPositions'
        });
    }
}

// Add team selection button to location info for players
function addTeamSelectionButton() {
    const locationInfo = document.querySelector('.location-info');
    if (!locationInfo) return;
    
    // Remove existing team button if any
    const existingButton = document.getElementById('playerTeamBtn');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Only show team selection button when game is stopped
    if (currentGame && currentGame.status === 'stopped') {
        // Create team selection button
        const teamButton = document.createElement('button');
        teamButton.id = 'playerTeamBtn';
        teamButton.className = 'btn btn-secondary';
        teamButton.style.cssText = 'margin-top: 10px; width: 100%;';
        teamButton.textContent = 'Sel Equipo';
        teamButton.onclick = function() {
            showPlayerTeamSelection();
        };
        
        locationInfo.appendChild(teamButton);
    }
}

// Game name editing functionality
function enableGameNameEdit() {
    const gameTitle = document.getElementById('gameTitle');
    const editPencil = document.getElementById('editPencil');
    
    if (!gameTitle || !editPencil) return;
    
    // Store original name
    const originalName = gameTitle.textContent;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'game-name-input';
    input.value = originalName;
    input.maxLength = 50;
    
    // Create save button (checkmark)
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-name-btn';
    saveBtn.textContent = '✓';
    saveBtn.title = 'Guardar';
    
    // Create cancel button (X)
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-name-btn';
    cancelBtn.textContent = '✗';
    cancelBtn.title = 'Cancelar';
    
    // Replace title with input and buttons
    gameTitle.style.display = 'none';
    editPencil.style.display = 'none';
    
    const container = gameTitle.parentElement;
    container.appendChild(input);
    container.appendChild(saveBtn);
    container.appendChild(cancelBtn);
    
    // Focus input
    input.focus();
    input.select();
    
    // Save function
    const saveName = async () => {
        const newName = input.value.trim();
        if (newName && newName !== originalName) {
            try {
                await updateGameName(newName);
            } catch (error) {
                showError('Error al actualizar el nombre: ' + error.message);
                // Restore original name on error
                gameTitle.textContent = originalName;
            }
        }
        exitEditMode();
    };
    
    // Cancel function
    const cancelEdit = () => {
        exitEditMode();
    };
    
    // Event listeners
    saveBtn.addEventListener('click', saveName);
    cancelBtn.addEventListener('click', cancelEdit);
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveName();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });
    
    // Exit edit mode function
    function exitEditMode() {
        // Remove input and buttons
        input.remove();
        saveBtn.remove();
        cancelBtn.remove();
        
        // Restore title and pencil
        gameTitle.style.display = 'block';
        editPencil.style.display = 'block';
    }
}

// Update game name via API
async function updateGameName(newName) {
    if (!currentGame) return;
    
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/games/${currentGame.id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al actualizar el nombre');
    }
    
    const updatedGame = await response.json();
    currentGame.name = updatedGame.name;
    document.getElementById('gameTitle').textContent = updatedGame.name;
    
    // Notify other players via WebSocket
    if (socket) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'gameUpdated',
            data: { game: updatedGame }
        });
    }
    
    showSuccess('Nombre del juego actualizado');
}

// Add event listener for edit pencil
document.addEventListener('DOMContentLoaded', function() {
    const editPencil = document.getElementById('editPencil');
    if (editPencil) {
        editPencil.addEventListener('click', enableGameNameEdit);
    }
});

// Make functions available globally
window.enableGameNameEdit = enableGameNameEdit;
window.updateGameName = updateGameName;

// Make functions available globally
window.updateCurrentUserTeam = updateCurrentUserTeam;

// Initialize when page loads
window.onload = initialize;