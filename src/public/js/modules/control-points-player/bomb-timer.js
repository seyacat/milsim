// Bomb timer functionality for players
import { activeBombTimers, bombTimerInterval } from './state.js';
import { getCurrentGame } from '../game-core/index.js';
import { showToast } from '../game-core/index.js';

// Get references to global variables
const currentGame = getCurrentGame();

// Start bomb timer interval for local decrementing
export function startBombTimerInterval() {
    // Clear any existing interval
    if (bombTimerInterval) {
        clearInterval(bombTimerInterval);
    }
    
    // Start new interval to decrement bomb timers locally every second
    bombTimerInterval = setInterval(() => {
        decrementBombTimers();
        updateBombTimerDisplay();
    }, 1000);
}

// Stop bomb timer interval
export function stopBombTimerInterval() {
    if (bombTimerInterval) {
        clearInterval(bombTimerInterval);
        bombTimerInterval = null;
    }
}

// Decrement bomb timers locally by 1 second each second
export function decrementBombTimers() {
    // Only decrement if game is running
    if (!currentGame || currentGame.status !== 'running') {
        return;
    }
    
    activeBombTimers.forEach((bombTimer, controlPointId) => {
        // Only decrement if bomb is active and has remaining time
        if (bombTimer.isActive && bombTimer.remainingTime > 0) {
            bombTimer.remainingTime--;
            
            // If time reaches 0, mark as exploded
            if (bombTimer.remainingTime <= 0) {
                bombTimer.remainingTime = 0;
                // The server will send an exploded event, so we don't need to handle explosion here
            }
        }
    });
}

// Handle bomb time updates from server
export function handleBombTimeUpdate(data) {
    
    const { controlPointId, remainingTime, totalTime, isActive, activatedByUserId, activatedByUserName, activatedByTeam, exploded } = data;
    
    // Log when bomb timer receives value from server
    
    if (exploded) {
        // Bomb exploded - remove timer and show explosion notification
        activeBombTimers.delete(controlPointId);
        updateBombTimerDisplay();
        showToast(`Bomba explotó en el punto de control!`, 'error');
        
        // Stop bomb timer interval if no more active bombs
        if (activeBombTimers.size === 0) {
            stopBombTimerInterval();
        }
        return;
    }
    
    if (!isActive) {
        // Bomb timer is no longer active
        activeBombTimers.delete(controlPointId);
        updateBombTimerDisplay();
        
        // Stop bomb timer interval if no more active bombs
        if (activeBombTimers.size === 0) {
            stopBombTimerInterval();
        }
        return;
    }
    
    // Update or add bomb timer - replace the current value with server value
    activeBombTimers.set(controlPointId, {
        controlPointId,
        remainingTime, // This replaces any locally decremented value
        totalTime,
        isActive,
        activatedByUserId,
        activatedByUserName,
        activatedByTeam,
        lastUpdate: Date.now() // Store when we received this update
    });
    
    updateBombTimerDisplay();
    
    // Start bomb timer interval if not already running
    if (!bombTimerInterval && activeBombTimers.size > 0) {
        startBombTimerInterval();
    }
    
    // Debug: Check if bomb timer element exists
    const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
    if (!bombTimerElement) {
        
        // If bomb timer element doesn't exist, try to update again after a short delay
        // This handles cases where control point markers are still being created
        setTimeout(() => {
            updateBombTimerDisplay();
        }, 1000);
    }
}

// Update bomb timer display in the UI
export function updateBombTimerDisplay() {
    
    // Hide all bomb timers first
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.controlPointData) {
            const bombTimerElement = document.getElementById(`bomb_timer_${layer.controlPointData.id}`);
            if (bombTimerElement) {
                bombTimerElement.style.display = 'none';
            }
        }
    });
    
    // Show bomb timers for active bombs
    activeBombTimers.forEach((bombTimer, controlPointId) => {
        const bombTimerElement = document.getElementById(`bomb_timer_${controlPointId}`);
        
        if (bombTimerElement) {
            // Format time as MM:SS
            const minutes = Math.floor(bombTimer.remainingTime / 60);
            const seconds = bombTimer.remainingTime % 60;
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            bombTimerElement.textContent = formattedTime;
            
            // Show warning colors when time is running low
            if (bombTimer.remainingTime <= 60) {
                // Less than 1 minute - red background
                bombTimerElement.style.background = 'rgba(244, 67, 54, 0.9)';
            } else if (bombTimer.remainingTime <= 180) {
                // Less than 3 minutes - orange background
                bombTimerElement.style.background = 'rgba(255, 152, 0, 0.9)';
            } else {
                // Normal - red-orange background
                bombTimerElement.style.background = 'rgba(255, 87, 34, 0.9)';
            }
            
            bombTimerElement.style.display = 'block';
        } else {
            console.log(`Bomb timer element not found for control point ${controlPointId}`);
        }
    });
}

// Request active bomb timers when joining a game
export function requestActiveBombTimers() {
    if (socket && currentGame) {
        socket.emit('getActiveBombTimers', { gameId: currentGame.id });
    }
}

// Handle active bomb timers response
export function handleActiveBombTimers(serverBombTimers) {
    
    // Clear existing bomb timers
    activeBombTimers.clear();
    
    // Add all active bomb timers from the server
    if (serverBombTimers && Array.isArray(serverBombTimers)) {
        serverBombTimers.forEach(bombTimer => {
            activeBombTimers.set(bombTimer.controlPointId, {
                ...bombTimer,
                lastUpdate: Date.now() // Store when we received this update
            });
        });
    }
    
    // Update the display
    updateBombTimerDisplay();
    
    // Start or stop bomb timer interval based on active bombs
    if (activeBombTimers.size > 0) {
        startBombTimerInterval();
    } else {
        stopBombTimerInterval();
    }
}

// Start bomb timer for a control point
export function startBombTimer(controlPointId, bombTimer) {
    activeBombTimers.set(controlPointId, {
        ...bombTimer,
        lastUpdate: Date.now()
    });
    
    // Start bomb timer interval if not already running
    if (!bombTimerInterval && activeBombTimers.size > 0) {
        startBombTimerInterval();
    }
    
    updateBombTimerDisplay();
}

// Stop bomb timer for a control point
export function stopBombTimer(controlPointId) {
    activeBombTimers.delete(controlPointId);
    
    // Stop bomb timer interval if no more active bombs
    if (activeBombTimers.size === 0) {
        stopBombTimerInterval();
    }
    
    updateBombTimerDisplay();
}

// Update bomb timer (alias for handleBombTimeUpdate)
export function updateBombTimer(data) {
    handleBombTimeUpdate(data);
}

// Export functions to global scope for backward compatibility
export function setupGlobalFunctions() {
    window.handleBombTimeUpdate = handleBombTimeUpdate;
    window.updateBombTimerDisplay = updateBombTimerDisplay;
    window.requestActiveBombTimers = requestActiveBombTimers;
    window.handleActiveBombTimers = handleActiveBombTimers;
    window.startBombTimer = startBombTimer;
    window.stopBombTimer = stopBombTimer;
    window.updateBombTimer = updateBombTimer;
}