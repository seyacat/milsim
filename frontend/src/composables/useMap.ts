import { ref, onUnmounted } from 'vue'
import { ControlPoint } from '../types/index.js'
import { createPopupContent, createPlayerPopupContent } from '../components/Game/popupUtils.js'

export const useMap = () => {
  const mapInstance = ref<any>(null)
  const mapRef = ref<HTMLDivElement | null>(null)
  const controlPointMarkers = ref<Map<number, any>>(new Map())
  const positionCircles = ref<Map<number, any>>(new Map())
  const pieCharts = ref<Map<number, any>>(new Map())
  const pendingPositionChallengeUpdates = ref<Map<number, Record<string, number>>>(new Map())

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
      
      // Initialize map with animations enabled (better UX)
      mapInstance.value = L.map(mapRef.value, {
        zoomControl: true,
        maxZoom: 22,
        minZoom: 1
      }).setView([0, 0], 13)

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.value)

      // Add click handler for creating control points and closing popups on blur
      mapInstance.value.on('click', (e: any) => {
        // Check if there's an open popup by looking at the map's popup property
        const hasOpenPopup = mapInstance.value._popup && mapInstance.value._popup.isOpen()
        if (hasOpenPopup) {
          // Close any open popup when clicking outside
          mapInstance.value.closePopup()
        } else {
          // Only trigger onMapClick if no popup was open
          onMapClick(e.latlng)
        }
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
      handleActivateBomb: (controlPointId: number) => void
      handleDeactivateBomb: (controlPointId: number) => void
    }
  ) => {
    if (!mapInstance.value) return null

    try {
      const L = await import('leaflet')
      
      
      // Validate coordinates and convert to numbers if needed
      let lat = typeof controlPoint.latitude === 'string'
        ? parseFloat(controlPoint.latitude)
        : controlPoint.latitude
      let lng = typeof controlPoint.longitude === 'string'
        ? parseFloat(controlPoint.longitude)
        : controlPoint.longitude

      // Fallback: check if coordinates might be in different properties
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Primary coordinates invalid, checking for alternative properties')
        // Check for alternative property names that might be used
        const altLat = (controlPoint as any).lat || (controlPoint as any).Latitude
        const altLng = (controlPoint as any).lng || (controlPoint as any).Longitude
        
        if (altLat !== undefined && altLng !== undefined) {
          lat = typeof altLat === 'string' ? parseFloat(altLat) : altLat
          lng = typeof altLng === 'string' ? parseFloat(altLng) : altLng
        }
      }

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

      // Add popup - for owner with edit controls, for player with challenge inputs
      if (Object.keys(handlers).length > 0) {
        // Owner view - with edit controls
        const popupContent = createPopupContent(controlPoint, (marker as any)._leaflet_id, handlers)
        marker.bindPopup(popupContent, {
          closeOnClick: false,
          autoClose: false,
          closeButton: true
        })
      } else {
        // Player view - with challenge inputs
        const popupContent = createPlayerPopupContent(controlPoint)
        marker.bindPopup(popupContent, {
          closeOnClick: false,
          autoClose: false,
          closeButton: true
        })
      }

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

  const createPositionCircle = async (controlPoint: ControlPoint) => {
    if (!mapInstance.value || !controlPoint.minDistance) return null

    try {
      const L = await import('leaflet')
      
      // Validate coordinates and convert to numbers if needed
      const lat = typeof controlPoint.latitude === 'string'
        ? parseFloat(controlPoint.latitude)
        : controlPoint.latitude
      const lng = typeof controlPoint.longitude === 'string'
        ? parseFloat(controlPoint.longitude)
        : controlPoint.longitude

      if (isNaN(lat) || isNaN(lng)) {
        console.error('Invalid coordinates for position circle:', controlPoint.id, controlPoint.name, lat, lng)
        return null
      }

      const circle = L.circle([lat, lng], {
        radius: controlPoint.minDistance,
        color: '#FF9800', // Orange color
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 2,
        opacity: 0.8
      }).addTo(mapInstance.value)

      // Store control point ID with circle
      ;(circle as any).controlPointId = controlPoint.id

      return circle
    } catch (error) {
      console.error('Error creating position circle:', error)
      return null
    }
  }

  const createPositionChallengePieChart = async (marker: any, controlPoint: ControlPoint, positionCircle: any) => {
    console.log('createPositionChallengePieChart called for CP:', controlPoint.id, 'with owner:', controlPoint.ownedByTeam)
    
    if (!mapInstance.value) {
      console.log('No map instance available')
      return
    }

    try {
      const L = await import('leaflet')
      
      // Clean all existing pie charts for this control point
      const pieChartClass = `pie-cp-${controlPoint.id}`
      const containers = mapInstance.value.getPanes()?.overlayPane?.querySelectorAll(`.${pieChartClass}`)
      if (containers) {
        console.log('Removing existing pie chart containers:', containers.length)
        containers.forEach((container: Element) => {
          container.remove()
        })
      }

      // Remove existing pie chart if it exists
      if (marker.pieSvg) {
        console.log('Removing existing pieSvg layer')
        mapInstance.value.removeLayer(marker.pieSvg)
        marker.pieSvg = null
        marker.pieElement = null
        marker.pieData = null
      }

      // Get circle bounds and center
      const bounds = positionCircle.getBounds()
      const centerLatLng = positionCircle.getLatLng()
      const radiusPixels = mapInstance.value.latLngToLayerPoint(bounds.getNorthEast()).distanceTo(mapInstance.value.latLngToLayerPoint(centerLatLng))
      
      console.log('Circle bounds:', bounds, 'radiusPixels:', radiusPixels)
      
      // Set SVG dimensions to match circle
      const svgWidth = radiusPixels * 2
      const svgHeight = radiusPixels * 2

      console.log('SVG dimensions:', svgWidth, 'x', svgHeight)

      // Create SVG element as Leaflet overlay
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      
      svgElement.setAttribute('width', svgWidth.toString())
      svgElement.setAttribute('height', svgHeight.toString())
      svgElement.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      svgElement.style.pointerEvents = 'none'
      svgElement.style.zIndex = '1000'
      svgElement.style.opacity = '0.5'

      // Create Leaflet SVG overlay that moves with the map
      const svgOverlay = L.svgOverlay(svgElement, bounds, {
        opacity: 0.5,
        interactive: false,
        className: `pie-cp-${controlPoint.id}`
      }).addTo(mapInstance.value)
      
      // Force the overlay to be on top of other layers
      svgOverlay.bringToFront()

      console.log('SVG overlay created and added to map')
      console.log('SVG element details:', {
        width: svgWidth,
        height: svgHeight,
        viewBox: `0 0 ${svgWidth} ${svgHeight}`,
        bounds: bounds,
        center: centerLatLng
      })

      // Store SVG overlay reference for later updates
      marker.pieSvg = svgOverlay
      marker.pieElement = svgElement
      marker.pieData = {
        controlPointId: controlPoint.id,
        teamPoints: {},
        bounds,
        svgWidth,
        svgHeight,
        radiusPixels
      }

      console.log('Pie chart data stored:', marker.pieData)
      console.log('SVG element children count:', svgElement.children.length)
      
      // Check if there are pending updates for this control point
      if (pendingPositionChallengeUpdates.value.has(controlPoint.id)) {
        console.log('Processing pending position challenge update for CP:', controlPoint.id)
        const pendingTeamPoints = pendingPositionChallengeUpdates.value.get(controlPoint.id)
        pendingPositionChallengeUpdates.value.delete(controlPoint.id)
        if (pendingTeamPoints) {
          updatePositionChallengePieChart(controlPoint.id, pendingTeamPoints)
        }
      }
      } catch (error) {
        console.error('Error creating position challenge pie chart:', error)
      }
    }

  const renderControlPoints = async (
    controlPoints: ControlPoint[],
    handlers: any = {}
  ) => {
    if (!mapInstance.value) {
      return
    }


    // Create a set of current control point IDs
    const currentControlPointIds = new Set(controlPoints.map(cp => cp.id))

    // Remove markers for control points that are no longer in the game
    const controlPointsToRemove: number[] = []
    controlPointMarkers.value.forEach((marker, controlPointId) => {
      if (!currentControlPointIds.has(controlPointId)) {
        if (marker) {
          mapInstance.value.removeLayer(marker)
        }
        controlPointsToRemove.push(controlPointId)
      }
    })
    
    // Remove the deleted control points from the markers map
    controlPointsToRemove.forEach(controlPointId => {
      controlPointMarkers.value.delete(controlPointId)
    })

    // Remove position circles for deleted control points
    const circlesToRemove: number[] = []
    positionCircles.value.forEach((circle, controlPointId) => {
      if (!currentControlPointIds.has(controlPointId)) {
        if (circle) {
          mapInstance.value.removeLayer(circle)
        }
        circlesToRemove.push(controlPointId)
      }
    })
    
    circlesToRemove.forEach(controlPointId => {
      positionCircles.value.delete(controlPointId)
    })

    // Remove pie charts for deleted control points
    const pieChartsToRemove: number[] = []
    pieCharts.value.forEach((pieChart, controlPointId) => {
      if (!currentControlPointIds.has(controlPointId)) {
        if (pieChart) {
          mapInstance.value.removeLayer(pieChart)
        }
        pieChartsToRemove.push(controlPointId)
      }
    })
    
    pieChartsToRemove.forEach(controlPointId => {
      pieCharts.value.delete(controlPointId)
    })

    // Create or update markers for each control point
    for (const controlPoint of controlPoints) {
      let marker = controlPointMarkers.value.get(controlPoint.id)
      
      if (!marker) {
        // Create new marker if it doesn't exist
        marker = await createControlPointMarker(controlPoint, handlers)
        if (marker) {
          controlPointMarkers.value.set(controlPoint.id, marker)
        } else {
          console.log('Failed to create marker for control point:', controlPoint.id)
        }
      } else {
        // Update existing marker with handlers
        await updateControlPointMarker(controlPoint, handlers)
      }

      // Handle position circles and PIE charts
      if (controlPoint.hasPositionChallenge && controlPoint.minDistance) {
        let circle = positionCircles.value.get(controlPoint.id)
        if (!circle) {
          // Create new position circle if it doesn't exist
          circle = await createPositionCircle(controlPoint)
          if (circle) {
            positionCircles.value.set(controlPoint.id, circle)
          }
        }
        
        // Create or update PIE chart for position challenge
        if (circle && marker) {
          console.log('Creating PIE chart for control point:', controlPoint.id, 'with owner:', controlPoint.ownedByTeam)
          await createPositionChallengePieChart(marker, controlPoint, circle)
          
          // Don't initialize with default 60 points - wait for real data from backend
          // The PIE chart will be updated when positionChallengeUpdate events arrive
          console.log('PIE chart created for control point:', controlPoint.id, 'waiting for position challenge data')
        }
      } else {
        // Remove position circle and PIE chart if position challenge is no longer active
        const circle = positionCircles.value.get(controlPoint.id)
        if (circle) {
          mapInstance.value.removeLayer(circle)
          positionCircles.value.delete(controlPoint.id)
        }
        
        const pieChart = pieCharts.value.get(controlPoint.id)
        if (pieChart) {
          mapInstance.value.removeLayer(pieChart)
          pieCharts.value.delete(controlPoint.id)
        }
      }
    }
    
  }

  const updateControlPointMarker = async (controlPoint: ControlPoint, handlers: any = {}) => {
    
    if (!controlPoint || !controlPoint.id) {
      return
    }
    
    const marker = controlPointMarkers.value.get(controlPoint.id)
    if (!marker || !mapInstance.value) {
      return
    }

    try {
      const L = await import('leaflet')
      
      // Get updated control point icon properties
      const { iconColor, iconEmoji } = getControlPointIcon(controlPoint)
      
      // Create updated custom icon
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

      // Always update popup content to ensure it reflects current control point state
      
      if (Object.keys(handlers).length > 0) {
        // Owner view - with edit controls
        const popupContent = createPopupContent(controlPoint, marker._leaflet_id, handlers)
        marker.bindPopup(popupContent, {
          closeOnClick: false,
          autoClose: false,
          closeButton: true
        })
      } else {
        // Player view - with challenge inputs
        const popupContent = createPlayerPopupContent(controlPoint)
        marker.bindPopup(popupContent, {
          closeOnClick: false,
          autoClose: false,
          closeButton: true
        })
      }
      
    } catch (error) {
      console.error('Error updating control point marker:', error)
    }
  }

  const updatePositionChallengePieChart = (controlPointId: number, teamPoints: Record<string, number>) => {
    console.log('updatePositionChallengePieChart called for CP:', controlPointId, 'with teamPoints:', teamPoints)
    
    const marker = controlPointMarkers.value.get(controlPointId)
    if (!marker) {
      console.log('No marker found for control point:', controlPointId, '- storing update for later')
      // Store the update for when the marker becomes available
      pendingPositionChallengeUpdates.value.set(controlPointId, teamPoints)
      return
    }
    if (!marker.pieElement) {
      console.log('No pieElement found for control point:', controlPointId, '- storing update for later')
      // Store the update for when the pie element becomes available
      pendingPositionChallengeUpdates.value.set(controlPointId, teamPoints)
      return
    }
    if (!marker.pieData) {
      console.log('No pieData found for control point:', controlPointId, '- storing update for later')
      // Store the update for when the pie data becomes available
      pendingPositionChallengeUpdates.value.set(controlPointId, teamPoints)
      return
    }

    const totalPoints = Object.values(teamPoints).reduce((sum, points) => sum + points, 0)
    console.log('Total points calculated:', totalPoints)
    
    // Always update the pie chart when we receive data, even if totalPoints is 0
    // This ensures the pie chart is cleared properly when needed
    const teamColors: Record<string, string> = {
      'blue': '#2196F3',
      'red': '#F44336',
      'green': '#4CAF50',
      'yellow': '#FFEB3B'
    }

    // Clear existing pie slices
    marker.pieElement.innerHTML = ''
    console.log('Cleared existing pie slices')

    // Only render pie slices if we have points
    if (totalPoints > 0) {
      console.log('Rendering pie slices with totalPoints:', totalPoints)
      
      // Get stored dimensions
      const { svgWidth, svgHeight, radiusPixels } = marker.pieData
      const svgCenterX = svgWidth / 2
      const svgCenterY = svgHeight / 2
      
      // If we have exactly 60 points (full control), create a simple circle
      if (totalPoints === 60) {
        console.log('Creating full circle for 60 points')
        
        // Create a simple circle for full control
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('cx', svgCenterX.toString())
        circle.setAttribute('cy', svgCenterY.toString())
        circle.setAttribute('r', (radiusPixels - 2).toString()) // Slightly smaller than the position circle
        circle.setAttribute('fill', teamColors[Object.keys(teamPoints)[0]] || '#9E9E9E')
        circle.setAttribute('stroke', '#fff')
        circle.setAttribute('stroke-width', '2')
        circle.setAttribute('opacity', '0.5')
        
        console.log('Circle element created:', {
          cx: svgCenterX,
          cy: svgCenterY,
          r: radiusPixels - 2,
          fill: teamColors[Object.keys(teamPoints)[0]] || '#9E9E9E'
        })
        
        marker.pieElement.appendChild(circle)
        console.log('Circle appended to SVG, children count:', marker.pieElement.children.length)
      } else {
        // For partial points, use pie slices
        let currentAngle = 0
        
        // Create pie slices for each team with points
        Object.entries(teamPoints).forEach(([team, points]) => {
          if (points > 0) {
            const percentage = points / totalPoints
            const angle = percentage * 360
            const endAngle = currentAngle + angle
            
            console.log(`Creating slice for team ${team}: ${points} points (${angle} degrees)`)
            
            // Convert angles to radians
            const startRad = (currentAngle - 90) * Math.PI / 180
            const endRad = (endAngle - 90) * Math.PI / 180
            
            // Calculate start and end points
            const startX = svgCenterX + radiusPixels * Math.cos(startRad)
            const startY = svgCenterY + radiusPixels * Math.sin(startRad)
            const endX = svgCenterX + radiusPixels * Math.cos(endRad)
            const endY = svgCenterY + radiusPixels * Math.sin(endRad)
            
            // Determine if the arc is large (more than 180 degrees)
            const largeArcFlag = angle > 180 ? 1 : 0
            
            // Create path for pie slice
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            let pathData = ''
            
            if (Math.abs(angle - 360) < 0.001) {
              // Full circle - create a complete circle
              pathData = `
                M ${svgCenterX} ${svgCenterY}
                L ${startX} ${startY}
                A ${radiusPixels} ${radiusPixels} 0 1 1 ${endX} ${endY}
                Z
              `
            } else {
              // Partial circle
              pathData = `
                M ${svgCenterX} ${svgCenterY}
                L ${startX} ${startY}
                A ${radiusPixels} ${radiusPixels} 0 ${largeArcFlag} 1 ${endX} ${endY}
                Z
              `
            }
            
            path.setAttribute('d', pathData)
            path.setAttribute('fill', teamColors[team] || '#9E9E9E')
            path.setAttribute('stroke', '#fff')
            path.setAttribute('stroke-width', '1')
            path.setAttribute('opacity', '0.5')
            
            marker.pieElement.appendChild(path)
            currentAngle = endAngle
          }
        })
      }
      console.log('Finished rendering pie slices')
    } else {
      console.log('No points to render, keeping pie chart empty')
    }
    
    // Always update stored team points, even if empty
    marker.pieData.teamPoints = teamPoints
    console.log('Updated stored team points:', teamPoints)
  }

  const enableControlPointDrag = (controlPointId: number) => {
    const marker = controlPointMarkers.value.get(controlPointId)
    if (marker) {
      marker.dragging.enable()
    }
  }

  const disableControlPointDrag = (controlPointId: number) => {
    const marker = controlPointMarkers.value.get(controlPointId)
    if (marker) {
      marker.dragging.disable()
    }
  }

  const closePopup = () => {
    if (mapInstance.value) {
      mapInstance.value.closePopup()
    }
  }

  const processPendingPositionChallengeUpdates = () => {
    console.log('Processing all pending position challenge updates:', pendingPositionChallengeUpdates.value.size)
    for (const [controlPointId, teamPoints] of pendingPositionChallengeUpdates.value.entries()) {
      console.log('Processing pending update for CP:', controlPointId, 'with teamPoints:', teamPoints)
      updatePositionChallengePieChart(controlPointId, teamPoints)
    }
    pendingPositionChallengeUpdates.value.clear()
  }

  const destroyMap = () => {
    if (mapInstance.value) {
      try {
        // Stop any ongoing animations first
        if (mapInstance.value._animatingZoom) {
          mapInstance.value._stop()
        }
        
        // Remove all event listeners first
        mapInstance.value.off()
        
        // Remove all layers
        mapInstance.value.eachLayer((layer: any) => {
          mapInstance.value.removeLayer(layer)
        })
        
        // Clear control point markers
        controlPointMarkers.value.clear()
        positionCircles.value.clear()
        pieCharts.value.clear()
        pendingPositionChallengeUpdates.value.clear()
        
        // Remove the map
        mapInstance.value.remove()
        mapInstance.value = null
        
        // Clear the map container
        if (mapRef.value) {
          mapRef.value.innerHTML = ''
        }
      } catch (error) {
        console.error('Error destroying map:', error)
      }
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
    pendingPositionChallengeUpdates,
    initializeMap,
    setMapView,
    centerOnPosition,
    renderControlPoints,
    updateControlPointMarker,
    updatePositionChallengePieChart,
    processPendingPositionChallengeUpdates,
    enableControlPointDrag,
    disableControlPointDrag,
    closePopup,
    destroyMap
  }
}