import { ref, watch, onUnmounted, type Ref } from 'vue'
import type { Game } from '../types'
import type { Socket } from 'socket.io-client'

interface GPSTrackingConfig {
  detectionInterval: number // Intervalo para detecciones GPS (10 segundos)
  periodicNotificationInterval: number // Intervalo para notificaciones periódicas (10 segundos)
  timeoutDuration: number // Tiempo sin detecciones para dejar de notificar (1 minuto)
}

interface UseGPSTrackingReturn {
  gpsStatus: Ref<string>
  currentPosition: Ref<{ lat: number; lng: number; accuracy: number } | null>
  startGPSTracking: () => void
  stopGPSTracking: () => void
}

export const useGPSTracking = (
  currentGame: Ref<Game | null>,
  socket: Ref<Socket | null> | Socket | null
): UseGPSTrackingReturn => {
  const gpsStatus = ref('Desconectado')
  const currentPosition = ref<{ lat: number; lng: number; accuracy: number } | null>(null)

  const watchId = ref<number | null>(null)
  const lastDetection = ref<number | null>(null)
  const periodicNotification = ref<NodeJS.Timeout | null>(null)
  const timeout = ref<NodeJS.Timeout | null>(null)
  const lastKnownPosition = ref<{ lat: number; lng: number; accuracy: number } | null>(null)
  const isSendingPeriodicUpdates = ref<boolean>(true)

  // Configuración del seguimiento GPS
  const config: GPSTrackingConfig = {
    detectionInterval: 10000, // 10 segundos
    periodicNotificationInterval: 10000, // 10 segundos
    timeoutDuration: 60000, // 1 minuto
  }

  // Notificar posición al backend
  const notifyPositionToBackend = (position: { lat: number; lng: number; accuracy: number }) => {
    const actualSocket = socket && typeof socket === 'object' && 'value' in socket ? socket.value : socket
    if (actualSocket && currentGame.value) {
      actualSocket.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'positionUpdate',
        data: {
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy
        }
      })
    } else {
      console.log(`[GPS] No se puede enviar positionUpdate: socket=${!!actualSocket}, currentGame=${!!currentGame.value}`)
    }
  }

  // Manejar actualización de posición GPS
  const handlePositionUpdate = (position: GeolocationPosition) => {
    const newPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    }

    currentPosition.value = newPosition
    lastKnownPosition.value = newPosition // Almacenar última posición conocida
    gpsStatus.value = 'Activo'

    // Reanudar envío periódico si estaba detenido
    if (!isSendingPeriodicUpdates.value) {
      isSendingPeriodicUpdates.value = true
      gpsStatus.value = 'Activo - Reanudando envío'
    }

    // Reiniciar el timeout de inactividad
    if (timeout.value) {
      clearTimeout(timeout.value)
    }

    timeout.value = setTimeout(() => {
      gpsStatus.value = 'Inactivo - Sin señal GPS por 1 minuto'
      isSendingPeriodicUpdates.value = false // Detener envío periódico al backend
    }, config.timeoutDuration)
  }

  // Manejar errores de GPS
  const handlePositionError = (error: GeolocationPositionError) => {
    let message = 'Error de GPS'
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Permiso denegado'
        break
      case error.POSITION_UNAVAILABLE:
        message = 'Ubicación no disponible'
        break
      case error.TIMEOUT:
        message = 'Tiempo agotado'
        break
    }
    gpsStatus.value = message
  }

  // Notificación periódica de posición
  const sendPeriodicPositionNotification = () => {
    // Verificar si debemos enviar actualizaciones periódicas
    if (!isSendingPeriodicUpdates.value) {
      return // No enviar si el GPS está inactivo por más de 1 minuto
    }

    // Usar la posición actual o la última posición conocida
    const positionToSend = currentPosition.value || lastKnownPosition.value
    
    const actualSocket = socket && typeof socket === 'object' && 'value' in socket ? socket.value : socket
    if (positionToSend && actualSocket && currentGame.value) {
      const isLastKnown = !currentPosition.value
      console.log(`[GPS] Sending position to backend:`, {
        lat: positionToSend.lat,
        lng: positionToSend.lng,
        accuracy: positionToSend.accuracy,
        gameId: currentGame.value.id
      })
      console.log(`[GPS] Emitting positionUpdate via WebSocket to game ${currentGame.value.id}:`, {
        lat: positionToSend.lat,
        lng: positionToSend.lng,
        accuracy: positionToSend.accuracy,
        isLastKnown: isLastKnown
      })
      actualSocket.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'positionUpdate',
        data: {
          lat: positionToSend.lat,
          lng: positionToSend.lng,
          accuracy: positionToSend.accuracy
        }
      })
    }
  }

  // Iniciar seguimiento GPS
  const startGPSTracking = () => {
    // Verificar si ya hay un seguimiento activo
    if (watchId.value !== null) {
      return
    }

    if (!navigator.geolocation) {
      gpsStatus.value = 'GPS no soportado'
      return
    }

    gpsStatus.value = 'Activando...'
    isSendingPeriodicUpdates.value = true // Asegurar que el envío periódico esté activo

    // Configuración de alta precisión para GPS
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0 // Forzar actualizaciones frescas
    }

    // Iniciar seguimiento continuo
    watchId.value = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      options
    )

    // Iniciar notificaciones periódicas
    periodicNotification.value = setInterval(
      sendPeriodicPositionNotification,
      config.periodicNotificationInterval
    )

    // Obtener posición inicial
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionUpdate(position)
        // Notificar posición inicial inmediatamente
        if (position) {
          const initialPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          }
          notifyPositionToBackend(initialPosition)
        }
      },
      (error) => {
        handlePositionError(error)
      },
      options
    )
  }

  // Detener seguimiento GPS
  const stopGPSTracking = () => {
    if (watchId.value !== null) {
      navigator.geolocation.clearWatch(watchId.value)
      watchId.value = null
    }

    if (periodicNotification.value) {
      clearInterval(periodicNotification.value)
      periodicNotification.value = null
    }

    if (timeout.value) {
      clearTimeout(timeout.value)
      timeout.value = null
    }

    gpsStatus.value = 'Detenido'
    currentPosition.value = null
    lastDetection.value = null
    lastKnownPosition.value = null
    isSendingPeriodicUpdates.value = false
  }

  // Limpiar recursos al desmontar
  onUnmounted(() => {
    stopGPSTracking()
  })

  // Iniciar automáticamente el seguimiento cuando el juego esté disponible
  watch([currentGame, () => {
    return socket && typeof socket === 'object' && 'value' in socket ? socket.value : socket
  }], ([game, sock]) => {
    if (game && sock && watchId.value === null) {
      startGPSTracking()
    }
  }, { immediate: true })

  return {
    gpsStatus,
    currentPosition,
    startGPSTracking,
    stopGPSTracking
  }
}