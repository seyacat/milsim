// Main module for game owner functionality
import { OWNER_FEATURES, OWNER_ACTIONS } from './constants.js';
import { initializeOwnerControlPoints, requestActiveBombTimers } from '../control-points-owner/index.js';
import { showToast, getCurrentGame } from '../game-core/index.js';

// Initialize owner features
export function initializeOwnerFeatures() {
    console.log('Initializing owner features');
    
    try {
        // Initialize owner control points functionality
        if (typeof initializeOwnerControlPoints === 'function') {
            initializeOwnerControlPoints();
            console.log('Owner control points initialized');
        } else {
            console.error('initializeOwnerControlPoints function not found!');
            showToast('Error initializando puntos de control', 'error');
        }
        
        // Request active bomb timers when game is running
        const currentGame = getCurrentGame();
        if (currentGame && currentGame.status === 'running') {
            setTimeout(() => {
                if (typeof requestActiveBombTimers === 'function') {
                    requestActiveBombTimers();
                    console.log('Requested active bomb timers');
                } else {
                    console.error('requestActiveBombTimers function not found!');
                }
            }, 1000);
        }
        
        // Set up owner-specific event listeners
        setupOwnerEventListeners();
        
        console.log('Owner features initialized successfully');
        
    } catch (error) {
        console.error('Error initializing owner features:', error);
        showToast('Error inicializando funciones de propietario', 'error');
    }
}

// Close teams dialog
export function closeTeamsDialog() {
    const teamsDialog = document.getElementById('teamsDialog');
    if (teamsDialog) {
        teamsDialog.style.display = 'none';
        console.log('Teams dialog closed');
    } else {
        console.warn('Teams dialog element not found');
    }
}

// Set up owner-specific event listeners
function setupOwnerEventListeners() {
    // Listen for game state changes
    window.addEventListener('gameStateChanged', (event) => {
        handleGameStateChange(event.detail);
    });
    
    // Listen for control point updates
    window.addEventListener('controlPointUpdated', (event) => {
        handleControlPointUpdate(event.detail);
    });
    
    // Listen for bomb timer updates
    window.addEventListener('bombTimerUpdated', (event) => {
        handleBombTimerUpdate(event.detail);
    });
    
    console.log('Owner event listeners set up');
}

// Handle game state changes
function handleGameStateChange(game) {
    console.log('Owner: Game state changed to', game.status);
    
    // Request bomb timers when game starts running
    if (game.status === 'running') {
        setTimeout(() => {
            if (typeof requestActiveBombTimers === 'function') {
                requestActiveBombTimers();
                console.log('Requested active bomb timers after game start');
            }
        }, 1500);
    }
}

// Handle control point updates
function handleControlPointUpdate(controlPoint) {
    // Owner-specific handling of control point updates
    console.log('Owner: Control point updated', controlPoint.id, controlPoint.name);
    
    // Update the specific control point marker and popup
    if (typeof window.updateSingleOwnerMarker === 'function') {
        window.updateSingleOwnerMarker(controlPoint);
    } else {
        console.warn('updateSingleOwnerMarker function not available');
    }
    
    // Update all open popups to reflect the latest state
    if (typeof window.updateOwnerControlPointPopups === 'function') {
        window.updateOwnerControlPointPopups();
    } else {
        console.warn('updateOwnerControlPointPopups function not available');
    }
}

// Handle bomb timer updates
function handleBombTimerUpdate(data) {
    // Owner-specific handling of bomb timer updates
    console.log('Owner: Bomb timer updated', data.controlPointId, data.bombTimer);
}

// Check if owner features are available
export function areOwnerFeaturesAvailable() {
    return typeof initializeOwnerControlPoints === 'function' && 
           typeof requestActiveBombTimers === 'function';
}

// Get owner feature status
export function getOwnerFeatureStatus() {
    const status = {};
    
    status[OWNER_FEATURES.CONTROL_POINTS] = typeof initializeOwnerControlPoints === 'function';
    status[OWNER_FEATURES.BOMB_TIMERS] = typeof requestActiveBombTimers === 'function';
    status[OWNER_FEATURES.TEAM_MANAGEMENT] = true; // Always available for owner
    
    return status;
}

// Global functions for HTML event handlers
window.initializeOwnerFeatures = initializeOwnerFeatures;
window.closeTeamsDialog = closeTeamsDialog;