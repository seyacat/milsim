import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { Game } from '../types';
import { Socket } from 'socket.io-client';

interface GPSManagerProps {
  currentGame: Game | null;
  socket: Socket | null;
  children?: React.ReactNode;
}

interface GPSContextValue {
  gpsStatus: string;
  currentPosition: { lat: number; lng: number; accuracy: number } | null;
}

const GPSContext = createContext<GPSContextValue | null>(null);

export const useGPS = () => {
  const context = useContext(GPSContext);
  if (!context) {
    throw new Error('useGPS must be used within a GPSManager');
  }
  return context;
};

interface GPSTrackingConfig {
  detectionInterval: number;
  periodicNotificationInterval: number;
  timeoutDuration: number;
}

export const GPSManager: React.FC<GPSManagerProps> = React.memo(({ currentGame, socket, children }) => {
  const gpsStatusRef = useRef('Desconectado');
  const currentPositionRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastDetectionRef = useRef<number | null>(null);
  const periodicNotificationRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownPositionRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const isSendingPeriodicUpdatesRef = useRef<boolean>(true);

  const config: GPSTrackingConfig = {
    detectionInterval: 10000,
    periodicNotificationInterval: 10000,
    timeoutDuration: 60000,
  };

  const notifyPositionToBackend = useCallback((position: { lat: number; lng: number; accuracy: number }) => {
    if (socket && currentGame) {
      socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'positionUpdate',
        data: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy
        }
      });
    }
  }, [socket, currentGame]);

  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const newPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    currentPositionRef.current = newPosition;
    lastKnownPositionRef.current = newPosition;
    gpsStatusRef.current = 'Activo';

    if (!isSendingPeriodicUpdatesRef.current) {
      isSendingPeriodicUpdatesRef.current = true;
      gpsStatusRef.current = 'Activo - Reanudando envío';
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      gpsStatusRef.current = 'Inactivo - Sin señal GPS por 1 minuto';
      isSendingPeriodicUpdatesRef.current = false;
    }, config.timeoutDuration);

    // Update GPS displays directly in DOM without causing re-render
    updateGPSDisplays(newPosition);
  }, [config.timeoutDuration]);

  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    let message = 'Error de GPS';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Permiso denegado';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Ubicación no disponible';
        break;
      case error.TIMEOUT:
        message = 'Tiempo agotado';
        break;
    }
    gpsStatusRef.current = message;
  }, []);

  const sendPeriodicPositionNotification = useCallback(() => {
    if (!isSendingPeriodicUpdatesRef.current) {
      return;
    }

    const positionToSend = currentPositionRef.current || lastKnownPositionRef.current;
    
    if (positionToSend && socket && currentGame) {
      socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'positionUpdate',
        data: {
          lat: positionToSend.lat,
          lng: positionToSend.lng,
          accuracy: positionToSend.accuracy
        }
      });
    }
  }, [socket, currentGame]);

  const startGPSTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      return;
    }

    if (!navigator.geolocation) {
      gpsStatusRef.current = 'GPS no soportado';
      return;
    }

    gpsStatusRef.current = 'Activando...';
    isSendingPeriodicUpdatesRef.current = true;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      options
    );

    periodicNotificationRef.current = setInterval(
      sendPeriodicPositionNotification,
      config.periodicNotificationInterval
    );

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionUpdate(position);
        if (position) {
          const initialPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          notifyPositionToBackend(initialPosition);
        }
      },
      handlePositionError,
      options
    );

  }, [handlePositionUpdate, handlePositionError, sendPeriodicPositionNotification, notifyPositionToBackend]);

  const stopGPSTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (periodicNotificationRef.current) {
      clearInterval(periodicNotificationRef.current);
      periodicNotificationRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    gpsStatusRef.current = 'Detenido';
    currentPositionRef.current = null;
    lastDetectionRef.current = null;
    lastKnownPositionRef.current = null;
    isSendingPeriodicUpdatesRef.current = false;

    // Clear GPS displays
    updateGPSDisplays(null);

  }, []);

  useEffect(() => {
    return () => {
      stopGPSTracking();
    };
  }, [stopGPSTracking]);

  useEffect(() => {
    if (currentGame && socket && !watchIdRef.current) {
      startGPSTracking();
    }
  }, [currentGame, socket, startGPSTracking]);

  // Update GPS displays directly in DOM
  const updateGPSDisplays = (position: { lat: number; lng: number; accuracy: number } | null) => {
    // Update GPS status display
    const gpsStatusElement = document.getElementById('gpsStatus');
    if (gpsStatusElement) {
      gpsStatusElement.textContent = gpsStatusRef.current;
    }

    // Update position displays
    const currentLatElement = document.getElementById('currentLat');
    const currentLngElement = document.getElementById('currentLng');
    const accuracyElement = document.getElementById('accuracy');

    if (position) {
      if (currentLatElement) currentLatElement.textContent = position.lat.toFixed(6);
      if (currentLngElement) currentLngElement.textContent = position.lng.toFixed(6);
      if (accuracyElement) accuracyElement.textContent = `${Math.round(position.accuracy)} metros`;
    } else {
      if (currentLatElement) currentLatElement.textContent = '';
      if (currentLngElement) currentLngElement.textContent = '';
      if (accuracyElement) accuracyElement.textContent = '';
    }
  };

  const contextValue: GPSContextValue = {
    gpsStatus: gpsStatusRef.current,
    currentPosition: currentPositionRef.current
  };

  return (
    <GPSContext.Provider value={contextValue}>
      {children}
    </GPSContext.Provider>
  );
});