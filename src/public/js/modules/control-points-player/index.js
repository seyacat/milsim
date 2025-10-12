// Main module for control-points-player functionality
import { TEAM_COLORS, TEAM_NAMES } from './constants.js';
import { GAME_STATUS } from '../game-core/constants.js';
import { activeBombTimers } from './state.js';
import { updateBombTimer, startBombTimer, stopBombTimer, updateBombTimerDisplay } from './bomb-timer.js';
import { startPositionChallenge, stopPositionChallenge } from './position-challenge.js';
import {
    addControlPointMarkerPlayer, 
    updateControlPointPopups, 
    updateControlPointPopupForBomb, 
    refreshControlPointMarkers,
    updateTimerDisplay,
    updatePositionChallengePieChart,
    updatePositionChallengeBars
} from './markers-popups.js';
import {
    requestPlayerControlPointData,
    handleChallengeResponse,
    canSubmitChallenges,
    getChallengeStatus,
    handlePositionChallengeSubmission
} from './challenge-submissions.js';
import { showToast, getMap, getSocket } from '../game-core/index.js';

// Global variables
let currentGame = null;
let map = null;
let socket = null;
let playerMarker = null;
let playerPosition = null;
let positionChallengeInterval = null;

// Initialize the control points player module
export function initializeControlPointsPlayer() {
    console.log('Initializing control points player module');
    
    try {
        // Get map and socket from game core
        map = getMap();
        socket = getSocket();
        
        if (!map) {
            console.warn('Map not available yet, retrying...');
            setTimeout(() => {
                map = getMap();
                if (map) {
                    console.log('Map obtained on retry');
                    setupPlayerLocationTracking();
                    setupEventListeners();
                    requestGameState();
                } else {
                    console.error('Map still not available after retry');
                }
            }, 1000);
            return;
        }
        
        if (!socket) {
            console.warn('Socket not available yet, retrying...');
            setTimeout(() => {
                socket = getSocket();
                if (socket) {
                    console.log('Socket obtained on retry');
                    setupPlayerLocationTracking();
                    setupEventListeners();
                    requestGameState();
                } else {
                    console.error('Socket still not available after retry');
                }
            }, 1000);
            return;
        }
        
        // Set up player location tracking
        setupPlayerLocationTracking();
        
        // Set up event listeners
        setupEventListeners();
        
        // Request initial game state
        requestGameState();
        
        console.log('Control points player module initialized successfully');
        
    } catch (error) {
        console.error('Error initializing control points player module:', error);
        showToast('Error inicializando módulo de jugador', 'error');
    }
}

// Set up player location tracking
function setupPlayerLocationTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                playerPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Update player marker on map
                updatePlayerMarker();
                
                // Handle automatic position challenges
                handleAutomaticPositionChallenges();
            },
            (error) => {
                console.error('Error getting location:', error);
                showToast('Error obteniendo ubicación', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    } else {
        showToast('Geolocalización no soportada', 'error');
    }
}

// Update player marker on map
function updatePlayerMarker() {
    if (!map || !playerPosition) return;
    
    // Remove existing player marker
    if (playerMarker) {
        map.removeLayer(playerMarker);
    }
    
    // Create new player marker
    playerMarker = L.marker([playerPosition.lat, playerPosition.lng], {
        icon: L.divIcon({
            className: 'player-marker',
            html: '<div style="background: #FF0000; border-radius: 50%; width: 12px; height: 12px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        })
    }).addTo(map);
    
    // Add popup to player marker
    playerMarker.bindPopup('Tu ubicación actual').openPopup();
}

// Handle automatic position challenges
function handleAutomaticPositionChallenges() {
    if (!currentGame || !currentGame.controlPoints || !playerPosition) return;
    
    currentGame.controlPoints.forEach(controlPoint => {
        if (controlPoint.hasPositionChallenge && currentGame.status === 'running') {
            // Calculate distance to control point
            const distance = calculateDistance(
                playerPosition.lat, playerPosition.lng,
                controlPoint.latitude, controlPoint.longitude
            );
            
            // If within range, submit position challenge
            if (distance <= controlPoint.minDistance) {
                handlePositionChallengeSubmission(controlPoint.id, playerPosition);
            }
        }
    });
}

// Calculate distance between two points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Set up event listeners
function setupEventListeners() {
    // Game state change events
    window.addEventListener('gameStateChanged', (event) => {
        handleGameStateChange(event.detail);
    });
    
    // Control point update events
    window.addEventListener('controlPointUpdated', (event) => {
        handleControlPointUpdate(event.detail);
    });
    
    // Bomb timer events
    window.addEventListener('bombTimerUpdated', (event) => {
        handleBombTimerUpdate(event.detail);
    });
    
    // Position challenge events
    window.addEventListener('positionChallengeUpdated', (event) => {
        handlePositionChallengeUpdate(event.detail);
    });
}

// Handle WebSocket messages
function handleWebSocketMessage(message) {
    try {
        const data = JSON.parse(message.data);
        
        switch (data.type) {
            case 'game_state':
                handleGameState(data.game);
                break;
                
            case 'control_point_update':
                handleControlPointUpdate(data.controlPoint);
                break;
                
            case 'bomb_timer_update':
                handleBombTimerUpdate(data);
                break;
                
            case 'position_challenge_update':
                handlePositionChallengeUpdate(data);
                break;
                
            case 'challenge_response':
                handleChallengeResponse(data);
                break;
                
            case 'error':
                showToast(data.message || 'Error', 'error');
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
}

// Handle game state
function handleGameState(game) {
    currentGame = game;
    
    // Update UI based on game state
    updateGameUI();
    
    // Refresh control point markers
    if (game.controlPoints) {
        refreshControlPointMarkers(game.controlPoints);
    }
    
    // Start/stop position challenge interval based on game status
    if (game.status === 'running') {
        startPositionChallengeInterval();
    } else {
        stopPositionChallengeInterval();
    }
    
    // Dispatch game state change event
    window.dispatchEvent(new CustomEvent('gameStateChanged', { detail: game }));
}

// Handle control point update
function handleControlPointUpdate(controlPoint) {
    if (!currentGame || !currentGame.controlPoints) return;
    
    // Update control point in current game
    const index = currentGame.controlPoints.findIndex(cp => cp.id === controlPoint.id);
    if (index !== -1) {
        currentGame.controlPoints[index] = { ...currentGame.controlPoints[index], ...controlPoint };
    }
    
    // Update UI
    updateControlPointPopups();
    updateTimerDisplay(controlPoint.id, controlPoint.ownedByTeam, controlPoint.displayTime);
    
    // Dispatch control point update event
    window.dispatchEvent(new CustomEvent('controlPointUpdated', { detail: controlPoint }));
}

// Handle bomb timer update
function handleBombTimerUpdate(data) {
    const { controlPointId, bombTimer } = data;
    
    if (bombTimer.isActive) {
        startBombTimer(controlPointId, bombTimer);
    } else {
        stopBombTimer(controlPointId);
    }
    
    // Update bomb timer display
    updateBombTimerDisplay();
    
    // Update control point popup for bomb state
    updateControlPointPopupForBomb(controlPointId);
    
    // Dispatch bomb timer update event
    window.dispatchEvent(new CustomEvent('bombTimerUpdated', { detail: data }));
}

// Handle position challenge update
function handlePositionChallengeUpdate(data) {
    const { controlPointId, teamPoints } = data;
    
    // Update pie chart
    updatePositionChallengePieChart(controlPointId, teamPoints);
    
    // Update position challenge bars
    updatePositionChallengeBars(controlPointId, teamPoints);
    
    // Dispatch position challenge update event
    window.dispatchEvent(new CustomEvent('positionChallengeUpdated', { detail: data }));
}

// Update game UI based on current state
function updateGameUI() {
    if (!currentGame) return;
    
    // Update game status display
    const statusElement = document.getElementById('gameStatus');
    if (statusElement) {
        statusElement.textContent = `Estado: ${GAME_STATUS[currentGame.status] || currentGame.status}`;
    }
    
    // Update team scores if available
    if (currentGame.teams) {
        updateTeamScores(currentGame.teams);
    }
}

// Update team scores display
function updateTeamScores(teams) {
    const scoresContainer = document.getElementById('teamScores');
    if (!scoresContainer) return;
    
    scoresContainer.innerHTML = '';
    
    Object.entries(teams).forEach(([team, data]) => {
        const scoreElement = document.createElement('div');
        scoreElement.className = 'team-score';
        scoreElement.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 5px;
            padding: 5px;
            background: ${TEAM_COLORS[team]}20;
            border-radius: 4px;
        `;
        
        scoreElement.innerHTML = `
            <div style="width: 12px; height: 12px; background: ${TEAM_COLORS[team]}; border-radius: 50%; margin-right: 8px;"></div>
            <span style="font-weight: bold;">${TEAM_NAMES[team]}:</span>
            <span style="margin-left: 5px;">${data.score || 0} puntos</span>
        `;
        
        scoresContainer.appendChild(scoreElement);
    });
}

// Start position challenge interval
function startPositionChallengeInterval() {
    if (positionChallengeInterval) {
        clearInterval(positionChallengeInterval);
    }
    
    positionChallengeInterval = setInterval(() => {
        handleAutomaticPositionChallenges();
    }, 5000); // Check every 5 seconds
}

// Stop position challenge interval
function stopPositionChallengeInterval() {
    if (positionChallengeInterval) {
        clearInterval(positionChallengeInterval);
        positionChallengeInterval = null;
    }
}

// Request game state from server
function requestGameState() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'request_game_state'
        }));
    }
}

// Public API
export {
    currentGame,
    map,
    socket,
    playerMarker,
    playerPosition
};

// Getter functions
export function getCurrentGame() {
    return currentGame;
}

export function getPlayerPosition() {
    return playerPosition;
}