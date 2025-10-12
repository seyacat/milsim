// Game state management
export let currentUser = null;
export let currentGame = null;
export let socket = null;
export let map = null;
export let userMarker = null;
export let playerMarkers = {};
export let watchId = null;
export let localTimer = null;
export let lastTimeUpdate = null;
export let controlPointTimer = null;
export let controlPointTimerData = {};

// State management functions
export function setCurrentUser(user) {
    currentUser = user;
}

export function setCurrentGame(game) {
    currentGame = game;
}

export function setSocket(socketInstance) {
    socket = socketInstance;
}

export function setMap(mapInstance) {
    map = mapInstance;
}

export function setUserMarker(marker) {
    userMarker = marker;
}

export function setPlayerMarkers(markers) {
    playerMarkers = markers;
}

export function setWatchId(id) {
    watchId = id;
}

export function setLocalTimer(timer) {
    localTimer = timer;
}

export function setLastTimeUpdate(time) {
    lastTimeUpdate = time;
}

export function setControlPointTimer(timer) {
    controlPointTimer = timer;
}

export function setControlPointTimerData(data) {
    controlPointTimerData = data;
}

// Utility functions for state management
export function clearAllTimers() {
    if (localTimer) {
        clearInterval(localTimer);
        localTimer = null;
    }
    if (controlPointTimer) {
        clearInterval(controlPointTimer);
        controlPointTimer = null;
    }
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

export function resetGameState() {
    currentUser = null;
    currentGame = null;
    socket = null;
    map = null;
    userMarker = null;
    playerMarkers = {};
    watchId = null;
    localTimer = null;
    lastTimeUpdate = null;
    controlPointTimer = null;
    controlPointTimerData = {};
}