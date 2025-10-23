import React, { useState, useEffect, useCallback, useRef } from 'react';
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

interface GPSTrackingConfig {
  detectionInterval: number;
  periodicNotificationInterval: number;
  timeoutDuration: number;
}

export const GPSManager: React.FC<GPSManagerProps> = ({ currentGame, socket, children }) => {
  const [gpsStatus, setGpsStatus] = useState('Desconectado');
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

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

    setCurrentPosition(newPosition);
    lastKnownPositionRef.current = newPosition;
    setGpsStatus('Activo');

    if (!isSendingPeriodicUpdatesRef.current) {
      isSendingPeriodicUpdatesRef.current = true;
      setGpsStatus('Activo - Reanudando envío');
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setGpsStatus('Inactivo - Sin señal GPS por 1 minuto');
      isSendingPeriodicUpdatesRef.current = false;
    }, config.timeoutDuration);
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
    setGpsStatus(message);
  }, []);

  const sendPeriodicPositionNotification = useCallback(() => {
    if (!isSendingPeriodicUpdatesRef.current) {
      return;
    }

    const positionToSend = currentPosition || lastKnownPositionRef.current;
    
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
  }, [currentPosition, socket, currentGame]);

  const startGPSTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('GPS no soportado');
      return;
    }

    setGpsStatus('Activando...');
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

    setGpsStatus('Detenido');
    setCurrentPosition(null);
    lastDetectionRef.current = null;
    lastKnownPositionRef.current = null;
    isSendingPeriodicUpdatesRef.current = false;

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

  return (
    <>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            gpsStatus,
            currentPosition
          } as any);
        }
        return child;
      })}
    </>
  );
};