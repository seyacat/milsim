// PWA Installation and Service Worker Registration
class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        this.init();
    }

    init() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.setupStandaloneDetection();
    }

    // Register Service Worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Clear all caches first
                await this.clearServiceWorkerCache();
                
                // Unregister any existing service workers
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
                
                // Register new service worker
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });
                
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    // Clear service worker cache
    async clearServiceWorkerCache() {
        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // Handle install prompt
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Store the event for later use
            this.deferredPrompt = e;
            this.showInstallButton();
            
            // Don't prevent default - let the browser handle the prompt naturally
            // The install button will trigger the prompt when clicked
        });

        window.addEventListener('appinstalled', (e) => {
            this.deferredPrompt = null;
            this.hideInstallButton();
            this.showInstallSuccess();
        });

        // Also show install button if PWA is not already installed
        if (!this.isRunningStandalone() && this.isInstallable()) {
            this.showInstallButton();
        }
    }

    // Detect standalone mode
    setupStandaloneDetection() {
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        mediaQuery.addEventListener('change', (e) => {
            this.isStandalone = e.matches;
            if (this.isStandalone) {
                this.onStandaloneMode();
            }
        });

        if (this.isStandalone) {
            this.onStandaloneMode();
        }
    }

    // Show install button
    showInstallButton() {
        // Create install button if it doesn't exist
        if (!document.getElementById('pwa-install-btn')) {
            const installBtn = document.createElement('button');
            installBtn.id = 'pwa-install-btn';
            installBtn.className = 'pwa-install-btn';
            installBtn.innerHTML = '📱 Instalar App';
            installBtn.onclick = () => this.installApp();
            
            // Add styles
            const styles = `
                .pwa-install-btn {
                    position: fixed;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--primary);
                    color: var(--text-primary);
                    border: none;
                    border-radius: 8px;
                    padding: 6px 12px;
                    font-size: 12px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    z-index: 10000;
                    transition: all 0.3s ease;
                    backdrop-filter: blur(10px);
                    min-width: auto;
                    white-space: nowrap;
                }
                .pwa-install-btn:hover {
                    background: var(--primary-light);
                    transform: translateX(-50%) translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                }
                .pwa-install-btn.hidden {
                    display: none;
                }
            `;
            
            if (!document.getElementById('pwa-install-styles')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'pwa-install-styles';
                styleSheet.textContent = styles;
                document.head.appendChild(styleSheet);
            }
            
            document.body.appendChild(installBtn);
        }
    }

    // Hide install button
    hideInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.classList.add('hidden');
        }
    }

    // Install app
    async installApp() {
        if (this.deferredPrompt) {
            try {
                // Show the install prompt
                this.deferredPrompt.prompt();
                
                // Wait for the user to respond to the prompt
                const { outcome } = await this.deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                } else {
                    console.log('User dismissed the install prompt');
                }
                
                // Clear the deferredPrompt after use
                this.deferredPrompt = null;
                this.hideInstallButton();
            } catch (error) {
                console.error('Error showing install prompt:', error);
            }
        } else {
            console.log('No install prompt available');
        }
    }

    // Show install success message
    showInstallSuccess() {
        this.showToast('¡App instalada exitosamente!', 'success');
    }

    // Handle standalone mode
    onStandaloneMode() {
        // Add any standalone-specific logic here
        document.body.classList.add('standalone-mode');
    }

    // Show toast notification
    showToast(message, type = 'info') {
        // Use existing toast system if available, otherwise create simple toast
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            this.createSimpleToast(message, type);
        }
    }

    // Create simple toast for PWA messages
    createSimpleToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add styles if not already present
        if (!document.getElementById('pwa-toast-styles')) {
            const styles = `
                .pwa-toast {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--surface);
                    color: var(--text-primary);
                    padding: 12px 20px;
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border: 1px solid var(--border);
                }
                .pwa-toast.success {
                    background: var(--success);
                    color: white;
                }
                .pwa-toast.error {
                    background: var(--danger);
                    color: white;
                }
                .pwa-toast.info {
                    background: var(--info);
                    color: white;
                }
                .pwa-toast .toast-close {
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    font-size: 18px;
                }
            `;
            const styleSheet = document.createElement('style');
            styleSheet.id = 'pwa-toast-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }
        
        toast.classList.add('pwa-toast');
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3000);
    }


    // Check if PWA is installable
    isInstallable() {
        return this.deferredPrompt !== null;
    }

    // Check if running in standalone mode
    isRunningStandalone() {
        return this.isStandalone;
    }
}

// Initialize PWA installer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pwaInstaller = new PWAInstaller();
});

// Global function to clear service worker cache manually
window.clearPWACache = async function() {
    if (window.pwaInstaller) {
        await window.pwaInstaller.clearServiceWorkerCache();
    } else {
        console.error('PWA installer not initialized');
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAInstaller;
}