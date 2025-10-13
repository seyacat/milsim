import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Game } from '../types';

interface UseGPSTrackingReturn {
  gpsStatus: string;
  currentPosition: { lat: number; lng: number; accuracy: number } | null;
  startGPSTracking: () => void;
  stopGPSTracking: () => void;
}

interface GPSTrackingConfig {
  detectionInterval: number; // Intervalo para detecciones GPS (10 segundos)
  periodicNotificationInterval: number; // Intervalo para notificaciones periódicas (10 segundos)
  timeoutDuration: number; // Tiempo sin detecciones para dejar de notificar (3 minutos)
}

export const useGPSTracking = (
  currentGame: Game | null,
  socket: Socket | null
): UseGPSTrackingReturn => {
  const [gpsStatus, setGpsStatus] = useState('Desconectado');
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastDetectionRef = useRef<number | null>(null);
  const periodicNotificationRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configuración del seguimiento GPS
  const config: GPSTrackingConfig = {
    detectionInterval: 10000, // 10 segundos
    periodicNotificationInterval: 10000, // 10 segundos
    timeoutDuration: 180000, // 3 minutos
  };

  // Notificar posición al backend
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

  // Notificar detección GPS al backend
  const notifyGPSDetection = useCallback((position: { lat: number; lng: number; accuracy: number }) => {
    if (socket && currentGame) {
      socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'gpsDetection',
        data: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          timestamp: Date.now()
        }
      });
    }
  }, [socket, currentGame]);

  // Manejar actualización de posición GPS
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const newPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    setCurrentPosition(newPosition);
    setGpsStatus('Activo');

    const now = Date.now();

    // Notificar detección GPS si ha pasado el intervalo
    if (!lastDetectionRef.current || (now - lastDetectionRef.current >= config.detectionInterval)) {
      notifyGPSDetection(newPosition);
      lastDetectionRef.current = now;
    }

    // Reiniciar el timeout de inactividad
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setGpsStatus('Inactivo - Sin detecciones recientes');
      // No detenemos el seguimiento, solo cambiamos el estado
    }, config.timeoutDuration);
  }, [notifyGPSDetection, config.detectionInterval, config.timeoutDuration]);

  // Manejar errores de GPS
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

  // Notificación periódica de posición
  const sendPeriodicPositionNotification = useCallback(() => {
    if (currentPosition && socket && currentGame) {
      socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'periodicPositionUpdate',
        data: {
          lat: currentPosition.lat,
          lng: currentPosition.lng,
          accuracy: currentPosition.accuracy,
          timestamp: Date.now(),
          type: 'periodic'
        }
      });
    }
  }, [currentPosition, socket, currentGame]);

  // Iniciar seguimiento GPS
  const startGPSTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS no soportado');
      return;
    }

    setGpsStatus('Activando...');

    // Configuración de alta precisión para GPS
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0 // Forzar actualizaciones frescas
    };

    // Iniciar seguimiento continuo
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      options
    );

    // Iniciar notificaciones periódicas
    periodicNotificationRef.current = setInterval(
      sendPeriodicPositionNotification,
      config.periodicNotificationInterval
    );

    // Obtener posición inicial
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionUpdate(position);
        // Notificar posición inicial inmediatamente
        if (position) {
          const initialPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          notifyPositionToBackend(initialPosition);
          notifyGPSDetection(initialPosition);
        }
      },
      handlePositionError,
      options
    );
  }, [handlePositionUpdate, handlePositionError, sendPeriodicPositionNotification, notifyPositionToBackend, notifyGPSDetection]);

  // Detener seguimiento GPS
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
  }, []);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      stopGPSTracking();
    };
  }, [stopGPSTracking]);

  // Iniciar automáticamente el seguimiento cuando el juego esté disponible
  useEffect(() => {
    if (currentGame && socket) {
      startGPSTracking();
    }
  }, [currentGame, socket, startGPSTracking]);

  return {
    gpsStatus,
    currentPosition,
    startGPSTracking,
    stopGPSTracking
  };
};