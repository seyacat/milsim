import { ControlPoint } from '../../types/index.js'

// Store current state locally to avoid conflicts
interface PopupState {
  hasPositionChallenge: boolean
  hasCodeChallenge: boolean
  hasBombChallenge: boolean
}

// Function to get team color
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

// Function to get team name
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

// Function to get available teams
const getAvailableTeams = (): string[] => {
  return ['blue', 'red', 'green', 'yellow']
}

// Function to update challenge info display
const updateChallengeInfo = (container: HTMLElement, popupState: PopupState) => {
  const positionInfo = container.querySelector('.position-challenge-info') as HTMLElement
  const codeInfo = container.querySelector('.code-challenge-info') as HTMLElement
  const bombInfo = container.querySelector('.bomb-challenge-info') as HTMLElement
  
  if (positionInfo) {
    positionInfo.style.display = popupState.hasPositionChallenge ? 'block' : 'none'
  }
  if (codeInfo) {
    codeInfo.style.display = popupState.hasCodeChallenge ? 'block' : 'none'
  }
  if (bombInfo) {
    bombInfo.style.display = popupState.hasBombChallenge ? 'block' : 'none'
  }
}

// Create popup content for Leaflet popup
export const createPopupContent = (
  controlPoint: ControlPoint, 
  markerId: number,
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
): HTMLElement => {
  const container = document.createElement('div')
  
  // Store current state locally to avoid conflicts
  const popupState: PopupState = {
    hasPositionChallenge: controlPoint.hasPositionChallenge,
    hasCodeChallenge: controlPoint.hasCodeChallenge,
    hasBombChallenge: controlPoint.hasBombChallenge
  }
  
  // Create the popup HTML structure
  container.innerHTML = `
    <div class="control-point-edit-menu">
      <div class="control-point-edit-content">
        <h4 class="edit-title">Editar Punto</h4>
        
        ${controlPoint.ownedByTeam ? `
          <div class="ownership-section">
            <div class="ownership-status" style="background: ${getTeamColor(controlPoint.ownedByTeam)}; color: white; padding: 5px; border-radius: 4px; margin-bottom: 10px; text-align: center; font-weight: bold">
              Controlado por: ${getTeamName(controlPoint.ownedByTeam)}
            </div>
            <div class="hold-time" style="font-size: 12px; color: #ccc; text-align: center; margin-bottom: 10px">
              Tiempo: ${controlPoint.displayTime || '00:00'}
            </div>
          </div>
        ` : ''}
        
        <div class="form-group">
          <label class="form-label">Tipo:</label>
          <select id="controlPointType_${controlPoint.id}" class="form-input">
            <option value="site" ${controlPoint.type === 'site' ? 'selected' : ''}>Site</option>
            <option value="control_point" ${controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Nombre:</label>
          <input type="text" id="controlPointEditName_${controlPoint.id}" value="${controlPoint.name}" class="form-input">
        </div>
        
        <div class="form-group">
          <label class="form-label">Asignar Equipo:</label>
          <div class="team-buttons" style="display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap">
            <button class="btn btn-none" style="background: #9E9E9E; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px; opacity: ${!controlPoint.ownedByTeam || controlPoint.ownedByTeam === 'none' ? 1 : 0.7}">
              Ninguno
            </button>
            ${getAvailableTeams().map(team => `
              <button class="btn btn-${team}" style="background: ${getTeamColor(team)}; color: ${team === 'yellow' ? 'black' : 'white'}; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px; opacity: ${controlPoint.ownedByTeam === team ? 1 : 0.7}">
                ${getTeamName(team)}
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="challenges-section" style="margin-top: 15px; border-top: 1px solid #444; padding-top: 10px">
          <h5 style="margin: 0 0 10px 0; font-size: 14px; color: #ccc">Desafíos</h5>
          
          <div class="challenge-toggle">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
              <input type="checkbox" id="positionChallenge_${controlPoint.id}" ${controlPoint.hasPositionChallenge ? 'checked' : ''}>
              <span style="color: #ccc">📍 Position Challenge</span>
            </label>
            <div class="position-challenge-info" style="margin-left: 24px; margin-top: 2px; display: ${controlPoint.hasPositionChallenge ? 'block' : 'none'}">
              <div style="font-size: 11px; color: #999; margin-bottom: 4px">
                ${controlPoint.minDistance ? `Radio actual: ${controlPoint.minDistance}m` : 'Radio actual: 10m'}
              </div>
              <div style="display: flex; align-items: center; gap: 5px">
                <label style="font-size: 11px; color: #ccc">Nuevo radio:</label>
                <input type="number" id="positionRadius_${controlPoint.id}" value="${controlPoint.minDistance || 10}" min="1" max="1000"
                       style="width: 60px; padding: 2px 4px; border: 1px solid #444; border-radius: 3px; background: #333; color: white; font-size: 11px">
                <span style="font-size: 11px; color: #999">m</span>
              </div>
            </div>
          </div>
          
          <div class="challenge-toggle">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
              <input type="checkbox" id="codeChallenge_${controlPoint.id}" ${controlPoint.hasCodeChallenge ? 'checked' : ''}>
              <span style="color: #ccc">🔢 Code Challenge</span>
            </label>
            <div class="code-challenge-info" style="margin-left: 24px; margin-top: 2px; display: ${controlPoint.hasCodeChallenge ? 'block' : 'none'}">
              <div style="font-size: 11px; color: #999; margin-bottom: 4px">
                ${controlPoint.code ? `Código actual: ${controlPoint.code}` : 'Código actual: No configurado'}
              </div>
              <div style="display: flex; align-items: center; gap: 5px">
                <label style="font-size: 11px; color: #ccc">Nuevo código:</label>
                <input type="text" id="codeValue_${controlPoint.id}" value="${controlPoint.code || ''}"
                       style="width: 80px; padding: 2px 4px; border: 1px solid #444; border-radius: 3px; background: #333; color: white; font-size: 11px"
                       placeholder="Código">
              </div>
            </div>
          </div>
          
          <div class="challenge-toggle">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
              <input type="checkbox" id="bombChallenge_${controlPoint.id}" ${controlPoint.hasBombChallenge ? 'checked' : ''}>
              <span style="color: #ccc">💣 Bomb Challenge</span>
            </label>
            <div class="bomb-challenge-info" style="margin-left: 24px; margin-top: 2px; display: ${controlPoint.hasBombChallenge ? 'block' : 'none'}">
              <div style="font-size: 11px; color: #999; margin-bottom: 4px">
                ${controlPoint.bombTime ? `Tiempo actual: ${controlPoint.bombTime}s` : 'Tiempo actual: 60s'}
              </div>
              <div style="display: flex; align-items: center; gap: 5px">
                <label style="font-size: 11px; color: #ccc">Nuevo tiempo:</label>
                <input type="number" id="bombTime_${controlPoint.id}" value="${controlPoint.bombTime || 60}" min="5" max="300"
                       style="width: 60px; padding: 2px 4px; border: 1px solid #444; border-radius: 3px; background: #333; color: white; font-size: 11px">
                <span style="font-size: 11px; color: #999">s</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="action-buttons" style="margin-top: 15px; display: flex; gap: 5px; justify-content: space-between">
          <button class="btn btn-move" title="Mover punto" style="background: rgba(33, 150, 243, 0.2); border: 1px solid #2196F3; color: #2196F3; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer">
            Mover
          </button>
          <button class="btn btn-primary" style="background: #2196F3; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer">
            Actualizar
          </button>
          <button class="btn btn-danger" style="background: #F44336; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  `
  
  // Add event listeners
  const moveButton = container.querySelector('.btn-move')
  const updateButton = container.querySelector('.btn-primary')
  const deleteButton = container.querySelector('.btn-danger')
  const teamButtons = container.querySelectorAll('.team-buttons .btn')
  const positionCheckbox = container.querySelector(`#positionChallenge_${controlPoint.id}`) as HTMLInputElement
  const codeCheckbox = container.querySelector(`#codeChallenge_${controlPoint.id}`) as HTMLInputElement
  const bombCheckbox = container.querySelector(`#bombChallenge_${controlPoint.id}`) as HTMLInputElement
  
  // Handle checkbox changes locally
  positionCheckbox?.addEventListener('change', () => {
    popupState.hasPositionChallenge = positionCheckbox.checked
    updateChallengeInfo(container, popupState)
  })
  
  codeCheckbox?.addEventListener('change', () => {
    popupState.hasCodeChallenge = codeCheckbox.checked
    updateChallengeInfo(container, popupState)
  })
  
  bombCheckbox?.addEventListener('change', () => {
    popupState.hasBombChallenge = bombCheckbox.checked
    updateChallengeInfo(container, popupState)
  })
  
  moveButton?.addEventListener('click', () => {
    handlers.handleControlPointMove(controlPoint.id, markerId)
  })
  
  updateButton?.addEventListener('click', () => {
    // Send all updates via the main update handler which reads all values from DOM
    handlers.handleControlPointUpdate(controlPoint.id, markerId)
  })
  
  deleteButton?.addEventListener('click', () => {
    handlers.handleControlPointDelete(controlPoint.id, markerId)
  })
  
  teamButtons.forEach(button => {
    button.addEventListener('click', () => {
      const team = button.classList.contains('btn-none') ? 'none' :
                   button.classList.contains('btn-blue') ? 'blue' :
                   button.classList.contains('btn-red') ? 'red' :
                   button.classList.contains('btn-green') ? 'green' :
                   button.classList.contains('btn-yellow') ? 'yellow' : 'none'
      handlers.handleAssignTeam(controlPoint.id, team)
    })
  })
  
  return container
}