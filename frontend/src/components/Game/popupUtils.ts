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
    handleActivateBomb: (controlPointId: number) => void
    handleDeactivateBomb: (controlPointId: number) => void
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
              <span style="color: #ccc">📍 Desafío de Posición</span>
            </label>
            <div class="position-challenge-info" style="margin-left: 24px; margin-top: 2px; display: ${controlPoint.hasPositionChallenge ? 'block' : 'none'}">
              <div class="form-group">
                <label class="form-label">Distancia Mínima:</label>
                <select id="controlPointMinDistance_${controlPoint.id}" class="form-input">
                  <option value="5" ${controlPoint.minDistance === 5 ? 'selected' : ''}>5m (Muy cercano)</option>
                  <option value="10" ${controlPoint.minDistance === 10 ? 'selected' : ''}>10m (Cercano)</option>
                  <option value="25" ${controlPoint.minDistance === 25 || !controlPoint.minDistance ? 'selected' : ''}>25m (Medio)</option>
                  <option value="50" ${controlPoint.minDistance === 50 ? 'selected' : ''}>50m (Lejano)</option>
                  <option value="100" ${controlPoint.minDistance === 100 ? 'selected' : ''}>100m (Muy lejano)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Accuracy Mínimo:</label>
                <select id="controlPointMinAccuracy_${controlPoint.id}" class="form-input">
                  <option value="5" ${controlPoint.minAccuracy === 5 ? 'selected' : ''}>5m (Alta precisión)</option>
                  <option value="10" ${controlPoint.minAccuracy === 10 ? 'selected' : ''}>10m (Buena precisión)</option>
                  <option value="20" ${controlPoint.minAccuracy === 20 || !controlPoint.minAccuracy ? 'selected' : ''}>20m (Precisión media)</option>
                  <option value="50" ${controlPoint.minAccuracy === 50 ? 'selected' : ''}>50m (Baja precisión)</option>
                  <option value="100" ${controlPoint.minAccuracy === 100 ? 'selected' : ''}>100m (Muy baja precisión)</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="challenge-toggle">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
              <input type="checkbox" id="codeChallenge_${controlPoint.id}" ${controlPoint.hasCodeChallenge ? 'checked' : ''}>
              <span style="color: #ccc">🔢 Desafío de Código</span>
            </label>
            <div class="code-challenge-info" style="margin-left: 24px; margin-top: 2px; display: ${controlPoint.hasCodeChallenge ? 'block' : 'none'}">
              <div class="form-group">
                <label class="form-label">Code:</label>
                <input type="text" id="controlPointCode_${controlPoint.id}" value="${controlPoint.code || ''}" class="form-input" placeholder="Código para tomar">
              </div>
            </div>
          </div>
          
          <div class="challenge-toggle">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
              <input type="checkbox" id="bombChallenge_${controlPoint.id}" ${controlPoint.hasBombChallenge ? 'checked' : ''}>
              <span style="color: #ccc">💣 Desafío de Bomba</span>
            </label>
            <div class="bomb-challenge-info" style="margin-left: 24px; margin-top: 2px; display: ${controlPoint.hasBombChallenge ? 'block' : 'none'}">
              <div class="form-group">
                <label class="form-label">Bomb Time:</label>
                <select id="controlPointBombTime_${controlPoint.id}" class="form-input">
                  <option value="60" ${controlPoint.bombTime === 60 ? 'selected' : ''}>1 minuto</option>
                  <option value="120" ${controlPoint.bombTime === 120 ? 'selected' : ''}>2 minutos</option>
                  <option value="180" ${controlPoint.bombTime === 180 || !controlPoint.bombTime ? 'selected' : ''}>3 minutos</option>
                  <option value="300" ${controlPoint.bombTime === 300 ? 'selected' : ''}>5 minutos</option>
                  <option value="600" ${controlPoint.bombTime === 600 ? 'selected' : ''}>10 minutos</option>
                  <option value="900" ${controlPoint.bombTime === 900 ? 'selected' : ''}>15 minutos</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Armed Code:</label>
                <input type="text" id="controlPointArmedCode_${controlPoint.id}" value="${controlPoint.armedCode || ''}" class="form-input" placeholder="Código para armar">
              </div>
              <div class="form-group">
                <label class="form-label">Disarmed Code:</label>
                <input type="text" id="controlPointDisarmedCode_${controlPoint.id}" value="${controlPoint.disarmedCode || ''}" class="form-input" placeholder="Código para desarmar">
              </div>
              ${controlPoint.hasBombChallenge ? `
                <div style="margin-top: 10px; display: flex; gap: 5px">
                  <button class="btn btn-activate-bomb" style="background: #F44336; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px; cursor: pointer">
                    Activar Bomba
                  </button>
                  <button class="btn btn-deactivate-bomb" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px; cursor: pointer">
                    Desactivar
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="action-buttons" style="margin-top: 15px; display: flex; gap: 5px; justify-content: space-between">
          <button class="btn btn-move" title="Mover punto" style="background: rgba(33, 150, 243, 0.2); border: 1px solid #2196F3; color: #2196F3; padding: 10px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; flex: 1">
            Mover
          </button>
          <button class="btn btn-primary" style="background: #2196F3; color: white; border: none; padding: 10px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; flex: 1">
            Actualizar
          </button>
          <button class="btn btn-danger" style="background: #F44336; color: white; border: none; padding: 10px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; flex: 1">
            Eliminar
          </button>
          <button class="btn btn-close" style="background: #9E9E9E; color: white; border: none; padding: 10px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; flex: 1">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `
  
  // Add event listeners
  const moveButton = container.querySelector('.btn-move')
  const updateButton = container.querySelector('.btn-primary')
  const deleteButton = container.querySelector('.btn-danger')
  const closeButton = container.querySelector('.btn-close')
  const teamButtons = container.querySelectorAll('.team-buttons .btn')
  const positionCheckbox = container.querySelector(`#positionChallenge_${controlPoint.id}`) as HTMLInputElement
  const codeCheckbox = container.querySelector(`#codeChallenge_${controlPoint.id}`) as HTMLInputElement
  const bombCheckbox = container.querySelector(`#bombChallenge_${controlPoint.id}`) as HTMLInputElement
  const activateBombButton = container.querySelector('.bomb-challenge-info .btn-activate-bomb') as HTMLButtonElement
  const deactivateBombButton = container.querySelector('.bomb-challenge-info .btn-deactivate-bomb') as HTMLButtonElement
  
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

  // Add event listeners for bomb buttons
  if (activateBombButton) {
    activateBombButton.addEventListener('click', () => {
      handlers.handleActivateBomb(controlPoint.id)
    })
  }

  if (deactivateBombButton) {
    deactivateBombButton.addEventListener('click', () => {
      handlers.handleDeactivateBomb(controlPoint.id)
    })
  }

  // Handle close button
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      // Close the popup using the global map instance
      const map = (window as any).mapInstance
      if (map) {
        map.closePopup()
      }
    })
  }
  
  return container
}

// Create player popup content with challenge inputs
export const createPlayerPopupContent = (controlPoint: ControlPoint): HTMLElement => {
  
  const container = document.createElement('div')
  
  // Create the player popup HTML structure
  container.innerHTML = `
    <div class="control-point-player-menu">
      <div class="control-point-player-content">
        <h4 class="player-title">${controlPoint.name || 'Punto de Control'}</h4>
        
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
        
        <!-- Code Challenge Input -->
        ${controlPoint.hasCodeChallenge ? `
          <div class="challenge-section" style="margin-bottom: 15px">
            <h5 style="margin: 0 0 8px 0; font-size: 14px; color: #ccc">Desafío de Código</h5>
            <div class="player-form-group">
              <input type="text" id="playerCodeInput_${controlPoint.id}" class="player-form-input" placeholder="Ingresar código">
              <button class="player-btn player-btn-primary" id="submitCodeBtn_${controlPoint.id}">
                Ingresar Código
              </button>
            </div>
          </div>
        ` : ''}
        
        <!-- Bomb Challenge Inputs -->
        ${controlPoint.hasBombChallenge ? `
          <div class="challenge-section" style="margin-bottom: 15px">
            <h5 style="margin: 0 0 8px 0; font-size: 14px; color: #ccc">Desafío de Bomba</h5>
            ${controlPoint.bombStatus?.isActive ? `
              <!-- Bomb is active - show deactivation input -->
              <div class="player-form-group">
                <input type="text" id="playerDisarmCodeInput_${controlPoint.id}" class="player-form-input" placeholder="Código de desactivación">
                <button class="player-btn player-btn-danger" id="deactivateBombBtn_${controlPoint.id}">
                  Desactivar
                </button>
              </div>
            ` : `
              <!-- Bomb is not active - show activation input -->
              <div class="player-form-group">
                <input type="text" id="playerArmCodeInput_${controlPoint.id}" class="player-form-input" placeholder="Código de activación">
                <button class="player-btn player-btn-warning" id="activateBombBtn_${controlPoint.id}">
                  Activar
                </button>
              </div>
            `}
          </div>
        ` : ''}
        
        <!-- Position Challenge Info -->
        ${controlPoint.hasPositionChallenge ? `
          <div class="challenge-section">
            <h5 style="margin: 0 0 8px 0; font-size: 14px; color: #ccc">Desafío de Posición</h5>
            <p style="font-size: 12px; color: #999; margin: 0">
              Acércate al punto para capturarlo automáticamente
            </p>
          </div>
        ` : ''}
        
        <!-- Close button -->
        <div style="margin-top: 15px">
          <button class="player-btn player-btn-secondary" id="closePlayerPopupBtn_${controlPoint.id}" style="padding: 10px 16px; font-size: 12px;">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `
  
  // Add event listeners for player actions
  const codeInput = container.querySelector(`#playerCodeInput_${controlPoint.id}`) as HTMLInputElement
  const submitCodeBtn = container.querySelector(`#submitCodeBtn_${controlPoint.id}`) as HTMLButtonElement
  const armCodeInput = container.querySelector(`#playerArmCodeInput_${controlPoint.id}`) as HTMLInputElement
  const activateBombBtn = container.querySelector(`#activateBombBtn_${controlPoint.id}`) as HTMLButtonElement
  const disarmCodeInput = container.querySelector(`#playerDisarmCodeInput_${controlPoint.id}`) as HTMLInputElement
  const deactivateBombBtn = container.querySelector(`#deactivateBombBtn_${controlPoint.id}`) as HTMLButtonElement
  const closeBtn = container.querySelector(`#closePlayerPopupBtn_${controlPoint.id}`) as HTMLButtonElement
  
  // Handle code challenge submission
  if (submitCodeBtn && codeInput) {
    submitCodeBtn.addEventListener('click', () => {
      const code = codeInput.value.trim()
      if (code) {
        // Emit takeControlPoint event with code
        const socketRef = (window as any).socketRef?.()
        if (socketRef) {
          socketRef.emit('gameAction', {
            gameId: (window as any).currentGame?.id,
            action: 'takeControlPoint',
            data: {
              controlPointId: controlPoint.id,
              code: code
            }
          })
        }
        // Close popup after submission
        const map = (window as any).mapInstance
        if (map) {
          map.closePopup()
        }
      }
    })
  }
  
  // Handle bomb activation
  if (activateBombBtn && armCodeInput) {
    activateBombBtn.addEventListener('click', () => {
      const armedCode = armCodeInput.value.trim()
      if (armedCode) {
        // Emit activateBomb event with armed code
        const socketRef = (window as any).socketRef?.()
        if (socketRef) {
          socketRef.emit('gameAction', {
            gameId: (window as any).currentGame?.id,
            action: 'activateBomb',
            data: {
              controlPointId: controlPoint.id,
              armedCode: armedCode
            }
          })
        }
        // Close popup after submission
        const map = (window as any).mapInstance
        if (map) {
          map.closePopup()
        }
      }
    })
  }
  
  // Handle bomb deactivation
  if (deactivateBombBtn && disarmCodeInput) {
    deactivateBombBtn.addEventListener('click', () => {
      const disarmedCode = disarmCodeInput.value.trim()
      if (disarmedCode) {
        // Emit deactivateBomb event with disarmed code
        const socketRef = (window as any).socketRef?.()
        if (socketRef) {
          socketRef.emit('gameAction', {
            gameId: (window as any).currentGame?.id,
            action: 'deactivateBomb',
            data: {
              controlPointId: controlPoint.id,
              disarmedCode: disarmedCode
            }
          })
        }
        // Close popup after submission
        const map = (window as any).mapInstance
        if (map) {
          map.closePopup()
        }
      }
    })
  }
  
  // Handle close button
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const map = (window as any).mapInstance
      if (map) {
        map.closePopup()
      }
    })
  }
  
  return container
}
