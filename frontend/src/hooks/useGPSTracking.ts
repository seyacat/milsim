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
  const lastKnownPositionRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const isSendingPeriodicUpdatesRef = useRef<boolean>(true);

  // Configuración del seguimiento GPS
  const config: GPSTrackingConfig = {
    detectionInterval: 10000, // 10 segundos
    periodicNotificationInterval: 10000, // 10 segundos
    timeoutDuration: 60000, // 1 minuto (cambiado de 3 minutos)
  };

  // Notificar posición al backend
  const notifyPositionToBackend = useCallback((position: { lat: number; lng: number; accuracy: number }) => {
    if (socket && currentGame) {
      console.log(`[GPS] Enviando positionUpdate al backend para juego ${currentGame.id}: ${position.lat}, ${position.lng}, accuracy: ${position.accuracy}`);
      socket.emit('gameAction', {
        gameId: currentGame.id,
        action: 'positionUpdate',
        data: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy
        }
      });
    } else {
      console.log(`[GPS] No se puede enviar positionUpdate: socket=${!!socket}, currentGame=${!!currentGame}`);
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
    lastKnownPositionRef.current = newPosition; // Almacenar última posición conocida
    setGpsStatus('Activo');

    // Reanudar envío periódico si estaba detenido
    if (!isSendingPeriodicUpdatesRef.current) {
      isSendingPeriodicUpdatesRef.current = true;
      setGpsStatus('Activo - Reanudando envío');
    }

    // Reiniciar el timeout de inactividad
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setGpsStatus('Inactivo - Sin señal GPS por 1 minuto');
      isSendingPeriodicUpdatesRef.current = false; // Detener envío periódico al backend
    }, config.timeoutDuration);
  }, [config.timeoutDuration]);

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
    // Verificar si debemos enviar actualizaciones periódicas
    if (!isSendingPeriodicUpdatesRef.current) {
      return; // No enviar si el GPS está inactivo por más de 1 minuto
    }

    // Usar la posición actual o la última posición conocida
    const positionToSend = currentPosition || lastKnownPositionRef.current;
    
    if (positionToSend && socket && currentGame) {
      const isLastKnown = !currentPosition;
      console.log(`[GPS] Enviando positionUpdate periódico al backend: ${positionToSend.lat}, ${positionToSend.lng}, accuracy: ${positionToSend.accuracy}, isLastKnown: ${isLastKnown}`);
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

  // Iniciar seguimiento GPS
  const startGPSTracking = useCallback(() => {
    // Verificar si ya hay un seguimiento activo
    if (watchIdRef.current !== null) {
      console.log('[GPS] Seguimiento GPS ya está activo, no se inicia uno nuevo');
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus('GPS no soportado');
      return;
    }

    setGpsStatus('Activando...');
    isSendingPeriodicUpdatesRef.current = true; // Asegurar que el envío periódico esté activo

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
        }
      },
      handlePositionError,
      options
    );

    console.log('[GPS] Seguimiento GPS iniciado correctamente');
  }, [handlePositionUpdate, handlePositionError, sendPeriodicPositionNotification, notifyPositionToBackend]);

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
    lastKnownPositionRef.current = null;
    isSendingPeriodicUpdatesRef.current = false;

    console.log('[GPS] Seguimiento GPS detenido correctamente');
  }, []);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      stopGPSTracking();
    };
  }, [stopGPSTracking]);

  // Iniciar automáticamente el seguimiento cuando el juego esté disponible
  useEffect(() => {
    if (currentGame && socket && !watchIdRef.current) {
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