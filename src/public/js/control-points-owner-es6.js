// Control points owner ES6 module entry point
// This file provides ES6 module compatibility while maintaining backward compatibility

// Import the main control points owner module
import { initializeControlPointsOwner } from './modules/control-points-owner/index.js';

// Initialize the module when loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for game-core to be loaded first and also wait a bit for other modules
    const initializeWithDelay = () => {
        if (typeof window.gameCoreLoaded !== 'undefined' && window.gameCoreLoaded) {
            // Add a small delay to ensure all dependencies are ready
            setTimeout(() => {
                console.log('Initializing control points owner module...');
                initializeControlPointsOwner();
            }, 500);
        } else {
            // If game-core isn't loaded yet, wait for it
            const checkGameCore = setInterval(() => {
                if (typeof window.gameCoreLoaded !== 'undefined' && window.gameCoreLoaded) {
                    clearInterval(checkGameCore);
                    console.log('Game core loaded, initializing control points owner module...');
                    initializeControlPointsOwner();
                }
            }, 100);
        }
    };
    
    // Start initialization
    initializeWithDelay();
});

// Export for module usage
export { initializeControlPointsOwner };

// Mark as loaded for other modules
window.controlPointsOwnerLoaded = true;
console.log('Control points owner ES6 module loaded');