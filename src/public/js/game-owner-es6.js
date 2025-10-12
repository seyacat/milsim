// ES6 Module entry point for game owner functionality
import { initializeOwnerFeatures } from './modules/game-owner/index.js';

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing game owner ES6 module');
    
    try {
        initializeOwnerFeatures();
        console.log('Game owner ES6 module initialized successfully');
    } catch (error) {
        console.error('Error initializing game owner ES6 module:', error);
    }
});

// Export for potential external usage
export { initializeOwnerFeatures };