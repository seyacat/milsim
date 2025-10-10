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
let controlPointTimer = null;

// Global storage for control point timer data to persist across updates
let controlPointTimerData = {};

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
        // Join the game room
        socket.emit('joinGame', {
            gameId: parseInt(gameId)
        });
    });

    socket.on('disconnect', () => {
        showError('Conexión perdida con el servidor');
        // Don't redirect on disconnect - just show error
    });

    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        showError('Error de conexión con el servidor: ' + error.message);
        // Don't redirect on connection error - just show error
    });

    socket.on('gameUpdate', (data) => {
        // Update the game state when changes occur
        if (data.game) {
            currentGame = data.game;
            updateGameInfo();
            updatePlayerMarkers();
            
            // Debug: Check if this is a gameUpdated event with control points
            if (data.type === 'gameUpdated' && data.game.controlPoints) {
                
                // Check if this is a bomb-related update that doesn't require full refresh
                const hasBombUpdates = data.game.controlPoints && data.game.controlPoints.some(cp =>
                    cp.hasBombChallenge ||
                    (cp.bombTimer && cp.bombTimer.isActive) ||
                    (cp.bombTimer && cp.bombTimer.remainingTime !== undefined)
                );
                
                if (hasBombUpdates) {
                    // For bomb updates, only update bomb timer display without full refresh
                    if (window.updateBombTimerDisplay) {
                        setTimeout(() => {
                            window.updateBombTimerDisplay();
                        }, 100);
                    }
                } else {
                    // For non-bomb updates, refresh control point markers when gameUpdate event contains control points
                    const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                    if (userIsOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                        // Refreshing owner control point markers from gameUpdate event
                        window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
                    } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                        // Refreshing player control point markers from gameUpdate event
                        window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
                    }
                }
            }
        }
    });

    socket.on('gameAction', (data) => {
        // Handle game actions from other players
        handleGameAction(data);
    });

    socket.on('gameActionError', (data) => {
        showError('Error: ' + data.error);
    });

    socket.on('gameState', (game) => {
        currentGame = game;
        // Update current user's team information from game data
        updateCurrentUserTeam();
        updateGameInfo();
        updatePlayerMarkers();
    });

    socket.on('joinSuccess', (data) => {
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
        
        // Request active bomb timers when joining the game
        if (socket && currentGame) {
            requestActiveBombTimers();
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
        if (data) {
            handleTimeUpdate(data);
        } else {
            // Handle case when there's no timer (unlimited game)
            handleTimeUpdate({ remainingTime: null, playedTime: 0, totalTime: null });
        }
    });

    socket.on('gameTime', (data) => {
        if (data) {
            handleTimeUpdate(data);
        } else {
            // Handle case when there's no timer (unlimited game)
            handleTimeUpdate({ remainingTime: null, playedTime: 0, totalTime: null });
        }
    });

    socket.on('gameTimeError', (data) => {
        console.error('Game time error:', data);
        showError('Error al obtener el tiempo del juego: ' + data.message);
    });

    socket.on('controlPointTimeUpdate', (data) => {
        // Control point time update received
        handleControlPointTimeUpdate(data);
    });

    socket.on('controlPointTimes', (data) => {
        handleControlPointTimes(data);
    });

    socket.on('controlPointTimesError', (error) => {
        console.error('Error getting control point times:', error);
    });

    socket.on('bombTimeUpdate', (data) => {
        handleBombTimeUpdateFromSocket(data);
    });

    socket.on('activeBombTimers', (data) => {
        handleActiveBombTimersFromSocket(data);
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
        // Update current user's team information from game data
        updateCurrentUserTeam();
        updateGameInfo();
        updatePlayerMarkers();
        loadControlPoints(gameId);
        
        // Request initial control point time data if game is running
        if (currentGame.status === 'running' && socket) {
            // Game is running, requesting control point time data
            socket.emit('getControlPointTimes', { gameId: currentGame.id });
            // Start control point timer interval
            startControlPointTimerInterval();
        }
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
        // Restore timer data from global storage before loading control points
        if (currentGame && currentGame.controlPoints && Object.keys(controlPointTimerData).length > 0) {
            currentGame.controlPoints.forEach(cp => {
                if (controlPointTimerData[cp.id]) {
                    cp.currentTeam = controlPointTimerData[cp.id].currentTeam;
                    cp.displayTime = controlPointTimerData[cp.id].displayTime;
                    cp.lastTimeUpdate = controlPointTimerData[cp.id].lastTimeUpdate;
                }
            });
        }
        
        // Use refresh functions to load all control points with proper visualizations
        const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
        if (isOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
            window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
        } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
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
        
        // Request active bomb timers after control points are loaded
        if (window.requestActiveBombTimers) {
            setTimeout(() => {
                window.requestActiveBombTimers();
            }, 1000);
        }
    } catch (error) {
        console.error('Error loading control points:', error);
    }
}

// Update current user's team information from game data
function updateCurrentUserTeam() {
    if (!currentGame || !currentUser) return;
    
    let currentPlayer = null;
    let team = 'none';
    
    // Find the current player in the game's players list
    if (currentGame.players && Array.isArray(currentGame.players)) {
        currentPlayer = currentGame.players.find(p => p && p.user && p.user.id === currentUser.id);
        if (currentPlayer) {
            team = currentPlayer.team || 'none';
        }
    }
    
    // If player not found but we have a current team stored, use that
    if (!currentPlayer && currentUser.team) {
        team = currentUser.team;
    } else if (currentPlayer) {
        // Update current user with team information
        currentUser.team = team;
    } else {
        currentUser.team = 'none';
    }
    
    // Refresh player markers to update colors based on new team
    updatePlayerMarkers();
    updateUserMarkerTeam();
    
    // If user marker doesn't exist but we have GPS position, create it
    if (!userMarker && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                createUserMarker(lat, lng);
            },
            (error) => {
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 60000
            }
        );
    }
}

// Update game information display
function updateGameInfo() {
    // Update basic game info elements safely
    const gameTitle = document.getElementById('gameTitle');
    if (gameTitle) gameTitle.textContent = currentGame.name;
    
    // Show/hide edit pencil for game owner
    const editPencil = document.getElementById('editPencil');
    if (editPencil) {
        const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
        editPencil.style.display = isOwner ? 'block' : 'none';
    }
    
    const gameStatus = document.getElementById('gameStatus');
    if (gameStatus) gameStatus.textContent = currentGame.status;
    
    const playerCount = document.getElementById('playerCount');
    if (playerCount) playerCount.textContent = `${currentGame.activeConnections || 0}`;
    
    const gameOwner = document.getElementById('gameOwner');
    if (gameOwner) gameOwner.textContent = currentGame.owner ? currentGame.owner.name : 'Desconocido';
    
    const currentUserElement = document.getElementById('currentUser');
    if (currentUserElement) currentUserElement.textContent = currentUser ? currentUser.name : 'Desconocido';
    
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
    const isPlayer = currentGame.players && currentGame.players.some(p => p && p.user && p.user.id === currentUser.id);
    
    const ownerControls = document.getElementById('ownerControls');
    const playersBtn = document.getElementById('playersBtn');
    const timeSelectorContainer = document.getElementById('timeSelectorContainer');
    
    if (isOwner) {
        if (ownerControls) ownerControls.style.display = 'block';
        
        // Hide players button in finished state to prevent conflicts with summary dialog
        if (playersBtn) {
            if (currentGame.status === 'finished') {
                playersBtn.style.display = 'none';
            } else {
                playersBtn.style.display = 'block';
            }
        }
        
        // Update game state controls
        updateGameStateControls();
        
        // Sync time selector with current game time
        syncTimeSelector();
        
        // Initialize owner-specific functionality
        if (window.initializeOwnerFeatures) {
            window.initializeOwnerFeatures();
        }
        
        // Initialize team count buttons with current game data
        if (currentGame.teamCount) {
            setTeamCount(currentGame.teamCount, true);
        } else {
            setTeamCount(2, true);
        }
    } else if (isPlayer) {
        if (ownerControls) ownerControls.style.display = 'none';
        if (playersBtn) playersBtn.style.display = 'none';
        if (timeSelectorContainer) timeSelectorContainer.style.display = 'none';
        
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
        window.updateOwnerControlPointPopups();
    } else if (window.updatePlayerControlPointPopups) {
        window.updatePlayerControlPointPopups();
    }
    
    // Show game summary dialog if game is in finished state
    if (currentGame.status === 'finished') {
        
        // Open summary dialog for both owners and players
        setTimeout(() => {
            openGameSummaryDialog();
        }, 1000); // Small delay to ensure DOM is ready
    } else if (currentGame.status === 'stopped') {
        // Close game summary dialog when returning to stopped state (for all users)
        closeGameSummaryDialog();
    }
}

// Update player markers on map
function updatePlayerMarkers() {
    // Clear existing markers (except user's own marker) and destroy markers with null user IDs
    Object.entries(playerMarkers).forEach(([playerId, marker]) => {
        if (playerId !== currentUser.id.toString() && marker) {
            map.removeLayer(marker);
        }
        // Destroy markers with null or invalid user IDs
        if (!validateMarker(playerId, 'cleanup')) {
            if (marker) {
                map.removeLayer(marker);
                notifyMarkerDestruction(playerId, 'invalid_user_id');
            }
            delete playerMarkers[playerId];
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
        const currentPlayer = currentGame.players?.find(p => p && p.user && p.user.id === currentUser.id);
        
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
        const targetIsOwner = currentGame.owner && player.user && player.user.id === currentGame.owner.id;
        const teamClass = player.team && player.team !== 'none' ? player.team : 'none';
        const marker = L.marker([0, 0], {
            icon: L.divIcon({
                className: `player-marker ${teamClass}`,
                iconSize: [24, 24],
            })
        }).addTo(map);
        
        const teamInfo = player.team && player.team !== 'none' ? `<br>Equipo: ${player.team.toUpperCase()}` : '';
        
        marker.bindPopup(`
            <strong>${player.user?.name || 'Jugador'}</strong><br>
            ${targetIsOwner ? 'Propietario' : 'Jugador'}${teamInfo}<br>
            <em>Esperando posición GPS...</em>
        `);
        
        if (player.user && player.user.id) {
            if (validateMarker(player.user.id, 'marker_creation')) {
                playerMarkers[player.user.id] = marker;
            } else {
                // Destroy marker if user ID is invalid
                if (marker) {
                    map.removeLayer(marker);
                    notifyMarkerDestruction(player.user.id, 'invalid_user_id');
                }
            }
        } else {
            // Destroy marker if user ID is null
            if (marker) {
                map.removeLayer(marker);
                notifyMarkerDestruction('unknown', 'null_user_object');
            }
        }
    });
    
    // Debug: Log current player markers state
    Object.entries(playerMarkers).forEach(([playerId, marker]) => {
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
        const currentPlayer = currentGame.players?.find(p => p && p.user && p.user.id === currentUser.id);
        const targetPlayer = currentGame.players?.find(p => p && p.user && p.user.id === userId);
        
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

    // Validate user ID before proceeding
    if (!validateMarker(userId, 'marker_update')) {
        return;
    }

    let marker = playerMarkers[userId];
    const targetPlayer = currentGame.players?.find(p => p && p.user && p.user.id === userId);
    const teamClass = targetPlayer?.team && targetPlayer.team !== 'none' ? targetPlayer.team : 'none';
    
    if (!marker) {
        // Create new marker if it doesn't exist
        const targetIsOwner = currentGame.owner && userId === currentGame.owner.id;
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
                createUserMarker(lat, lng);
                
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

// Create or recreate user marker with current team
function createUserMarker(lat, lng) {
    // Remove existing marker if it exists
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    
    const currentPlayer = currentGame?.players?.find(p => p && p.user && p.user.id === currentUser.id);
    const teamClass = currentPlayer?.team && currentPlayer.team !== 'none' ? currentPlayer.team : 'none';
    
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
    
    // Create toast content
    const toastContent = document.createElement('div');
    toastContent.className = 'toast-content';
    toastContent.textContent = message;
    
    // Create close button with proper event listener
    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    });
    
    // Append elements to toast
    toast.appendChild(toastContent);
    toast.appendChild(closeButton);

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
    if (controlPointTimer) {
        clearInterval(controlPointTimer);
        controlPointTimer = null;
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
function setTeamCount(count, skipServerUpdate = false) {
    selectedTeamCount = count;
    
    // Update active state of buttons
    document.querySelectorAll('.team-count-btn').forEach(btn => {
        if (btn.dataset.count === count.toString()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Send team count update to server only when not skipping (for initialization)
    if (!skipServerUpdate && socket && currentGame) {
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
        
        // Sort players by name (connection status will be implemented when backend supports it)
        playersData.sort((a, b) => {
            const nameA = a.user?.name || '';
            const nameB = b.user?.name || '';
            return nameA.localeCompare(nameB);
        });
        
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
            <div class="player-name">${player?.user?.name || 'Jugador'}</div>
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
    const playerIndex = playersData.findIndex(p => p && p.id === data.playerId);
    if (playerIndex !== -1) {
        playersData[playerIndex].team = data.team;
        renderPlayersList();
    }
    
    // Update currentGame players data for team selection interface
    if (currentGame && currentGame.players) {
        const gamePlayerIndex = currentGame.players.findIndex(p => p && p.id === data.playerId);
        if (gamePlayerIndex !== -1) {
            currentGame.players[gamePlayerIndex].team = data.team;
        }
    }
    
    // Update player marker with new team color
    updatePlayerMarkerTeam(data.playerId, data.team);
    
    // If the current user is the one being updated, update their own marker and team data
    if (data.userId === currentUser.id) {
        // Update current user's team information
        updateCurrentUserTeam();
        // Update user marker with new team color
        updateUserMarkerTeam();
        // Force refresh of all player markers to update visibility rules
        updatePlayerMarkers();
    }
    
    // Show notification
    if (data.userId !== currentUser.id) {
        showInfo(`${data.userName} ha sido asignado al equipo ${data.team || 'none'}`);
    } else {
        showSuccess(`Has sido asignado al equipo ${data.team || 'none'}`);
    }
}

// Update player marker with new team
function updatePlayerMarkerTeam(playerId, team) {
    // Find the player by playerId to get the userId
    const targetPlayer = currentGame.players?.find(p => p && p.id === playerId);
    if (!targetPlayer) {
        return;
    }
    
    const userId = targetPlayer?.user?.id;
    if (!userId) {
        return;
    }
    
    // Validate user ID before proceeding
    if (!validateMarker(userId, 'marker_team_update')) {
        return;
    }

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
            setTeamCount(parseInt(this.dataset.count), false); // User clicks should trigger server updates
        });
    });
    
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
            // Use appropriate function based on user role
            const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
            if (isOwner && window.addOwnerControlPointMarker) {
                window.addOwnerControlPointMarker(data.data);
            } else if (window.addPlayerControlPointMarker) {
                window.addPlayerControlPointMarker(data.data);
            }
            break;
        case 'controlPointUpdated':
            
            // Update the local control point data in currentGame
            if (currentGame && currentGame.controlPoints) {
                const controlPointIndex = currentGame.controlPoints.findIndex(cp => cp.id === data.data.id);
                if (controlPointIndex !== -1) {
                    currentGame.controlPoints[controlPointIndex] = data.data;
                } else {
                    currentGame.controlPoints.push(data.data);
                }
            } else {
                currentGame.controlPoints = [data.data];
            }
            
            // Check if this is a bomb-related update that doesn't require full refresh
            const isBombUpdate = data.data.hasBombChallenge ||
                                (data.data.bombTimer && data.data.bombTimer.isActive) ||
                                (data.data.bombTimer && data.data.bombTimer.remainingTime !== undefined);
            
            if (isBombUpdate) {
                // For bomb updates, only update the individual marker without full refresh
                map.eachLayer((layer) => {
                    if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === data.data.id) {
                        layer.controlPointData = data.data;
                        
                        // Use appropriate popup function based on user role
                        const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
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
                
                // Update bomb timer display if available
                if (window.updateBombTimerDisplay) {
                    setTimeout(() => {
                        window.updateBombTimerDisplay();
                    }, 100);
                }
            } else {
                // For non-bomb updates, refresh all control point markers to apply visual changes
                const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                if (userIsOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                    window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
                } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                    window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
                } else {
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
            }
            break;
        case 'controlPointDeleted':
            // Remove marker and position circle
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === data.data.controlPointId) {
                    // Remove position circle if exists
                    if (layer.positionCircle) {
                        map.removeLayer(layer.positionCircle);
                    }
                    map.removeLayer(layer);
                }
            });
            break;
        case 'controlPointTaken':
            // Show notification when a control point is taken
            if (data.data.userId !== currentUser.id) {
                showInfo(`${data.data.userName} ha tomado un punto de control`);
            } else {
                showSuccess(`¡Has tomado el punto de control!`);
            }
            break;
        case 'playerTeamUpdated':
            handlePlayerTeamUpdate(data.data);
            
            // Update the affected player's data in currentGame
            if (currentGame && currentGame.players) {
                const playerIndex = currentGame.players.findIndex(p => p && p.id === data.data.playerId);
                if (playerIndex !== -1) {
                    currentGame.players[playerIndex].team = data.data.team;
                }
            }
            
            // Update player team selection interface for the affected user
            if (data.data.userId === currentUser.id && window.updatePlayerTeamSelection) {
                window.updatePlayerTeamSelection();
            }
            break;
        case 'gameStateChanged':
            // Update game state and controls
            if (data.data && data.data.game) {
                // Preserve timer data from current game before updating
                const preservedTimerData = {};
                const preservedControlPoints = currentGame ? currentGame.controlPoints : null;
                // Preserve current user's team data
                const preservedCurrentUserTeam = currentUser ? currentUser.team : null;
                const preservedCurrentPlayer = currentGame && currentGame.players ?
                    currentGame.players.find(p => p && p.user && p.user.id === currentUser.id) : null;
                
                if (currentGame && currentGame.controlPoints) {
                    currentGame.controlPoints.forEach(cp => {
                        if (cp.currentTeam || cp.displayTime) {
                            preservedTimerData[cp.id] = {
                                currentTeam: cp.currentTeam,
                                displayTime: cp.displayTime
                            };
                        }
                    });
                }
                
                const previousStatus = currentGame ? currentGame.status : null;
                currentGame = data.data.game;
                
                // If the new game data doesn't have control points, preserve the existing ones
                if (!currentGame.controlPoints && preservedControlPoints) {
                    currentGame.controlPoints = preservedControlPoints;
                }
                
                // Restore timer data to new control points
                if (currentGame.controlPoints && Object.keys(preservedTimerData).length > 0) {
                    let restoredCount = 0;
                    currentGame.controlPoints.forEach(cp => {
                        if (preservedTimerData[cp.id]) {
                            cp.currentTeam = preservedTimerData[cp.id].currentTeam;
                            cp.displayTime = preservedTimerData[cp.id].displayTime;
                            restoredCount++;
                        }
                    });
                }
                
                // Preserve current user's team in the new game data if not found
                if (preservedCurrentUserTeam && currentGame.players) {
                    const currentPlayerInNewGame = currentGame.players.find(p => p && p.user && p.user.id === currentUser.id);
                    if (!currentPlayerInNewGame && preservedCurrentPlayer) {
                        // Add the current player to the new game data if missing
                        currentGame.players.push(preservedCurrentPlayer);
                    } else if (currentPlayerInNewGame && preservedCurrentUserTeam) {
                        // Always restore team from preserved data to ensure consistency
                        currentPlayerInNewGame.team = preservedCurrentUserTeam;
                    }
                } else if (preservedCurrentUserTeam && (!currentGame.players || !Array.isArray(currentGame.players))) {
                    // If players array doesn't exist or is invalid, create it and add current player
                    currentGame.players = [preservedCurrentPlayer];
                }
                
                // Update current user's team information from game data
                updateCurrentUserTeam();
                updateGameInfo();
                
                // Force refresh user marker when game state changes to ensure correct team color
                if (userMarker) {
                    updateUserMarkerTeam();
                }
                
                // Show game summary dialog when game enters finished state
                if (currentGame.status === 'finished' && previousStatus !== 'finished') {
                    openGameSummaryDialog();
                    // Clear all timer data when game ends
                    clearAllControlPointTimerData();
                }
                
                // Handle local timer based on game state
                if (currentGame.status !== 'running') {
                    if (localTimer) {
                        clearInterval(localTimer);
                        localTimer = null;
                    }
                    if (controlPointTimer) {
                        clearInterval(controlPointTimer);
                        controlPointTimer = null;
                    }
                    // Stop control point timer interval when game is paused/stopped
                    stopControlPointTimerInterval();
                } else {
                    if (!localTimer && lastTimeUpdate) {
                        // Game is running, start local timer if not already running
                        localTimer = setInterval(() => {
                            updateTimeDisplay();
                        }, 1000);
                    }
                    if (!controlPointTimer) {
                        // Start control point timer
                        controlPointTimer = setInterval(() => {
                            updateAllTimerDisplays();
                        }, 1000);
                    }
                    // Start control point timer interval when game is running
                    startControlPointTimerInterval();
                    
                    // Force update all timer displays immediately when game resumes
                    updateAllTimerDisplays();
                    
                    // Request active bomb timers when game starts/resumes
                    if (window.requestActiveBombTimers) {
                        window.requestActiveBombTimers();
                    }
                    
                    // Refresh user marker when game starts to ensure correct team color
                    if (userMarker) {
                        updateUserMarkerTeam();
                    }
                    
                    // Force refresh of current user team data when game starts
                    // This ensures the user marker shows the correct team color
                    updateCurrentUserTeam();
                    
                    // Request control point time updates when game starts/resumes
                    if (socket) {
                        // The server should automatically send control point time updates
                        // when the game is running and control points are owned
                    }
                }
                
                // Update player team selection when game state changes
                if (window.updatePlayerTeamSelection) {
                    window.updatePlayerTeamSelection();
                }
                
                // Update control point popups when game state changes
                const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                if (isOwner && window.updateOwnerControlPointPopups) {
                    window.updateOwnerControlPointPopups();
                } else if (window.updatePlayerControlPointPopups) {
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
                
                // Preserve timer data from current game before updating
                const preservedTimerData = {};
                if (currentGame && currentGame.controlPoints) {
                    currentGame.controlPoints.forEach(cp => {
                        if (cp.currentTeam || cp.displayTime || cp.lastTimeUpdate) {
                            preservedTimerData[cp.id] = {
                                currentTeam: cp.currentTeam,
                                displayTime: cp.displayTime,
                                lastTimeUpdate: cp.lastTimeUpdate
                            };
                        }
                    });
                }
                
                const previousGame = currentGame;
                currentGame = data.game;
                
                // Restore timer data to new control points
                if (currentGame.controlPoints && Object.keys(preservedTimerData).length > 0) {
                    let restoredCount = 0;
                    currentGame.controlPoints.forEach(cp => {
                        if (preservedTimerData[cp.id]) {
                            cp.currentTeam = preservedTimerData[cp.id].currentTeam;
                            cp.displayTime = preservedTimerData[cp.id].displayTime;
                            cp.lastTimeUpdate = preservedTimerData[cp.id].lastTimeUpdate;
                            restoredCount++;
                        }
                    });
                }
                
                // Update current user's team information from game data
                updateCurrentUserTeam();
                updateGameInfo();

                // Check if this is a bomb-related update that doesn't require full refresh
                const hasBombUpdates = currentGame.controlPoints && currentGame.controlPoints.some(cp =>
                    cp.hasBombChallenge ||
                    (cp.bombTimer && cp.bombTimer.isActive) ||
                    (cp.bombTimer && cp.bombTimer.remainingTime !== undefined)
                );
                
                if (hasBombUpdates) {
                    // For bomb updates, only update bomb timer display without full refresh
                    if (window.updateBombTimerDisplay) {
                        setTimeout(() => {
                            window.updateBombTimerDisplay();
                        }, 100);
                    }
                } else {
                    // For non-bomb updates, refresh all control point markers with the latest data from server
                    const userIsOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
                    if (userIsOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                        window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
                    } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                        window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
                    }
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
            // Update the local control point data with the new team assignment
            if (currentGame && currentGame.controlPoints) {
                const controlPointIndex = currentGame.controlPoints.findIndex(cp => cp.id === data.data.controlPointId);
                if (controlPointIndex !== -1) {
                    currentGame.controlPoints[controlPointIndex].ownedByTeam = data.data.team;
                }
            }
            
            // Refresh control point markers to show the new team assignment visually
            const isUserOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
            if (isUserOwner && window.refreshOwnerControlPointMarkers && currentGame.controlPoints) {
                window.refreshOwnerControlPointMarkers(currentGame.controlPoints);
            } else if (window.refreshPlayerControlPointMarkers && currentGame.controlPoints) {
                window.refreshPlayerControlPointMarkers(currentGame.controlPoints);
            }
            
            // Also update the individual marker popup for owners to show the new team assignment
            if (isUserOwner && window.updateOwnerControlPointPopups) {
                window.updateOwnerControlPointPopups();
            }
            break;
            
        case 'bombActivated':
            // Show bomb activation success message
            if (data.data.userId === currentUser.id) {
                showSuccess('¡Bomba activada exitosamente!');
            } else {
                showInfo(`${data.data.userName} ha activado una bomba`);
            }
            break;
            
        case 'bombActivationError':
            // Show bomb activation error
            showError('Error al activar la bomba: ' + data.data.error);
            break;
            
        default:
    }
}

// Update game state controls based on current game status
function updateGameStateControls() {
    if (!currentGame) return;
    
    const status = currentGame.status || 'stopped';
    
    const timeSelector = document.getElementById('timeSelectorContainer');
    const timeControls = document.getElementById('timeControls');
    const startBtn = document.getElementById('startGameBtn');
    const pauseBtn = document.getElementById('pauseGameBtn');
    const resumeBtn = document.getElementById('resumeGameBtn');
    const endBtn = document.getElementById('endGameBtn');
    const restartBtn = document.getElementById('restartGameBtn');
    
    // Reset all controls safely
    if (timeSelector) timeSelector.style.display = 'none';
    if (timeControls) timeControls.style.display = 'none';
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = 'none';
    
    switch (status) {
        case 'stopped':
            if (timeSelector) timeSelector.style.display = 'block';
            if (startBtn) startBtn.style.display = 'block';
            break;
        case 'running':
            if (timeControls) timeControls.style.display = 'flex';
            if (pauseBtn) pauseBtn.style.display = 'block';
            // End button should NOT be visible in running state
            if (endBtn) endBtn.style.display = 'none';
            // Only close Teams Management dialog when game starts, not when team count is updated
            const teamsDialog = document.getElementById('teamsDialog');
            if (teamsDialog && teamsDialog.style.display === 'flex') {
                // Teams dialog is open, don't close it when updating team count
            } else {
                // Teams dialog is not open, close it normally when game starts
                closeTeamsDialog();
            }
            break;
        case 'paused':
            if (timeControls) timeControls.style.display = 'flex';
            if (resumeBtn) resumeBtn.style.display = 'block';
            if (endBtn) endBtn.style.display = 'block';
            break;
        case 'finished':
            // Show restart button in finished state
            if (restartBtn) restartBtn.style.display = 'block';
            break;
    }
    
    // Debug: Log current state of elements
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
        const currentPosition = userMarker.getLatLng();
        createUserMarker(currentPosition.lat, currentPosition.lng);
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
    }
}

// Handle time updates from server and start local timer
function handleTimeUpdate(timeData) {
    
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
    
    // Stop control point timer interval
    stopControlPointTimerInterval();
    
    // Start local timer for smooth updates
    if (currentGame && currentGame.status === 'running') {
        localTimer = setInterval(() => {
            updateTimeDisplay();
        }, 1000);
        
        // Start control point timer interval
        startControlPointTimerInterval();
        
        // Force update all timer displays immediately when time update is received
        updateAllTimerDisplays();
    }
    
    // Update display immediately with server data
    updateTimeDisplay();
}

// Update time display using local timer or server data
function updateTimeDisplay() {
    let timeData = lastTimeUpdate;
    
    if (!timeData) {
        return;
    }
    
    const gameStatusElement = document.getElementById('gameStatus');
    const timePlayedElement = document.getElementById('timePlayed');
    const timeRemainingContainer = document.getElementById('timeRemainingContainer');
    const timeRemainingElement = document.getElementById('timeRemaining');
    
    // Check if all required elements exist before proceeding
    if (!gameStatusElement || !timePlayedElement || !timeRemainingContainer || !timeRemainingElement) {
        return;
    }
    
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
        }
    }
    
    // Debug log every 10 seconds
    if (currentPlayedTime % 10 === 0) {
        console.log(`[FRONTEND] Local timer - Played: ${currentPlayedTime}s, Elapsed since update: ${elapsedSinceUpdate}s`);
    }
}

// Open game summary dialog
function openGameSummaryDialog() {
    
    const dialog = document.getElementById('gameSummaryDialog');
    if (dialog) {
        dialog.style.display = 'flex';
        updateGameSummaryContent();
        
        // Force a reflow to ensure the display change is applied
        dialog.offsetHeight;
    } else {
    }
}

// Close game summary dialog
function closeGameSummaryDialog() {
    const dialog = document.getElementById('gameSummaryDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

// Update game summary content
async function updateGameSummaryContent() {
    
    if (!currentGame) return;
    
    // Calculate duration using the game's played time
    const durationElement = document.getElementById('summaryDuration');
    const playersElement = document.getElementById('summaryPlayers');
    const teamsElement = document.getElementById('summaryTeams');
    const controlPointsElement = document.getElementById('summaryControlPoints');
    
    
    // Load game results first to get the accurate game duration from backend
    const results = await loadGameResults();
    
    if (durationElement) {
        let playedTime = 0;
        
        // Use the game duration from backend results if available
        if (results && results.gameDuration !== undefined) {
            playedTime = results.gameDuration;
        } else {
            // Fallback to local time data if backend duration is not available
            playedTime = currentGame.playedTime || 0;
            
            // If we have a last time update, use that as it's more accurate
            if (lastTimeUpdate && lastTimeUpdate.playedTime !== undefined) {
                playedTime = lastTimeUpdate.playedTime;
            }
        }
        
        // Format the time in minutes and seconds
        const minutes = Math.floor(playedTime / 60);
        const seconds = playedTime % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        durationElement.textContent = durationText;
    }
    
    if (playersElement) {
        const playerCount = currentGame.players ? currentGame.players.length : 0;
        playersElement.textContent = playerCount;
    }
    
    if (teamsElement) {
        const teamCount = currentGame.teamCount || 2;
        teamsElement.textContent = teamCount;
    }
    
    if (controlPointsElement) {
        const cpCount = currentGame.controlPoints ? currentGame.controlPoints.length : 0;
        controlPointsElement.textContent = cpCount;
    }
}

// Load game results and display them in the summary
async function loadGameResults() {
    try {
        
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/games/${currentGame.id}/results`, {
            headers: headers
        });
        
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[FRONTEND] Results error response:`, errorText);
            throw new Error('Error al cargar resultados del juego: ' + response.status);
        }
        
        const results = await response.json();
        displayGameResults(results);
        return results; // Return results for use in updateGameSummaryContent
    } catch (error) {
        console.error('Error loading game results:', error);
        // Show error message in results section
        const gameSummaryContent = document.getElementById('gameSummaryContent');
        if (gameSummaryContent) {
            const errorElement = document.createElement('div');
            errorElement.style.cssText = 'text-align: center; padding: 20px; color: #ff6b6b;';
            errorElement.textContent = 'Error al cargar resultados del juego: ' + error.message;
            gameSummaryContent.appendChild(errorElement);
        }
        return null; // Return null on error
    }
}

// Display game results in the summary dialog
function displayGameResults(results) {
    const gameSummaryContent = document.getElementById('gameSummaryContent');
    if (!gameSummaryContent) return;
    
    // Find the existing results container or create a new one
    let resultsContainer = document.getElementById('gameResultsContainer');
    
    if (resultsContainer) {
        // Update existing results container
        resultsContainer.innerHTML = '';
    } else {
        // Create new results container
        resultsContainer = document.createElement('div');
        resultsContainer.id = 'gameResultsContainer';
        resultsContainer.style.cssText = 'margin-top: 20px;';
        gameSummaryContent.appendChild(resultsContainer);
    }
    
    // Add results title
    const resultsTitle = document.createElement('h4');
    resultsTitle.textContent = 'Resultados por Equipos';
    resultsTitle.style.cssText = 'text-align: center; margin-bottom: 15px; color: white;';
    resultsContainer.appendChild(resultsTitle);
    
    // Create table
    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden;';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background: rgba(255, 255, 255, 0.2);';
    
    // Add control point name header
    const cpHeader = document.createElement('th');
    cpHeader.textContent = 'Punto de Control';
    cpHeader.style.cssText = 'padding: 10px; text-align: left; color: white; font-weight: bold; border-bottom: 1px solid rgba(255, 255, 255, 0.3);';
    headerRow.appendChild(cpHeader);
    
    // Add team headers
    const teams = results.teams || [];
    teams.forEach(team => {
        const teamHeader = document.createElement('th');
        teamHeader.textContent = team.toUpperCase();
        teamHeader.style.cssText = 'padding: 10px; text-align: center; color: white; font-weight: bold; border-bottom: 1px solid rgba(255, 255, 255, 0.3);';
        headerRow.appendChild(teamHeader);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Add control point rows
    const controlPoints = results.controlPoints || [];
    controlPoints.forEach(cp => {
        const row = document.createElement('tr');
        row.style.cssText = 'border-bottom: 1px solid rgba(255, 255, 255, 0.1);';
        
        // Control point name
        const cpCell = document.createElement('td');
        cpCell.textContent = cp.name;
        cpCell.style.cssText = 'padding: 10px; color: white;';
        row.appendChild(cpCell);
        
        // Team times
        teams.forEach(team => {
            const timeCell = document.createElement('td');
            const teamTimeSeconds = cp.teamTimes && cp.teamTimes[team] ? cp.teamTimes[team] : 0;
            const teamTimeFormatted = formatTime(teamTimeSeconds);
            timeCell.textContent = teamTimeFormatted;
            timeCell.style.cssText = 'padding: 10px; text-align: center; color: white;';
            row.appendChild(timeCell);
        });
        
        tbody.appendChild(row);
    });
    
    // Add totals row
    const totalsRow = document.createElement('tr');
    totalsRow.style.cssText = 'background: rgba(255, 255, 255, 0.2); font-weight: bold;';
    
    const totalsLabel = document.createElement('td');
    totalsLabel.textContent = 'TOTAL';
    totalsLabel.style.cssText = 'padding: 10px; color: white;';
    totalsRow.appendChild(totalsLabel);
    
    teams.forEach(team => {
        const totalCell = document.createElement('td');
        const teamTotalSeconds = results.teamTotals && results.teamTotals[team] ? results.teamTotals[team] : 0;
        const teamTotalFormatted = formatTime(teamTotalSeconds);
        totalCell.textContent = teamTotalFormatted;
        totalCell.style.cssText = 'padding: 10px; text-align: center; color: white;';
        totalsRow.appendChild(totalCell);
    });
    
    tbody.appendChild(totalsRow);
    table.appendChild(tbody);
    
    resultsContainer.appendChild(table);
    
    // Add player capture statistics table
    if (results.playerCaptureStats && results.playerCaptureStats.length > 0) {
        const playerStatsTitle = document.createElement('h4');
        playerStatsTitle.textContent = 'Puntos Tomados por Jugador';
        playerStatsTitle.style.cssText = 'text-align: center; margin: 30px 0 15px 0; color: white;';
        resultsContainer.appendChild(playerStatsTitle);
        
        const playerTable = document.createElement('table');
        playerTable.style.cssText = 'width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden;';
        
        // Create player table header
        const playerThead = document.createElement('thead');
        const playerHeaderRow = document.createElement('tr');
        playerHeaderRow.style.cssText = 'background: rgba(255, 255, 255, 0.2);';
        
        const playerNameHeader = document.createElement('th');
        playerNameHeader.textContent = 'Jugador';
        playerNameHeader.style.cssText = 'padding: 10px; text-align: left; color: white; font-weight: bold; border-bottom: 1px solid rgba(255, 255, 255, 0.3);';
        playerHeaderRow.appendChild(playerNameHeader);
        
        const teamHeader = document.createElement('th');
        teamHeader.textContent = 'Equipo';
        teamHeader.style.cssText = 'padding: 10px; text-align: center; color: white; font-weight: bold; border-bottom: 1px solid rgba(255, 255, 255, 0.3);';
        playerHeaderRow.appendChild(teamHeader);
        
        const capturesHeader = document.createElement('th');
        capturesHeader.textContent = 'Puntos Tomados';
        capturesHeader.style.cssText = 'padding: 10px; text-align: center; color: white; font-weight: bold; border-bottom: 1px solid rgba(255, 255, 255, 0.3);';
        playerHeaderRow.appendChild(capturesHeader);
        
        playerThead.appendChild(playerHeaderRow);
        playerTable.appendChild(playerThead);
        
        // Create player table body
        const playerTbody = document.createElement('tbody');
        
        // Sort players by capture count (descending)
        const sortedPlayers = [...results.playerCaptureStats].sort((a, b) => b.captureCount - a.captureCount);
        
        sortedPlayers.forEach(player => {
            const row = document.createElement('tr');
            row.style.cssText = 'border-bottom: 1px solid rgba(255, 255, 255, 0.1);';
            
            // Player name
            const nameCell = document.createElement('td');
            nameCell.textContent = player.userName;
            nameCell.style.cssText = 'padding: 10px; color: white;';
            row.appendChild(nameCell);
            
            // Team
            const teamCell = document.createElement('td');
            teamCell.textContent = player.team.toUpperCase();
            teamCell.style.cssText = 'padding: 10px; text-align: center; color: white;';
            row.appendChild(teamCell);
            
            // Capture count
            const capturesCell = document.createElement('td');
            capturesCell.textContent = player.captureCount;
            capturesCell.style.cssText = 'padding: 10px; text-align: center; color: white; font-weight: bold;';
            row.appendChild(capturesCell);
            
            playerTbody.appendChild(row);
        });
        
        playerTable.appendChild(playerTbody);
        resultsContainer.appendChild(playerTable);
    }
    
    // Update the game duration with the accurate value from backend results
    const durationElement = document.getElementById('summaryDuration');
    if (durationElement && results.gameDuration !== undefined) {
        const playedTime = results.gameDuration;
        const minutes = Math.floor(playedTime / 60);
        const seconds = playedTime % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        durationElement.textContent = durationText;
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
            if (window.showPlayerTeamSelection) {
                showPlayerTeamSelection();
            }
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

// Handle control point time updates
function handleControlPointTimeUpdate(data) {
    const { controlPointId, currentHoldTime, currentTeam, displayTime } = data;
    
    // Update the control point data in currentGame if it exists
    if (currentGame && currentGame.controlPoints) {
        const controlPointIndex = currentGame.controlPoints.findIndex(cp => cp.id === controlPointId);
        if (controlPointIndex !== -1) {
            // Replace the local timer value with the authoritative value from backend
            // This prevents duplicate counting when server sends updates
            currentGame.controlPoints[controlPointIndex].currentHoldTime = currentHoldTime;
            currentGame.controlPoints[controlPointIndex].currentTeam = currentTeam;
            currentGame.controlPoints[controlPointIndex].displayTime = displayTime;
            
            // Also update the ownedByTeam field which is used by the marker display logic
            currentGame.controlPoints[controlPointIndex].ownedByTeam = currentTeam;
            
            // Store timer data in global storage - this replaces any local incrementing
            controlPointTimerData[controlPointId] = {
                currentTeam,
                displayTime,
                currentHoldTime
            };
            
            // Update timer display immediately for this control point
            const timerElement = document.getElementById(`timer_${controlPointId}`);
            if (timerElement) {
                const isGameRunning = currentGame.status === 'running';
                if (isGameRunning && currentTeam) {
                    timerElement.style.display = 'block';
                    timerElement.textContent = displayTime || '00:00';
                } else {
                    timerElement.style.display = 'none';
                }
            }
        }
    }
    
    // Update all timer displays based on game state
    updateAllTimerDisplays();
    
    // Also update the control point popups to reflect the new ownership
    if (window.updatePlayerControlPointPopups) {
        window.updatePlayerControlPointPopups();
    }
    
    // Force update all timer displays after a short delay to ensure DOM is ready
    setTimeout(() => {
        updateAllTimerDisplays();
    }, 500);
}

// Handle initial control point times data
function handleControlPointTimes(data) {
    if (!currentGame || !currentGame.controlPoints) return;
    
    // Update all control points with their current hold times
    data.forEach(controlPointTime => {
        const { controlPointId, currentHoldTime, currentTeam, displayTime } = controlPointTime;
        
        const controlPointIndex = currentGame.controlPoints.findIndex(cp => cp.id === controlPointId);
        if (controlPointIndex !== -1) {
            // Update the control point with current hold time data from backend
            currentGame.controlPoints[controlPointIndex].currentHoldTime = currentHoldTime;
            currentGame.controlPoints[controlPointIndex].currentTeam = currentTeam;
            currentGame.controlPoints[controlPointIndex].displayTime = displayTime;
            
            // Also update the ownedByTeam field which is used by the marker display logic
            currentGame.controlPoints[controlPointIndex].ownedByTeam = currentTeam;
            
            // Store timer data in global storage
            controlPointTimerData[controlPointId] = {
                currentTeam,
                displayTime,
                currentHoldTime
            };
            
            // Update timer display immediately for this control point
            const timerElement = document.getElementById(`timer_${controlPointId}`);
            if (timerElement) {
                const isGameRunning = currentGame.status === 'running';
                if (isGameRunning && currentTeam) {
                    timerElement.style.display = 'block';
                    timerElement.textContent = displayTime || '00:00';
                } else {
                    timerElement.style.display = 'none';
                }
            }
        }
    });
    
    // Update all timer displays based on game state
    updateAllTimerDisplays();
    
    // Also update the control point popups to reflect the new ownership
    if (window.updatePlayerControlPointPopups) {
        window.updatePlayerControlPointPopups();
    }
    
    // Start the control point timer interval if game is running
    if (currentGame.status === 'running') {
        startControlPointTimerInterval();
    }
    
    // Force update all timer displays immediately when control point times are loaded
    updateAllTimerDisplays();
    
    // Force update all timer displays after a short delay to ensure DOM is ready
    setTimeout(() => {
        updateAllTimerDisplays();
    }, 500);
}

// Function to update all timer displays based on game state
function updateAllTimerDisplays() {
    if (!currentGame || !currentGame.controlPoints) {
        return;
    }
    
    const isGameRunning = currentGame.status === 'running';
    
    currentGame.controlPoints.forEach(controlPoint => {
        const timerElement = document.getElementById(`timer_${controlPoint.id}`);
        if (timerElement) {
            // Show timer only if game is running and control point is owned
            const hasCurrentTeam = controlPoint.currentTeam || controlPointTimerData[controlPoint.id]?.currentTeam;
            if (isGameRunning && hasCurrentTeam) {
                timerElement.style.display = 'block';
                
                // Get current display time from control point data
                let currentDisplayTime = controlPoint.displayTime || '00:00';
                
                // If we have timer data from global storage, use that
                if (controlPointTimerData[controlPoint.id] && controlPointTimerData[controlPoint.id].displayTime) {
                    currentDisplayTime = controlPointTimerData[controlPoint.id].displayTime;
                }
                
                timerElement.textContent = currentDisplayTime;
            } else {
                timerElement.style.display = 'none';
            }
        }
    });
}

// Start local timer interval for control point timers
function startControlPointTimerInterval() {
    // Clear any existing interval
    if (window.controlPointTimerInterval) {
        clearInterval(window.controlPointTimerInterval);
    }
    
    // Start new interval to update control point timer displays every second
    window.controlPointTimerInterval = setInterval(() => {
        if (currentGame && currentGame.status === 'running') {
            // Increment control point timers locally by 1 second each second
            // This provides smooth updates between server syncs
            incrementControlPointTimers();
            updateAllTimerDisplays();
        }
    }, 1000);
}

// Stop local timer interval for control point timers
function stopControlPointTimerInterval() {
    if (window.controlPointTimerInterval) {
        clearInterval(window.controlPointTimerInterval);
        window.controlPointTimerInterval = null;
    }
}

  // Increment control point timers locally by 1 second
  function incrementControlPointTimers() {
    if (!currentGame || !currentGame.controlPoints) return;
    
    const isGameRunning = currentGame.status === 'running';
    
    currentGame.controlPoints.forEach(controlPoint => {
      const hasCurrentTeam = controlPoint.currentTeam || controlPointTimerData[controlPoint.id]?.currentTeam;
      
      // Only increment timers for control points that are owned and game is running
      if (isGameRunning && hasCurrentTeam) {
        // Get current hold time from control point data or global storage
        let currentHoldTime = controlPoint.currentHoldTime || 0;
        
        // If we have timer data from global storage, use that
        if (controlPointTimerData[controlPoint.id] && controlPointTimerData[controlPoint.id].currentHoldTime) {
          currentHoldTime = controlPointTimerData[controlPoint.id].currentHoldTime;
        }
        
        // Increment by 1 second
        currentHoldTime++;
        
        // Update both the control point data and global storage
        controlPoint.currentHoldTime = currentHoldTime;
        controlPoint.displayTime = formatTime(currentHoldTime);
        
        if (controlPointTimerData[controlPoint.id]) {
          controlPointTimerData[controlPoint.id].currentHoldTime = currentHoldTime;
          controlPointTimerData[controlPoint.id].displayTime = formatTime(currentHoldTime);
        } else {
          controlPointTimerData[controlPoint.id] = {
            currentTeam: controlPoint.currentTeam,
            currentHoldTime: currentHoldTime,
            displayTime: formatTime(currentHoldTime)
          };
        }
      }
    });
  }

  // Format time in mm:ss
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  // Clear timer data for a specific control point when it's no longer owned
  function clearControlPointTimerData(controlPointId) {
    if (controlPointTimerData[controlPointId]) {
      delete controlPointTimerData[controlPointId];
    }
  }
  
  // Clear all timer data when game ends
  function clearAllControlPointTimerData() {
    controlPointTimerData = {};
  }

// Make functions available globally
window.updateAllTimerDisplays = updateAllTimerDisplays;
window.startControlPointTimerInterval = startControlPointTimerInterval;
window.stopControlPointTimerInterval = stopControlPointTimerInterval;
window.incrementControlPointTimers = incrementControlPointTimers;
window.formatTime = formatTime;
window.clearControlPointTimerData = clearControlPointTimerData;
// Notify backend when markers are destroyed due to invalid user IDs
function notifyMarkerDestruction(userId, reason) {
    if (socket && currentGame) {
        socket.emit('gameAction', {
            gameId: currentGame.id,
            action: 'markerDestroyed',
            data: {
                userId: userId,
                reason: reason,
                timestamp: Date.now()
            }
        });
    }
}

// Clean up markers with invalid user IDs and notify backend
function cleanupInvalidMarkers() {
    let destroyedCount = 0;
    
    Object.entries(playerMarkers).forEach(([playerId, marker]) => {
        // Check for invalid user IDs
        if (!playerId || playerId === 'null' || playerId === 'undefined' || playerId === '0') {
            if (marker) {
                map.removeLayer(marker);
                notifyMarkerDestruction(playerId, 'invalid_user_id');
                destroyedCount++;
            }
            delete playerMarkers[playerId];
        }
    });
    
    if (destroyedCount > 0) {
        // Request backend to refresh markers list
        if (socket && currentGame) {
            socket.emit('gameAction', {
                gameId: currentGame.id,
                action: 'refreshMarkers'
            });
        }
    }
    
    return destroyedCount;
}

// Validate marker before any operation that requires user ID
function validateMarker(userId, operation) {
    if (!userId || userId === 'null' || userId === 'undefined' || userId === '0') {
        return false;
    }
    return true;
}

window.clearAllControlPointTimerData = clearAllControlPointTimerData;
window.createUserMarker = createUserMarker;
window.cleanupInvalidMarkers = cleanupInvalidMarkers;
window.validateMarker = validateMarker;

// Add periodic cleanup of invalid markers
function startMarkerCleanupInterval() {
    // Clean up every 30 seconds
    setInterval(() => {
        const destroyedCount = cleanupInvalidMarkers();
        if (destroyedCount > 0) {
            console.log(`Periodic cleanup destroyed ${destroyedCount} invalid markers`);
        }
    }, 30000);
}

// Handle bomb time updates from WebSocket
function handleBombTimeUpdateFromSocket(data) {
    
    // Call the bomb time update function from control-points-player.js
    if (window.handleBombTimeUpdate) {
        window.handleBombTimeUpdate(data);
    } else {
        console.warn('handleBombTimeUpdate function not found in control-points-player.js');
    }
}

// Request active bomb timers from server
function requestActiveBombTimers() {
    if (socket && currentGame) {
        socket.emit('getActiveBombTimers', { gameId: currentGame.id });
    }
}

// Handle active bomb timers response from WebSocket
function handleActiveBombTimersFromSocket(data) {
    // Call the active bomb timers function from control-points-player.js
    if (window.handleActiveBombTimers) {
        window.handleActiveBombTimers(data);
    } else {
        console.warn('handleActiveBombTimers function not found in control-points-player.js');
    }
}

// Initialize when page loads
window.onload = function() {
    initialize();
    // Start periodic marker cleanup after initialization
    setTimeout(startMarkerCleanupInterval, 10000); // Start after 10 seconds
};