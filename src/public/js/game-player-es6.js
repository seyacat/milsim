// ES6 Module entry point for game player functionality
import { initializePlayerFeatures } from './modules/game-player/index.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing game player ES6 module');
    
    try {
        initializePlayerFeatures();
        console.log('Game player ES6 module initialized successfully');
    } catch (error) {
        console.error('Error initializing game player ES6 module:', error);
    }
});

// Export for potential external usage
export { initializePlayerFeatures };