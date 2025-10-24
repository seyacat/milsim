
<template>
  <div class="game-owner-container">
    <div v-if="isLoading" class="loading">
      Cargando juego...
    </div>
    <div v-else-if="!currentGame || !currentUser" class="loading">
      Error al cargar el juego
    </div>
    <div v-else class="game-owner-layout">
      <!-- Map -->
      <div class="map-container">
        <div ref="mapRef" class="map"></div>
      </div>

      <!-- Game Overlay - Top Left -->
      <div class="game-overlay">
        <div class="game-info">
          <div class="game-title-container">
            <h2>{{ currentGame.name }}</h2>
            <span class="edit-pencil" @click="enableGameNameEdit" title="Editar nombre del juego">
              ✏️
            </span>
          </div>
          <div class="game-details">
            <div>
              Estado: <span>{{ getStatusText(currentGame.status) }}</span>
            </div>
            <div>
              Jugadores: <span>{{ currentGame.activeConnections || 0 }}</span>
            </div>
            <div>
              Propietario: <span>{{ currentUser.name }}</span>
            </div>
            <div>
              Usuario: <span>{{ currentUser.name }}</span>
            </div>
          </div>
        </div>
        
        <div class="game-details">
          GPS: <span>{{ gpsStatus }}</span>
        </div>
      </div>

      <!-- Location Info - Bottom Left -->
      <div class="location-info-panel">
        <div>Estado GPS: <span>{{ gpsStatus }}</span></div>
        <div>Lat: <span>{{ currentPosition ? currentPosition.lat.toFixed(6) : '-' }}</span></div>
        <div>Lng: <span>{{ currentPosition ? currentPosition.lng.toFixed(6) : '-' }}</span></div>
        <div>Precisión: <span>{{ currentPosition ? currentPosition.accuracy.toFixed(1) + 'm' : '-' }}</span></div>
        
        <div style="margin-top: 10px">
          <label style="color: white; font-size: 12px; display: block; margin-bottom: 5px">Tiempo:</label>
          <select
            style="width: 100%; padding: 5px; border-radius: 3px; background: #333; color: white; border: 1px solid #666"
            @change="handleTimeSelect"
            :value="defaultTimeValue"
          >
            <option value="20">20 seg (test)</option>
            <option value="300">5 min</option>
            <option value="600">10 min</option>
            <option value="1200">20 min</option>
            <option value="3600">1 hora</option>
            <option value="0">indefinido</option>
          </select>
        </div>
      </div>

      <!-- Map Controls - Top Right -->
      <div class="map-controls-panel">
        <button class="btn btn-secondary" @click="goBack" title="Volver al dashboard">←</button>
        <button class="btn btn-secondary" @click="reloadPage" title="Recargar página">⟳</button>
        <button
          class="btn btn-secondary"
          @click="centerOnUser"
          title="Centrar en usuario"
          :disabled="!currentPosition"
        >📍</button>
        <button class="btn btn-secondary" @click="centerOnSite" title="Centrar en Site">🏠</button>
        <button class="btn btn-secondary" @click="showPlayersDialog = true" title="Gestionar equipos">👥</button>
        <button class="btn btn-secondary" @click="openGameResultsDialog" title="Ver resultados">📊</button>
      </div>

      <!-- Control Panel - Bottom Right -->
      <div class="control-panel">
        <div id="ownerControls" style="display: block">
          <template v-if="currentGame.status === 'stopped'">
            <button
              id="startGameBtn"
              class="btn btn-primary"
              @click="startGame"
              style="display: block; width: 100%"
            >
              Iniciar
            </button>
          </template>
          
          <template v-else-if="currentGame.status === 'running'">
            <button
              id="pauseGameBtn"
              class="btn btn-warning"
              @click="pauseGame"
              style="display: block; width: 100%"
            >
              Pausar
            </button>
          </template>
          
          <template v-else-if="currentGame.status === 'paused'">
            <button
              id="endGameBtn"
              class="btn btn-danger"
              @click="endGame"
              style="display: block; width: 100%; margin-bottom: 10px"
            >
              Finalizar
            </button>
            <button
              id="resumeGameBtn"
              class="btn btn-primary"
              @click="resumeGame"
              style="display: block; width: 100%"
            >
              Reanudar
            </button>
          </template>
          
          <template v-else-if="currentGame.status === 'finished'">
            <button
              id="restartGameBtn"
              class="btn btn-primary"
              @click="restartGame"
              style="display: block; width: 100%"
            >
              Nuevo Juego
            </button>
          </template>
          
          <template v-else>
            <button
              id="endGameBtn"
              class="btn btn-danger"
              @click="endGame"
              style="display: block; width: 100%; margin-bottom: 10px"
            >
              Finalizar
            </button>
          </template>
        </div>
      </div>

      <!-- Players Dialog -->
      <PlayersDialog
        :isOpen="showPlayersDialog"
        :players="currentGame.players || []"
        :currentGameId="currentGame.id"
        :socket="socketRef"
        :teamCount="teamCount"
        @close="showPlayersDialog = false"
        @teamCountChange="updateTeamCount"
      />

      <!-- Control Point Menu -->
      <ControlPointMenu
        v-if="showControlPointMenu"
        :position="controlPointMenuPosition"
        @close="showControlPointMenu = false"
        @createControlPoint="createControlPoint"
      />

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AuthService } from '../services/auth.js'
import { GameService } from '../services/game.js'
import { User, Game, Player, TeamColor, ControlPoint } from '../types/index.js'
import { useToast } from '../composables/useToast.js'
import { io, Socket } from 'socket.io-client'
import PlayersDialog from './GameOwner/PlayersDialog.vue'
import ControlPointMenu from './GameOwner/ControlPointMenu.vue'
import { createPopupContent } from './GameOwner/popupUtils.js'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'

const route = useRoute()
const router = useRouter()
const { addToast } = useToast()

// Refs
const currentUser = ref<User | null>(null)
const currentGame = ref<Game | null>(null)
const isLoading = ref(true)
const socketRef = ref<Socket | null>(null)
const mapRef = ref<HTMLDivElement | null>(null)
const mapInstance = ref<any>(null)
const showPlayersDialog = ref(false)
const showControlPointMenu = ref(false)
const controlPointMenuPosition = ref({ lat: 0, lng: 0 })
const teamCount = ref(2)
const gpsStatus = ref('Desconectado')
const currentPosition = ref<any>(null)
const controlPointMarkers = ref<Map<number, any>>(new Map())
const positionCircles = ref<Map<number, any>>(new Map())
const pieCharts = ref<Map<number, any>>(new Map())

const gameId = route.params.gameId as string
const defaultTimeValue = 1200 // 20 minutes

// Map initialization
const initializeMap = async () => {
  if (!mapRef.value) return

  try {
    const L = await import('leaflet')
    
    // Fix for default markers in Leaflet
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
    
    // Initialize map
    mapInstance.value = L.map(mapRef.value, {
      zoomControl: true,
      maxZoom: 22,
      minZoom: 1
    }).setView([0, 0], 13)

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance.value)

    // Add click handler for creating control points
    mapInstance.value.on('click', (e: any) => {
      controlPointMenuPosition.value = e.latlng
      showControlPointMenu.value = true
    })

    // Set initial view based on control points
    if (currentGame.value?.controlPoints?.length) {
      const validPoints = currentGame.value.controlPoints.filter(cp => {
        const lat = typeof cp.latitude === 'string' ? parseFloat(cp.latitude) : cp.latitude
        const lng = typeof cp.longitude === 'string' ? parseFloat(cp.longitude) : cp.longitude
        return !isNaN(lat) && !isNaN(lng)
      })
      
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map(cp => {
          const lat = typeof cp.latitude === 'string' ? parseFloat(cp.latitude) : cp.latitude
          const lng = typeof cp.longitude === 'string' ? parseFloat(cp.longitude) : cp.longitude
          return [lat, lng]
        }))
        mapInstance.value.fitBounds(bounds)
      } else {
        mapInstance.value.setView([0, 0], 2)
      }
    } else {
      mapInstance.value.setView([0, 0], 2)
    }

    // Render existing control points
    renderControlPoints()

  } catch (error) {
    console.error('Error initializing map:', error)
  }
}

// Navigation functions
const goBack = () => {
  router.push('/dashboard')
}

const reloadPage = () => {
  window.location.reload()
}

const centerOnUser = async () => {
  if (mapInstance.value && currentPosition.value) {
    try {
      const L = await import('leaflet')
      mapInstance.value.setView([currentPosition.value.lat, currentPosition.value.lng], 16)
    } catch (error) {
      console.error('Error centering on user:', error)
    }
  }
}

const centerOnSite = async () => {
  if (mapInstance.value && currentGame.value?.controlPoints?.length) {
    try {
      const L = await import('leaflet')
      const validPoints = currentGame.value.controlPoints.filter(cp => {
        const lat = typeof cp.latitude === 'string' ? parseFloat(cp.latitude) : cp.latitude
        const lng = typeof cp.longitude === 'string' ? parseFloat(cp.longitude) : cp.longitude
        return !isNaN(lat) && !isNaN(lng)
      })
      
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map(cp => {
          const lat = typeof cp.latitude === 'string' ? parseFloat(cp.latitude) : cp.latitude
          const lng = typeof cp.longitude === 'string' ? parseFloat(cp.longitude) : cp.longitude
          return [lat, lng]
        }))
        mapInstance.value.fitBounds(bounds)
      }
    } catch (error) {
      console.error('Error centering on site:', error)
    }
  }
}

const openGameResultsDialog = () => {
  addToast({ message: 'Funcionalidad de resultados en desarrollo', type: 'info' })
}

const enableGameNameEdit = () => {
  addToast({ message: 'Funcionalidad de edición de nombre en desarrollo', type: 'info' })
}

const handleTimeSelect = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const timeInSeconds = parseInt(target.value)
  updateGameTime(timeInSeconds)
}

const updateGameTime = async (timeInSeconds: number) => {
  if (!currentGame.value || !socketRef.value) return
  
  try {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'updateGameTime',
      data: { timeInSeconds }
    })
    addToast({ message: 'Tiempo actualizado', type: 'success' })
  } catch (error) {
    console.error('Error updating game time:', error)
    addToast({ message: 'Error al actualizar el tiempo', type: 'error' })
  }
}

// Control point marker functions
const createControlPointMarker = async (controlPoint: ControlPoint) => {
  if (!mapInstance.value) return null

  try {
    const L = await import('leaflet')
    
    // Validate coordinates and convert to numbers if needed
    const lat = typeof controlPoint.latitude === 'string'
      ? parseFloat(controlPoint.latitude)
      : controlPoint.latitude
    const lng = typeof controlPoint.longitude === 'string'
      ? parseFloat(controlPoint.longitude)
      : controlPoint.longitude

    // Check if coordinates are valid numbers
    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates for control point:', controlPoint.id, controlPoint.name, lat, lng)
      return null
    }

    // Get control point icon properties based on type and challenges
    const { iconColor, iconEmoji } = getControlPointIcon(controlPoint)

    // Create marker with specific design based on control point properties
    const marker = L.marker([lat, lng], {
      draggable: false,
      icon: L.divIcon({
        className: 'control-point-marker',
        html: `
          <div style="
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <!-- Timer display above marker -->
            <div class="control-point-timer"
                 id="timer_${controlPoint.id}"
                 style="
                     position: absolute;
                     top: -20px;
                     left: 50%;
                     transform: translateX(-50%);
                     background: rgba(0, 0, 0, 0.7);
                     color: white;
                     padding: 2px 4px;
                     border-radius: 3px;
                     font-size: 10px;
                     font-weight: bold;
                     white-space: nowrap;
                     display: ${(controlPoint.ownedByTeam) ? 'block' : 'none'};
                     z-index: 1000;
                 ">${controlPoint.displayTime || '00:00'}</div>
            <!-- Position challenge bars -->
            <div class="position-challenge-bars"
                 id="position_challenge_bars_${controlPoint.id}"
                 style="
                     position: absolute;
                     top: -45px;
                     left: 50%;
                     transform: translateX(-50%);
                     display: ${(controlPoint.hasPositionChallenge) ? 'flex' : 'none'};
                     flex-direction: column;
                     gap: 2px;
                     width: 40px;
                     z-index: 1000;
                 ">
            </div>
            <!-- Control point marker -->
            <div style="
                background: ${iconColor}80;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: white;
                font-weight: bold;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            ">${iconEmoji}</div>
            <!-- Bomb timer display -->
            <div class="bomb-timer"
                 id="bomb_timer_${controlPoint.id}"
                 style="
                     position: absolute;
                     bottom: -20px;
                     left: 50%;
                     transform: translateX(-50%);
                     background: rgba(255, 87, 34, 0.9);
                     color: white;
                     padding: 2px 4px;
                     border-radius: 3px;
                     font-size: 10px;
                     font-weight: bold;
                     white-space: nowrap;
                     display: none;
                     z-index: 1000;
                 ">00:00</div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    })

    // Add popup for owner
    const popupContent = createPopupContent(controlPoint, (marker as any)._leaflet_id, {
      handleControlPointMove,
      handleControlPointUpdate,
      handleControlPointDelete,
      handleAssignTeam,
      handleTogglePositionChallenge,
      handleToggleCodeChallenge,
      handleToggleBombChallenge,
      handleUpdatePositionChallenge,
      handleUpdateCodeChallenge,
      handleUpdateBombChallenge
    })
    marker.bindPopup(popupContent, {
      closeOnClick: false,
      autoClose: false,
      closeButton: true
    })

    marker.addTo(mapInstance.value)
    return marker
  } catch (error) {
    console.error('Error creating control point marker:', error)
    return null
  }
}

const getControlPointIcon = (controlPoint: ControlPoint) => {
  let iconColor = '#2196F3' // Default for control_point
  let iconEmoji = '🚩' // Default for control_point

  // Check ownership first - override color based on team
  if (controlPoint.ownedByTeam) {
    const teamColors: Record<string, string> = {
      'blue': '#2196F3',
      'red': '#F44336',
      'green': '#4CAF50',
      'yellow': '#FFEB3B'
    }
    iconColor = teamColors[controlPoint.ownedByTeam] || '#2196F3'
  } else {
    // When not owned by any team, use gray color
    iconColor = '#9E9E9E'
  }

  // If bomb challenge is active, use bomb emoji
  if (controlPoint.hasBombChallenge) {
    iconEmoji = '💣'
  } else {
    switch (controlPoint.type) {
      case 'site':
        // Only use orange color for site if not owned by a team
        if (!controlPoint.ownedByTeam) {
          iconColor = '#FF9800'
        }
        iconEmoji = '🏠'
        break
      case 'control_point':
      default:
        iconEmoji = '🚩'
        break
    }
  }

  return { iconColor, iconEmoji }
}

const getTeamColor = (team: string | null): string => {
  const colors: Record<string, string> = {
    'blue': '#2196F3',
    'red': '#F44336',
    'green': '#4CAF50',
    'yellow': '#FFC107',
    'none': '#9E9E9E'
  }
  return colors[team || 'none'] || '#9E9E9E'
}


const getAvailableTeams = (): string[] => {
  const teamCount = currentGame.value?.teamCount || 4
  const allTeams = ['blue', 'red', 'green', 'yellow']
  return allTeams.slice(0, teamCount)
}

const getTeamName = (team: string): string => {
  const teamNames: Record<string, string> = {
    'blue': 'Azul',
    'red': 'Rojo',
    'green': 'Verde',
    'yellow': 'Amarillo',
    'none': 'Ninguno'
  }
  return teamNames[team] || team
}

const renderControlPoints = async () => {
  if (!mapInstance.value || !currentGame.value?.controlPoints?.length) return

  // Clear existing markers
  controlPointMarkers.value.forEach((marker) => {
    mapInstance.value.removeLayer(marker)
  })
  controlPointMarkers.value.clear()

  positionCircles.value.forEach((circle) => {
    mapInstance.value.removeLayer(circle)
  })
  positionCircles.value.clear()

  pieCharts.value.forEach((pieChart) => {
    mapInstance.value.removeLayer(pieChart)
  })
  pieCharts.value.clear()

  // Create new markers for each control point
  for (const controlPoint of currentGame.value.controlPoints) {
    const marker = await createControlPointMarker(controlPoint)
    if (marker) {
      controlPointMarkers.value.set(controlPoint.id, marker)
    }
  }
}

const createControlPoint = (lat: number, lng: number) => {
  if (!socketRef.value || !currentGame.value) return

  try {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'createControlPoint',
      data: {
        latitude: lat,
        longitude: lng,
        name: `Control Point ${(currentGame.value.controlPoints?.length || 0) + 1}`
      }
    })
    addToast({ message: 'Punto de control creado', type: 'success' })
  } catch (error) {
    console.error('Error creating control point:', error)
    addToast({ message: 'Error al crear punto de control', type: 'error' })
  }
}

const updateTeamCount = (count: number) => {
  teamCount.value = count
  if (socketRef.value && currentGame.value) {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'updateTeamCount',
      data: { teamCount: count }
    })
  }
}

// Control point popup handlers
const handleControlPointUpdate = (controlPointId: number, markerId: number) => {
  if (!socketRef.value || !currentGame.value) return

  try {
    // Get form values from DOM - read ALL values even if inputs are hidden
    const typeSelect = document.getElementById(`controlPointType_${controlPointId}`) as HTMLSelectElement
    const nameInput = document.getElementById(`controlPointEditName_${controlPointId}`) as HTMLInputElement
    const positionChallengeCheckbox = document.getElementById(`positionChallenge_${controlPointId}`) as HTMLInputElement
    const minDistanceSelect = document.getElementById(`controlPointMinDistance_${controlPointId}`) as HTMLSelectElement
    const minAccuracySelect = document.getElementById(`controlPointMinAccuracy_${controlPointId}`) as HTMLSelectElement
    const codeChallengeCheckbox = document.getElementById(`codeChallenge_${controlPointId}`) as HTMLInputElement
    const codeInput = document.getElementById(`controlPointCode_${controlPointId}`) as HTMLInputElement
    const bombChallengeCheckbox = document.getElementById(`bombChallenge_${controlPointId}`) as HTMLInputElement
    const bombTimeSelect = document.getElementById(`controlPointBombTime_${controlPointId}`) as HTMLSelectElement
    const armedCodeInput = document.getElementById(`controlPointArmedCode_${controlPointId}`) as HTMLInputElement
    const disarmedCodeInput = document.getElementById(`controlPointDisarmedCode_${controlPointId}`) as HTMLInputElement

    // Validate required fields
    if (!nameInput?.value.trim()) {
      addToast({ message: 'Por favor ingresa un nombre para el punto', type: 'warning' })
      return
    }

    // Prepare update data following the original React structure
    const updateData = {
      controlPointId: controlPointId,
      name: nameInput.value.trim(),
      type: typeSelect?.value || 'control_point',
      hasPositionChallenge: positionChallengeCheckbox?.checked || false,
      hasCodeChallenge: codeChallengeCheckbox?.checked || false,
      hasBombChallenge: bombChallengeCheckbox?.checked || false
    }

    // Add position challenge values - always read from DOM even if inputs are hidden
    const minDistance = minDistanceSelect?.value || ''
    const minAccuracy = minAccuracySelect?.value || ''
    
    // Validate position challenge if checked
    if (positionChallengeCheckbox?.checked) {
      if (!minDistance) {
        addToast({ message: 'Para position challenge, debes ingresar una distancia mínima', type: 'warning' })
        return
      }
      if (!minAccuracy) {
        addToast({ message: 'Para position challenge, debes ingresar un accuracy mínimo', type: 'warning' })
        return
      }
    }
    
    // Always send position values (they will be null if not selected)
    ;(updateData as any).minDistance = minDistance ? parseInt(minDistance) : null
    ;(updateData as any).minAccuracy = minAccuracy ? parseInt(minAccuracy) : null

    // Add code challenge values - always read from DOM even if inputs are hidden
    const code = codeInput?.value.trim() || ''
    
    // Validate code challenge if checked
    if (codeChallengeCheckbox?.checked) {
      if (!code) {
        addToast({ message: 'Para code challenge, debes ingresar un código', type: 'warning' })
        return
      }
    }
    
    // Always send code value (it will be null if empty)
    ;(updateData as any).code = code || null

    // Add bomb challenge values - always read from DOM even if inputs are hidden
    const bombTime = bombTimeSelect?.value || ''
    const armedCode = armedCodeInput?.value.trim() || ''
    const disarmedCode = disarmedCodeInput?.value.trim() || ''
    
    // Validate bomb challenge if checked
    if (bombChallengeCheckbox?.checked) {
      if (!bombTime) {
        addToast({ message: 'Para bomb challenge, debes ingresar un tiempo', type: 'warning' })
        return
      }
      if (!armedCode) {
        addToast({ message: 'Para bomb challenge, debes ingresar un código para armar', type: 'warning' })
        return
      }
      if (!disarmedCode) {
        addToast({ message: 'Para bomb challenge, debes ingresar un código para desarmar', type: 'warning' })
        return
      }
    }
    
    // Always send bomb values (they will be null if not selected)
    ;(updateData as any).bombTime = bombTime ? parseInt(bombTime) : null
    ;(updateData as any).armedCode = armedCode || null
    ;(updateData as any).disarmedCode = disarmedCode || null

    // Send update via WebSocket following the original structure
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'updateControlPoint',
      data: updateData
    })

    addToast({ message: 'Punto actualizado exitosamente', type: 'success' })

    // Close the popup
    if (mapInstance.value) {
      mapInstance.value.closePopup()
    }
  } catch (error) {
    console.error('Error updating control point:', error)
    addToast({ message: 'Error al actualizar punto de control', type: 'error' })
  }
}

const handleControlPointDelete = (controlPointId: number, markerId: number) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'deleteControlPoint',
        data: { controlPointId }
      })
      addToast({ message: 'Punto de control eliminado', type: 'success' })
      // Close the popup by finding and closing the current open popup
      if (mapInstance.value) {
        mapInstance.value.closePopup()
      }
    } catch (error) {
      console.error('Error deleting control point:', error)
      addToast({ message: 'Error al eliminar punto de control', type: 'error' })
    }
  }
}

const handleControlPointMove = (controlPointId: number, markerId: number) => {
  console.log('Move control point:', controlPointId, markerId)
  // TODO: Implement control point move logic
  // Close the popup by finding and closing the current open popup
  if (mapInstance.value) {
    mapInstance.value.closePopup()
  }
}

const handleAssignTeam = (controlPointId: number, team: string) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'assignControlPointTeam',
        data: { controlPointId, team: team === 'none' ? null : team }
      })
      addToast({ message: `Equipo asignado: ${team}`, type: 'success' })
    } catch (error) {
      console.error('Error assigning team:', error)
      addToast({ message: 'Error al asignar equipo', type: 'error' })
    }
  }
}

const handleTogglePositionChallenge = (controlPointId: number) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'togglePositionChallenge',
        data: { controlPointId }
      })
      addToast({ message: 'Position challenge actualizado', type: 'success' })
    } catch (error) {
      console.error('Error toggling position challenge:', error)
      addToast({ message: 'Error al actualizar position challenge', type: 'error' })
    }
  }
}

const handleToggleCodeChallenge = (controlPointId: number) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'toggleCodeChallenge',
        data: { controlPointId }
      })
      addToast({ message: 'Code challenge actualizado', type: 'success' })
    } catch (error) {
      console.error('Error toggling code challenge:', error)
      addToast({ message: 'Error al actualizar code challenge', type: 'error' })
    }
  }
}

const handleToggleBombChallenge = (controlPointId: number) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'toggleBombChallenge',
        data: { controlPointId }
      })
      addToast({ message: 'Bomb challenge actualizado', type: 'success' })
    } catch (error) {
      console.error('Error toggling bomb challenge:', error)
      addToast({ message: 'Error al actualizar bomb challenge', type: 'error' })
    }
  }
}

// Challenge configuration handlers
const handleUpdatePositionChallenge = (controlPointId: number, radius: number) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'updatePositionChallenge',
        data: { controlPointId, radius }
      })
      addToast({ message: 'Radio de posición actualizado', type: 'success' })
    } catch (error) {
      console.error('Error updating position challenge:', error)
      addToast({ message: 'Error al actualizar radio de posición', type: 'error' })
    }
  }
}

const handleUpdateCodeChallenge = (controlPointId: number, code: string) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'updateCodeChallenge',
        data: { controlPointId, code }
      })
      addToast({ message: 'Código actualizado', type: 'success' })
    } catch (error) {
      console.error('Error updating code challenge:', error)
      addToast({ message: 'Error al actualizar código', type: 'error' })
    }
  }
}

const handleUpdateBombChallenge = (controlPointId: number, time: number) => {
  if (socketRef.value && currentGame.value) {
    try {
      socketRef.value.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'updateBombChallenge',
        data: { controlPointId, time }
      })
      addToast({ message: 'Tiempo de bomba actualizado', type: 'success' })
    } catch (error) {
      console.error('Error updating bomb challenge:', error)
      addToast({ message: 'Error al actualizar tiempo de bomba', type: 'error' })
    }
  }
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    stopped: 'Detenido',
    running: 'En Ejecución',
    paused: 'Pausado',
    finished: 'Finalizado'
  }
  return statusMap[status] || status
}

// Game actions
const startGame = () => {
  if (!currentGame.value || !socketRef.value) return
  try {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'startGame'
    })
    addToast({ message: 'Juego iniciado', type: 'success' })
  } catch (error) {
    console.error('Error starting game:', error)
    addToast({ message: 'Error al iniciar el juego', type: 'error' })
  }
}

const pauseGame = () => {
  if (!currentGame.value || !socketRef.value) return
  try {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'pauseGame'
    })
    addToast({ message: 'Juego pausado', type: 'success' })
  } catch (error) {
    console.error('Error pausing game:', error)
    addToast({ message: 'Error al pausar el juego', type: 'error' })
  }
}

const endGame = () => {
  if (!currentGame.value || !socketRef.value) return
  try {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'endGame'
    })
    addToast({ message: 'Juego finalizado', type: 'success' })
  } catch (error) {
    console.error('Error ending game:', error)
    addToast({ message: 'Error al finalizar el juego', type: 'error' })
  }
}

const restartGame = () => {
  if (!currentGame.value || !socketRef.value) return
  try {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'restartGame'
    })
    addToast({ message: 'Juego reiniciado', type: 'success' })
  } catch (error) {
    console.error('Error restarting game:', error)
    addToast({ message: 'Error al reiniciar el juego', type: 'error' })
  }
}

const resumeGame = () => {
  if (!currentGame.value || !socketRef.value) return
  try {
    socketRef.value.emit('gameAction', {
      gameId: currentGame.value.id,
      action: 'resumeGame'
    })
    addToast({ message: 'Juego reanudado', type: 'success' })
  } catch (error) {
    console.error('Error resuming game:', error)
    addToast({ message: 'Error al reanudar el juego', type: 'error' })
  }
}

// Lifecycle
onMounted(async () => {
  try {
    const user = await AuthService.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (!gameId) {
      addToast({ message: 'ID de juego no válido', type: 'error' })
      router.push('/dashboard')
      return
    }

    const game = await GameService.getGame(parseInt(gameId))
    if (!game) {
      addToast({ message: 'Juego no encontrado', type: 'error' })
      router.push('/dashboard')
      return
    }

    if (game.owner.id !== user.id) {
      addToast({ message: 'No tienes permisos para ver este juego', type: 'error' })
      router.push('/dashboard')
      return
    }

    currentUser.value = user
    currentGame.value = game
    teamCount.value = game.teamCount || 2

    // Initialize WebSocket connection - use same approach as React (through Vite proxy)
    const token = AuthService.getToken()
    console.log('WebSocket token:', token)
    console.log('Token length:', token?.length)
    console.log('Token starts with:', token?.substring(0, 20))
    console.log('Current user:', currentUser.value)
    console.log('Is authenticated:', AuthService.isAuthenticated())
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}`
      
      // Use exact same configuration as React
      const socket = io(wsUrl, {
        auth: {
          token: token  // No Bearer prefix, just the raw token
        }
      })
      socketRef.value = socket

      socket.on('connect', () => {
        console.log('WebSocket connected successfully to backend')
        socket.emit('joinGame', { gameId: parseInt(gameId) })
        console.log('Sent joinGame event for game:', gameId)
        
        // Debug: test if we can emit events
        console.log('Socket connected state:', socket.connected)
        console.log('Socket ID:', socket.id)
      })

      socket.on('gameUpdate', (data: { game: Game; type?: string }) => {
        if (data.game) {
          console.log('Game update received:', data.game.status)
          console.log('Full game data:', data.game)
          currentGame.value = data.game
        }
      })

      // Add game state listeners for real-time state synchronization
      socket.on('gameState', (game: Game) => {
        if (game) {
          console.log('Game state received:', game.status)
          console.log('Full game state:', game)
          currentGame.value = game
        }
      })

      socket.on('gameAction', (data: { action: string; data: any }) => {
        console.log('Game action received:', data.action, data.data)
        if (data.action === 'gameStateChanged' && data.data.game) {
          console.log('Game state changed:', data.data.game.status)
          currentGame.value = data.data.game
        }
      })

      socket.on('joinSuccess', (data: { user: User }) => {
        if (data.user) {
          currentUser.value = data.user
        }
      })

      socket.on('gameActionError', (data: { action: string; error: string }) => {
        console.error(`Game action error (${data.action}):`, data.error)
        addToast({ message: `Error: ${data.error}`, type: 'error' })
      })

      socket.on('joinError', (data: any) => {
        console.error('Join error received:', data)
        addToast({ message: `Error al unirse al juego: ${data.message || 'Error desconocido'}`, type: 'error' })
      })

      socket.on('connect_error', (error: Error) => {
        console.error('WebSocket connection error:', error)
        addToast({ message: 'Error de conexión WebSocket: ' + error.message, type: 'error' })
      })

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        if (reason === 'io server disconnect' || reason === 'transport close') {
          addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
        }
      })

      // Debug: listen to all events
      socket.onAny((eventName, ...args) => {
        console.log('WebSocket event received:', eventName, args)
      })

      // Handle control point specific events
      socket.on('controlPointCreated', (data: { controlPoint: ControlPoint }) => {
        console.log('Control point created:', data.controlPoint)
        if (currentGame.value) {
          currentGame.value.controlPoints = [...(currentGame.value.controlPoints || []), data.controlPoint]
          renderControlPoints()
        }
      })

      socket.on('controlPointUpdated', (data: { controlPoint: ControlPoint }) => {
        console.log('Control point updated:', data.controlPoint)
        if (currentGame.value) {
          currentGame.value.controlPoints = (currentGame.value.controlPoints || []).map(cp =>
            cp.id === data.controlPoint.id ? data.controlPoint : cp
          )
          renderControlPoints()
        }
      })

      socket.on('controlPointDeleted', (data: { controlPointId: number }) => {
        console.log('Control point deleted:', data.controlPointId)
        if (currentGame.value) {
          currentGame.value.controlPoints = (currentGame.value.controlPoints || []).filter(cp =>
            cp.id !== data.controlPointId
          )
          renderControlPoints()
        }
      })

      socket.on('joinSuccess', (data: { user: User }) => {
        if (data.user) {
          currentUser.value = data.user
        }
      })

      socket.on('gameActionError', (data: { action: string; error: string }) => {
        console.error(`Game action error (${data.action}):`, data.error)
        addToast({ message: `Error: ${data.error}`, type: 'error' })
      })

      socket.on('connect_error', (error: Error) => {
        console.error('WebSocket connection error:', error)
        addToast({ message: 'Error de conexión WebSocket: ' + error.message, type: 'error' })
      })

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        if (reason === 'io server disconnect' || reason === 'transport close') {
          addToast({ message: 'Conexión perdida con el servidor', type: 'error' })
        }
      })
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
      addToast({ message: 'Error al inicializar WebSocket', type: 'error' })
    }

    // Initialize map after component is mounted and data is loaded
    await nextTick()
    setTimeout(() => {
      initializeMap()
    }, 100)

  } catch (error) {
    console.error('Error initializing game:', error)
    addToast({ message: 'Error al cargar el juego', type: 'error' })
    router.push('/dashboard')
  } finally {
    isLoading.value = false
  }
})

// Global functions for control point popup buttons
const setupGlobalFunctions = () => {
  ;(window as any).editControlPoint = (controlPointId: number) => {
    // TODO: Implement edit functionality
    console.log('Edit control point:', controlPointId)
    addToast({ message: 'Funcionalidad de edición en desarrollo', type: 'info' })
  }
  
  ;(window as any).deleteControlPoint = (controlPointId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este punto de control?')) {
      handleControlPointDelete(controlPointId, 0)
    }
  }
}

onMounted(() => {
  setupGlobalFunctions()
})

onUnmounted(() => {
  if (socketRef.value) {
    socketRef.value.disconnect()
  }
  if (mapInstance.value) {
    mapInstance.value.remove()
  }
  
  // Clean up global functions
  delete (window as any).editControlPoint
  delete (window as any).deleteControlPoint
})
</script>

<style scoped>
/* Game Owner Styles - Matching Original Design */
.game-owner-container {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

/* Map Container */
.map-container {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

.map {
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

/* Game Overlay - Top Left */
.game-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 15px;
  color: white;
  max-width: 300px;
  backdrop-filter: blur(10px);
}

.game-info h2 {
  margin: 0 0 5px 0;
  color: #4CAF50;
  font-size: 16px;
}

.game-details {
  font-size: 12px;
  color: #ccc;
}

/* Location Info - Bottom Left */
.location-info-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 10px;
  color: white;
  font-size: 12px;
  backdrop-filter: blur(10px);
}

/* Control Panel - Bottom Right */
.control-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}

/* Map Controls - Top Right */
.map-controls-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Buttons - Matching Original */
.btn {
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover {
  background: #bd2a20;
  color: white;
}

.btn-secondary {
  background: #666;
  color: white;
}

.btn-warning {
  background: #FF9800;
  color: white;
}

.btn:hover {
  opacity: 1;
  transform: none;
}

/* Map Control Buttons */
.map-controls-panel .btn {
  padding: 10px;
  font-size: 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  backdrop-filter: blur(10px);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-controls-panel .btn:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: none;
}

/* Edit Name Styles */
.game-title-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-pencil {
  color: #4CAF50;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  opacity: 0.7;
  transform: translateY(-3px);
}

.edit-pencil:hover {
  opacity: 1;
}

/* Loading State */
.loading {
  text-align: center;
  color: #ccc;
  font-style: italic;
  padding: 20px;
}

/* Control Point Popup Overlay */
.control-point-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.control-point-popup-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}
</style>

<style>
/* Leaflet Popup Styles */
.leaflet-popup-content-wrapper {
  background: black;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  padding: 0;
}

.leaflet-popup-content {
  margin: 0;
  padding: 0;
  min-width: 280px;
  max-width: 320px;
}

.leaflet-popup-tip {
  background: black;
}

/* Control Point Edit Menu Styles */
.control-point-edit-menu {
  min-width: 280px;
  max-width: 320px;
  background: black;
}

.control-point-edit-content {
  padding: 10px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.edit-title {
  margin: 0;
  color: white;
  font-size: 16px;
  font-weight: bold;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #ccc;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.btn-close:hover {
  color: white;
}

.form-group {
  margin-bottom: 12px;
}

.form-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #ccc;
  font-weight: bold;
}

.form-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 12px;
  box-sizing: border-box;
  background: #333;
  color: white;
}

.team-buttons {
  display: flex;
  gap: 5px;
  margin-top: 5px;
  flex-wrap: wrap;
}

.challenge-toggle {
  margin-bottom: 8px;
}

.challenge-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #ccc;
}

.challenge-toggle input[type="checkbox"] {
  margin: 0;
}

.action-buttons {
  margin-top: 15px;
  display: flex;
  gap: 5px;
  justify-content: space-between;
}

.btn {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn:hover {
  opacity: 0.8;
}
</style>
