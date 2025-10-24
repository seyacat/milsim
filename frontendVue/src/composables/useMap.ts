import { ref, onUnmounted } from 'vue'
import { ControlPoint } from '../types/index.js'
import { createPopupContent } from '../components/GameOwner/popupUtils.js'

export const useMap = () => {
  const mapInstance = ref<any>(null)
  const mapRef = ref<HTMLDivElement | null>(null)
  const controlPointMarkers = ref<Map<number, any>>(new Map())
  const positionCircles = ref<Map<number, any>>(new Map())
  const pieCharts = ref<Map<number, any>>(new Map())

  const initializeMap = async (onMapClick: (latlng: { lat: number; lng: number }) => void) => {
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
        onMapClick(e.latlng)
      })

    } catch (error) {
      console.error('Error initializing map:', error)
      throw error
    }
  }

  const setMapView = async (controlPoints: ControlPoint[]) => {
    if (!mapInstance.value) return

    try {
      const L = await import('leaflet')
      
      if (controlPoints?.length) {
        const validPoints = controlPoints.filter(cp => {
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
    } catch (error) {
      console.error('Error setting map view:', error)
    }
  }

  const centerOnPosition = async (lat: number, lng: number, zoom: number = 16) => {
    if (!mapInstance.value) return

    try {
      const L = await import('leaflet')
      mapInstance.value.setView([lat, lng], zoom)
    } catch (error) {
      console.error('Error centering on position:', error)
    }
  }

  const createControlPointMarker = async (
    controlPoint: ControlPoint,
    handlers: {
      handleControlPointMove: (controlPointId: number, markerId: number) => void
      handleControlPointUpdate: (controlPointId: number, markerId: number) => void
      handleControlPointDelete: (controlPointId: number, markerId: number) => void
      handleAssignTeam: (controlPointId: number, team: string) => void
      handleTogglePositionChallenge: (controlPointId: number) => void
      handleToggleCodeChallenge: (controlPointId: number) => void
      handleToggleBombChallenge: (controlPointId: number) => void
      handleUpdatePositionChallenge: (controlPointId: number, radius: number) => void
      handleUpdateCodeChallenge: (controlPointId: number, code: string) => void
      handleUpdateBombChallenge: (controlPointId: number, time: number) => void
    }
  ) => {
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
        draggable: false
      })
      
      // Set custom icon
      const customIcon = L.divIcon({
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
                     display: none;
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
      
      marker.setIcon(customIcon)

      // Add popup for owner
      const popupContent = createPopupContent(controlPoint, (marker as any)._leaflet_id, handlers)
      marker.bindPopup(popupContent, {
        closeOnClick: false,
        autoClose: false,
        closeButton: true
      })

      // Store reference to enable drag later
      ;(marker as any).controlPointId = controlPoint.id

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

  const renderControlPoints = async (
    controlPoints: ControlPoint[],
    handlers: any
  ) => {
    if (!mapInstance.value) return

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
    for (const controlPoint of controlPoints) {
      const marker = await createControlPointMarker(controlPoint, handlers)
      if (marker) {
        controlPointMarkers.value.set(controlPoint.id, marker)
      }
    }
  }

  const enableControlPointDrag = (controlPointId: number) => {
    const marker = controlPointMarkers.value.get(controlPointId)
    if (marker) {
      marker.dragging.enable()
      console.log(`Drag enabled for control point ${controlPointId}`)
    }
  }

  const disableControlPointDrag = (controlPointId: number) => {
    const marker = controlPointMarkers.value.get(controlPointId)
    if (marker) {
      marker.dragging.disable()
      console.log(`Drag disabled for control point ${controlPointId}`)
    }
  }

  const closePopup = () => {
    if (mapInstance.value) {
      mapInstance.value.closePopup()
    }
  }

  const destroyMap = () => {
    if (mapInstance.value) {
      mapInstance.value.remove()
      mapInstance.value = null
    }
  }

  onUnmounted(() => {
    destroyMap()
  })

  return {
    mapInstance,
    mapRef,
    controlPointMarkers,
    positionCircles,
    pieCharts,
    initializeMap,
    setMapView,
    centerOnPosition,
    renderControlPoints,
    enableControlPointDrag,
    disableControlPointDrag,
    closePopup,
    destroyMap
  }
}