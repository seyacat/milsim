// Control points owner state management
export let controlPointMenuVisible = false;
export let mapClickHandler = null;
export let activeBombTimers = new Map();
export let bombTimerInterval = null;

// Setter function for mapClickHandler
export function setMapClickHandler(handler) {
    mapClickHandler = handler;
}