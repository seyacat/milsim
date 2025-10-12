// ES6 Module entry point for control-points-player functionality
import { initializeControlPointsPlayer } from './modules/control-points-player/index.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing control points player ES6 module');
    
    try {
        initializeControlPointsPlayer();
        console.log('Control points player ES6 module initialized successfully');
    } catch (error) {
        console.error('Error initializing control points player ES6 module:', error);
    }
});

// Export for potential external usage
export { initializeControlPointsPlayer };