import { ref, watch, onUnmounted, type Ref } from 'vue'
import type { Game } from '../types'
import type { Socket } from 'socket.io-client'
import type { PositionUpdateData } from '../types/position-types'

interface GPSTrackingConfig {
  detectionInterval: number // Intervalo para detecciones GPS (10 segundos)
  periodicNotificationInterval: number // Intervalo para notificaciones periódicas (10 segundos)
  timeoutDuration: number // Tiempo sin detecciones para dejar de notificar (1 minuto)
}

interface UseGPSTrackingReturn {
  gpsStatus: Ref<string>
  currentPosition: Ref<PositionUpdateData | null>
  startGPSTracking: () => void
  stopGPSTracking: () => void
  updateLocalMarker: () => void
}

export const useGPSTracking = (
  currentGame: Ref<Game | null>,
  socket: Ref<Socket | null> | Socket | null | (() => Socket | null),
  onPositionUpdate?: (position: PositionUpdateData) => void
): UseGPSTrackingReturn => {
  const gpsStatus = ref('Desconectado')
  const currentPosition = ref<PositionUpdateData | null>(null)

  const watchId = ref<number | null>(null)
  const lastDetection = ref<number | null>(null)
  const periodicNotification = ref<NodeJS.Timeout | null>(null)
  const timeout = ref<NodeJS.Timeout | null>(null)
  const lastKnownPosition = ref<PositionUpdateData | null>(null)
  const isSendingPeriodicUpdates = ref<boolean>(true)
  const hasSentFirstPosition = ref<boolean>(false)
  const isWebSocketConnected = ref<boolean>(false)

  // Configuración del seguimiento GPS
  const config: GPSTrackingConfig = {
    detectionInterval: 10000, // 10 segundos
    periodicNotificationInterval: 10000, // 10 segundos
    timeoutDuration: 60000, // 1 minuto
  }

  // Notificar posición al backend
  const notifyPositionToBackend = (position: PositionUpdateData) => {
    let actualSocket: Socket | null = null
    
    // Handle different socket types
    if (typeof socket === 'function') {
      actualSocket = socket()
    } else if (socket && typeof socket === 'object' && 'value' in socket) {
      actualSocket = socket.value
    } else {
      actualSocket = socket as Socket | null
    }
    
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
    const newPosition: PositionUpdateData = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    }

    currentPosition.value = newPosition
    lastKnownPosition.value = newPosition // Almacenar última posición conocida
    gpsStatus.value = 'Activo'

    // Enviar posición inmediatamente si es la primera actualización y WebSocket está conectado
    if (!hasSentFirstPosition.value && isWebSocketConnected.value) {
      notifyPositionToBackend(newPosition)
      hasSentFirstPosition.value = true
      
      // Notificar actualización de posición localmente para actualizar el marcador propio
      if (onPositionUpdate) {
        onPositionUpdate(newPosition)
      }
    }

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
      gpsStatus.value = 'Inactivo'
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
    
    let actualSocket: Socket | null = null
    
    // Handle different socket types
    if (typeof socket === 'function') {
      actualSocket = socket()
    } else if (socket && typeof socket === 'object' && 'value' in socket) {
      actualSocket = socket.value
    } else {
      actualSocket = socket as Socket | null
    }
    
    if (positionToSend && actualSocket && currentGame.value) {
      const isLastKnown = !currentPosition.value
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

    gpsStatus.value = 'Iniciando'
    currentPosition.value = null
    lastDetection.value = null
    lastKnownPosition.value = null
    isSendingPeriodicUpdates.value = false
    hasSentFirstPosition.value = false
    isWebSocketConnected.value = false
  }

  // Limpiar recursos al desmontar
  onUnmounted(() => {
    stopGPSTracking()
  })

  // Iniciar automáticamente el seguimiento cuando el juego esté disponible
  watch([currentGame, () => {
    // Handle different socket types
    if (typeof socket === 'function') {
      return socket()
    } else if (socket && typeof socket === 'object' && 'value' in socket) {
      return socket.value
    } else {
      return socket as Socket | null
    }
  }], ([game, sock]) => {
    if (game && sock && watchId.value === null) {
      startGPSTracking()
      
      // Listen for WebSocket connection events
      const actualSocket = sock
      if (actualSocket) {
        // Check current connection status
        if (actualSocket.connected) {
          isWebSocketConnected.value = true
          sendPositionIfAvailable()
        }
        
        // Listen for connection events
        actualSocket.on('connect', () => {
          isWebSocketConnected.value = true
          sendPositionIfAvailable()
          
          // Actualizar marcador local inmediatamente cuando WebSocket se conecta
          if (currentPosition.value && onPositionUpdate) {
            onPositionUpdate(currentPosition.value)
          } else {
            console.log('[GPS] No se puede actualizar marcador local: currentPosition o onPositionUpdate no disponibles')
          }
        })
        
        actualSocket.on('disconnect', () => {
          isWebSocketConnected.value = false
        })
      }
    }
  }, { immediate: true })

  // Función para enviar posición si está disponible y WebSocket está conectado
  const sendPositionIfAvailable = () => {
    if (currentPosition.value && isWebSocketConnected.value && !hasSentFirstPosition.value) {
      notifyPositionToBackend(currentPosition.value)
      hasSentFirstPosition.value = true
      
      // Notificar actualización de posición localmente para actualizar el marcador propio
      if (onPositionUpdate) {
        onPositionUpdate(currentPosition.value)
      }
    }
  }

  // Función para actualizar marcador local manualmente
  const updateLocalMarker = () => {
    if (currentPosition.value && onPositionUpdate) {
      onPositionUpdate(currentPosition.value)
    }
  }

  return {
    gpsStatus,
    currentPosition,
    startGPSTracking,
    stopGPSTracking,
    updateLocalMarker
  }
}