// Toast notification system
import { TOAST_TYPES } from './constants.js';

// Create toast container if it doesn't exist
function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

// Show toast notification
export function showToast(message, type = 'info', duration = 5000) {
    const container = getToastContainer();

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Create toast content
    const toastContent = document.createElement('div');
    toastContent.className = 'toast-content';
    toastContent.textContent = message;
    
    // Create close button with proper event listener
    const closeButton = document.createElement('button');
    closeButton.className = 'toast-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    });
    
    // Append elements to toast
    toast.appendChild(toastContent);
    toast.appendChild(closeButton);

    // Add to container
    container.appendChild(toast);

    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                }, 300);
            }
        }, duration);
    }

    return toast;
}

// Toast utility functions
export function showSuccess(message, duration = 5000) {
    return showToast(message, TOAST_TYPES.SUCCESS, duration);
}

export function showError(message, duration = 5000) {
    return showToast(message, TOAST_TYPES.ERROR, duration);
}

export function showWarning(message, duration = 5000) {
    return showToast(message, TOAST_TYPES.WARNING, duration);
}

export function showInfo(message, duration = 5000) {
    return showToast(message, TOAST_TYPES.INFO, duration);
}