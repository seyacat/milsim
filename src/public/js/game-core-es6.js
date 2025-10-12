// Game Core ES6 Module - Modern version using ES6 modules
// This file maintains backward compatibility while using modern module system

// Import the main game core module
import initialize, { setupGlobalFunctions } from './modules/game-core/index.js';

// Setup global functions for backward compatibility
setupGlobalFunctions();

// Set the initialize function as the main entry point
window.initialize = initialize;

// Mark game core as loaded for other modules
window.gameCoreLoaded = true;

// Initialize when page loads (maintains existing behavior)
window.onload = function() {
    initialize();
    
    // Start periodic marker cleanup after initialization
    setTimeout(() => {
        if (window.startMarkerCleanupInterval) {
            window.startMarkerCleanupInterval();
        }
    }, 10000); // Start after 10 seconds
};

// Export for ES6 usage if needed
export { initialize };
export default initialize;

console.log('Game Core ES6 Module loaded successfully');