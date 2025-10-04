// Core game functionality - shared between owner and player
let currentUser = null;
let currentGame = null;
let socket = null;
let map = null;
let userMarker = null;
let playerMarkers = {};
let watchId = null;

// Initialize map and game
function initialize() {
    initMap();
    checkAuth();
}

// Initialize Leaflet map
function initMap() {
    map = L.map('map').setView([0, 0], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
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
        window.location.href = 'dashboard.html';
        return;
    }
    
    // In a real app, you would decode the JWT token to get user info
    // For now, we'll use a dummy user ID
    currentUser = { id: 1, name: 'Jugador' }; // This should come from the token
    
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
    });

    socket.on('gameUpdate', (data) => {
        console.log('Game update received:', data);
        // Update the game state when changes occur
        if (data.game) {
            currentGame = data.game;
            updateGameInfo();
            updatePlayerMarkers();
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
        updateGameInfo();
        updatePlayerMarkers();
    });

    socket.on('joinSuccess', (data) => {
        console.log('Successfully joined game room');
    });

    socket.on('joinError', (data) => {
        showError('Error al unirse al juego: ' + data.message);
    });
}

// Load game data
async function loadGame(gameId) {
    try {
        const response = await fetch(`/api/games/${gameId}`);
        if (!response.ok) {
            throw new Error('Error al cargar el juego');
        }
        currentGame = await response.json();
        updateGameInfo();
        updatePlayerMarkers();
        loadControlPoints(gameId);
    } catch (error) {
        showError('Error al cargar el juego: ' + error.message);
    }
}

// Load control points for the game
async function loadControlPoints(gameId) {
    try {
        // Clear existing control point markers
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker && layer.controlPointData) {
                map.removeLayer(layer);
            }
        });

        // Load control points from the game data
        if (currentGame && currentGame.controlPoints && Array.isArray(currentGame.controlPoints)) {
            currentGame.controlPoints.forEach(controlPoint => {
                if (window.addControlPointMarker) {
                    window.addControlPointMarker(controlPoint);
                }
            });
        }
    } catch (error) {
        console.error('Error loading control points:', error);
    }
}

// Update game information display
function updateGameInfo() {
    document.getElementById('gameTitle').textContent = currentGame.name;
    document.getElementById('gameStatus').textContent = currentGame.status;
    document.getElementById('playerCount').textContent = `${currentGame.players ? currentGame.players.length : 0}/${currentGame.maxPlayers}`;
    document.getElementById('gameOwner').textContent = currentGame.owner ? currentGame.owner.name : 'Desconocido';
    
    // Update controls visibility
    const isOwner = currentGame.owner && currentGame.owner.id === currentUser.id;
    const isPlayer = currentGame.players && currentGame.players.some(p => p.user.id === currentUser.id);
    
    if (isOwner) {
        document.getElementById('ownerControls').style.display = 'block';
        document.getElementById('leaveGameBtn').style.display = 'none';
        // Initialize owner-specific functionality
        if (window.initializeOwnerFeatures) {
            window.initializeOwnerFeatures();
        }
    } else if (isPlayer) {
        document.getElementById('leaveGameBtn').style.display = 'block';
        document.getElementById('ownerControls').style.display = 'none';
    }
}

// Update player markers on map
function updatePlayerMarkers() {
    // Clear existing markers
    Object.values(playerMarkers).forEach(marker => {
        if (marker) map.removeLayer(marker);
    });
    playerMarkers = {};

    // Check if we have valid game and players data
    if (!currentGame || !currentGame.players || !Array.isArray(currentGame.players)) {
        return;
    }

    // Add markers for all players
    currentGame.players.forEach(player => {
        // Skip if player data is incomplete
        if (!player || !player.user || !player.user.id) {
            return;
        }

        // For demo purposes, use random positions near the user
        // In a real app, players would send their actual GPS positions
        const lat = userMarker ? userMarker.getLatLng().lat + (Math.random() - 0.5) * 0.01 : 0;
        const lng = userMarker ? userMarker.getLatLng().lng + (Math.random() - 0.5) * 0.01 : 0;
        
        const isOwner = currentGame.owner && player.user.id === currentGame.owner.id;
        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: isOwner ? 'owner-marker' : 'player-marker',
                iconSize: isOwner ? [16, 16] : [12, 12],
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <strong>${player.user.name || 'Jugador'}</strong><br>
            ${isOwner ? 'Propietario' : 'Jugador'}
        `);
        
        playerMarkers[player.user.id] = marker;
    });
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
                userMarker = L.marker([lat, lng]).addTo(map);
                userMarker.bindPopup('<strong>Tu ubicación</strong>').openPopup();
                map.setView([lat, lng], 16);
            } else {
                userMarker.setLatLng([lat, lng]);
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

// Handle game actions from other players
function handleGameAction(data) {
    switch (data.action) {
        case 'positionUpdate':
            // Update other player positions
            if (data.from !== socket.id && playerMarkers[data.from]) {
                // In a real app, update marker position based on received data
                console.log('Position update from:', data.from, data.data);
            }
            break;
        case 'playerJoined':
        case 'playerLeft':
            // Reload game data to reflect changes
            loadGame(currentGame.id);
            break;
        case 'controlPointCreated':
            console.log('Control point created:', data.data);
            if (window.addControlPointMarker) {
                window.addControlPointMarker(data.data);
            }
            break;
        case 'controlPointUpdated':
            console.log('Control point updated:', data.data);
            // Update existing marker
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === data.data.id) {
                    layer.controlPointData = data.data;
                    layer.bindPopup(window.createControlPointEditMenu(data.data, layer));
                    // Close popup if it's open
                    if (layer.isPopupOpen()) {
                        layer.closePopup();
                    }
                }
            });
            break;
        case 'controlPointDeleted':
            console.log('Control point deleted:', data.data);
            // Remove marker
            map.eachLayer((layer) => {
                if (layer instanceof L.Marker && layer.controlPointData && layer.controlPointData.id === data.data.controlPointId) {
                    map.removeLayer(layer);
                }
            });
            break;
        default:
            console.log('Unhandled game action:', data.action);
    }
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
            const response = await fetch(`/api/games/${currentGame.id}/leave`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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
    if (confirm('¿Estás seguro de que quieres salir del juego?')) {
        window.location.href = 'dashboard.html';
    }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
    if (socket) {
        socket.disconnect();
    }
});

// Make toast functions available globally
window.showToast = showToast;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;

// Initialize when page loads
window.onload = initialize;