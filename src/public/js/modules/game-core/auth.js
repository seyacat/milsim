// Authentication and game loading
import { setCurrentUser, setCurrentGame, setSocket } from './state.js';
import { showError, showSuccess } from './toast.js';
import { initMap } from './map.js';

// Check if user is logged in and get game ID from URL
export async function checkAuth() {
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
        setCurrentUser({
            id: payload.id || 1,
            name: payload.name || 'Usuario'
        });
    } catch (error) {
        // Fallback to dummy user if token decoding fails
        setCurrentUser({ id: 1, name: 'Usuario' });
    }
    
    // Initialize WebSocket connection
    initializeWebSocket(gameId);
    await loadGame(gameId);
    startGPS();
}

// Load game data
export async function loadGame(gameId) {
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
        const game = await response.json();
        setCurrentGame(game);
        
        // Update current user's team information from game data
        updateCurrentUserTeam();
        updateGameInfo();
        updatePlayerMarkers();
        loadControlPoints(gameId);
        
        // Reset position challenge timer when game is loaded
        resetPositionChallengeTimer();
        
        // Request initial control point time data if game is running
        const state = await getState();
        if (state.currentGame && state.currentGame.status === 'running' && state.socket) {
            // Game is running, requesting control point time data
            state.socket.emit('getControlPointTimes', { gameId: state.currentGame.id });
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

// Initialize WebSocket connection
export function initializeWebSocket(gameId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    // Get authentication token
    const token = localStorage.getItem('token');
    
    const socket = io(wsUrl, {
        auth: {
            token: token
        }
    });

    setSocket(socket);

    // WebSocket event handlers
    socket.on('connect', () => {
        console.log('WebSocket connected');
        
        // Join the game room
        socket.emit('joinGame', { gameId });
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });

    socket.on('gameUpdate', (game) => {
        console.log('Game update received:', game);
        setCurrentGame(game);
        updateGameInfo();
    });

    socket.on('controlPointUpdate', (controlPoint) => {
        console.log('Control point update received:', controlPoint);
        window.dispatchEvent(new CustomEvent('controlPointUpdated', { detail: controlPoint }));
    });

    socket.on('playerUpdate', (player) => {
        console.log('Player update received:', player);
        window.dispatchEvent(new CustomEvent('playerUpdated', { detail: player }));
    });

    socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        showToast('Error de conexión: ' + error.message, 'error');
    });
}

// Helper function to get state
function getState() {
    // Import state directly to avoid circular dependencies
    return import('./state.js').then(module => ({
        socket: module.socket,
        currentGame: module.currentGame
    }));
}

// Placeholder functions that would be implemented in other modules
function updateCurrentUserTeam() {
    // Implementation would be in a separate module
    console.log('updateCurrentUserTeam - placeholder');
}

function updateGameInfo() {
    console.log('updateGameInfo - updating game info');
    
    // Use the existing getState function to avoid dynamic import issues
    getState().then(state => {
        const currentGame = state.currentGame;
        const currentUser = state.currentUser;
        
        // Update basic game info in UI
        const gameTitle = document.getElementById('gameTitle');
        const gameStatus = document.getElementById('gameStatus');
        const playerCount = document.getElementById('playerCount');
        const gameOwner = document.getElementById('gameOwner');
        const currentUserElement = document.getElementById('currentUser');
        
        if (currentGame) {
            if (gameTitle) gameTitle.textContent = currentGame.name || 'Juego';
            if (gameStatus) gameStatus.textContent = currentGame.status || 'Cargando...';
            if (playerCount) {
                const players = currentGame.players || [];
                const activePlayers = players.filter(p => p && p.active !== false).length;
                playerCount.textContent = `${activePlayers}/${players.length}`;
            }
            if (gameOwner) gameOwner.textContent = currentGame.owner?.name || 'Propietario';
            
            // Update game control buttons based on game status
            updateGameControlButtons(currentGame.status);
        } else {
            if (gameTitle) gameTitle.textContent = 'Juego';
            if (gameStatus) gameStatus.textContent = 'Cargando...';
            if (playerCount) playerCount.textContent = '0/0';
            if (gameOwner) gameOwner.textContent = 'Cargando...';
            
            // Hide all game control buttons if no game data
            updateGameControlButtons(null);
        }
        
        if (currentUserElement) {
            currentUserElement.textContent = currentUser?.name || 'Usuario';
        }
    }).catch(error => {
        console.error('Error updating game info:', error);
        
        // Fallback to placeholder values
        const gameTitle = document.getElementById('gameTitle');
        const gameStatus = document.getElementById('gameStatus');
        const playerCount = document.getElementById('playerCount');
        const gameOwner = document.getElementById('gameOwner');
        const currentUserElement = document.getElementById('currentUser');
        
        if (gameTitle) gameTitle.textContent = 'Juego';
        if (gameStatus) gameStatus.textContent = 'Cargando...';
        if (playerCount) playerCount.textContent = '0/0';
        if (gameOwner) gameOwner.textContent = 'Cargando...';
        if (currentUserElement) currentUserElement.textContent = 'Usuario';
        
        // Hide all game control buttons on error
        updateGameControlButtons(null);
    });
}

// Update game control buttons visibility based on game status
function updateGameControlButtons(gameStatus) {
    const ownerControls = document.getElementById('ownerControls');
    const startGameBtn = document.getElementById('startGameBtn');
    const pauseGameBtn = document.getElementById('pauseGameBtn');
    const endGameBtn = document.getElementById('endGameBtn');
    const resumeGameBtn = document.getElementById('resumeGameBtn');
    const restartGameBtn = document.getElementById('restartGameBtn');
    
    // Show owner controls if we have game status
    if (ownerControls && gameStatus) {
        ownerControls.style.display = 'block';
    } else if (ownerControls) {
        ownerControls.style.display = 'none';
        return;
    }
    
    // Reset all buttons to hidden
    if (startGameBtn) startGameBtn.style.display = 'none';
    if (pauseGameBtn) pauseGameBtn.style.display = 'none';
    if (endGameBtn) endGameBtn.style.display = 'none';
    if (resumeGameBtn) resumeGameBtn.style.display = 'none';
    if (restartGameBtn) restartGameBtn.style.display = 'none';
    
    // Show appropriate buttons based on game status
    switch (gameStatus) {
        case 'waiting':
            if (startGameBtn) startGameBtn.style.display = 'block';
            if (endGameBtn) endGameBtn.style.display = 'block';
            break;
        case 'running':
            if (pauseGameBtn) pauseGameBtn.style.display = 'block';
            if (endGameBtn) endGameBtn.style.display = 'block';
            break;
        case 'paused':
            if (resumeGameBtn) resumeGameBtn.style.display = 'block';
            if (endGameBtn) endGameBtn.style.display = 'block';
            break;
        case 'ended':
            if (restartGameBtn) restartGameBtn.style.display = 'block';
            break;
        default:
            // Hide all buttons for unknown status
            break;
    }
}

function updatePlayerMarkers() {
    // Implementation would be in a separate module
    console.log('updatePlayerMarkers - placeholder');
}

function loadControlPoints(gameId) {
    console.log('Loading control points for game:', gameId);
    
    // Get control points from the current game data (already loaded in loadGame)
    const stateModule = import('./state.js');
    stateModule.then(module => {
        const currentGame = module.currentGame;
        
        if (!currentGame || !currentGame.controlPoints) {
            console.warn('No control points found in game data');
            return;
        }
        
        const controlPoints = currentGame.controlPoints;
        console.log('Control points loaded from game data:', controlPoints);
        
        // Dispatch event to notify other modules that control points are loaded
        window.dispatchEvent(new CustomEvent('controlPointsLoaded', {
            detail: { controlPoints, gameId }
        }));
        
        // Call the appropriate function to add markers based on the page type
        if (window.location.pathname.includes('owner.html')) {
            // Owner page - use owner functions
            if (typeof window.refreshOwnerControlPointMarkers === 'function') {
                console.log('Calling refreshOwnerControlPointMarkers with', controlPoints.length, 'control points');
                // Add a small delay to ensure the map and owner features are fully initialized
                setTimeout(() => {
                    window.refreshOwnerControlPointMarkers(controlPoints);
                }, 1000);
            } else {
                console.warn('refreshOwnerControlPointMarkers function not available');
                console.log('Available owner functions:', Object.keys(window).filter(key => key.includes('Owner') || key.includes('Control')));
            }
        } else if (window.location.pathname.includes('player.html')) {
            // Player page - use player functions
            if (typeof window.refreshControlPointMarkers === 'function') {
                window.refreshControlPointMarkers(controlPoints);
            } else {
                console.warn('refreshControlPointMarkers function not available');
            }
        }
    }).catch(error => {
        console.error('Error loading control points from state:', error);
        showToast('Error cargando puntos de control', 'error');
    });
}

function resetPositionChallengeTimer() {
    // Implementation would be in a separate module
    console.log('resetPositionChallengeTimer - placeholder');
}

function startControlPointTimerInterval() {
    // Implementation would be in a separate module
    console.log('startControlPointTimerInterval - placeholder');
}

function startGPS() {
    // Implementation would be in a separate module
    console.log('startGPS - placeholder');
    
    // Update GPS status
    const gpsStatus = document.getElementById('gpsStatus');
    if (gpsStatus) {
        gpsStatus.textContent = 'Obteniendo ubicación...';
    }
    
    // Simulate GPS initialization
    setTimeout(() => {
        if (gpsStatus) {
            gpsStatus.textContent = 'Ubicación obtenida';
        }
    }, 2000);
}