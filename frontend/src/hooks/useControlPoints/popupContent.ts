
import { ControlPoint } from '../../types';
import * as L from 'leaflet';

// Create owner popup content
export const createOwnerPopupContent = (controlPoint: ControlPoint, marker: L.Marker): HTMLElement => {
  const popup = document.createElement('div');
  popup.className = 'control-point-edit-menu';
  
  // Check if there's already a Site in the game (excluding current point)
  const hasOtherSite = false; // This would need to be calculated from existing control points

  let typeOptions = '';
  if (hasOtherSite && controlPoint.type !== 'site') {
    typeOptions = `
      <option value="control_point" ${controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
    `;
  } else {
    typeOptions = `
      <option value="site" ${controlPoint.type === 'site' ? 'selected' : ''}>Site</option>
      <option value="control_point" ${!controlPoint.type || controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
    `;
  }

  popup.innerHTML = `
    <div class="control-point-edit-content">
      <h4 class="edit-title">Editar Punto</h4>
      ${controlPoint.ownedByTeam ? `
        <div class="ownership-status" style="background: ${controlPoint.ownedByTeam}; color: white; padding: 5px; border-radius: 4px; margin-bottom: 10px; text-align: center; font-weight: bold;">
          Controlado por: ${controlPoint.ownedByTeam.toUpperCase()}
        </div>
        <div class="hold-time" style="font-size: 12px; color: #666; text-align: center; margin-bottom: 10px;">
          Tiempo: ${controlPoint.displayTime || '00:00'}
        </div>
      ` : ''}
      
      <div class="form-group">
        <label class="form-label">Tipo:</label>
        <select id="controlPointType_${controlPoint.id}" class="form-input">
          ${typeOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nombre:</label>
        <input type="text" id="controlPointEditName_${controlPoint.id}" value="${controlPoint.name}" class="form-input">
      </div>
      
      <!-- Team Assignment -->
      <div class="form-group">
        <label class="form-label">Asignar Equipo:</label>
        <div class="team-buttons" style="display: flex; gap: 5px; margin-top: 5px;">
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'blue')" class="btn btn-blue" style="background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Azul</button>
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'red')" class="btn btn-red" style="background: #F44336; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Rojo</button>
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'green')" class="btn btn-green" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Verde</button>
          <button onclick="window.assignControlPointTeam(${controlPoint.id}, 'yellow')" class="btn btn-yellow" style="background: #FFEB3B; color: black; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Amarillo</button>
        </div>
      </div>
      
      <!-- Challenges Section -->
      <div class="challenges-section" style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">
        <h5 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Desafíos</h5>
        
        <!-- Position Challenge -->
        <div class="challenge-item" style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="positionChallenge_${controlPoint.id}" ${controlPoint.hasPositionChallenge ? 'checked' : ''}
                   onchange="window.togglePositionInputs(${controlPoint.id})" style="margin-right: 8px;">
            <span style="font-size: 13px;">Desafío de Posición</span>
          </label>
          <div id="positionInputs_${controlPoint.id}" style="margin-top: 5px; margin-left: 20px; display: ${controlPoint.hasPositionChallenge ? 'block' : 'none'}">
            <div class="form-group">
              <label class="form-label">Distancia Mínima:</label>
              <select id="controlPointMinDistance_${controlPoint.id}" class="form-input">
                <option value="5" ${controlPoint.minDistance === 5 ? 'selected' : ''}>5m (Muy cercano)</option>
                <option value="10" ${controlPoint.minDistance === 10 ? 'selected' : ''}>10m (Cercano)</option>
                <option value="25" ${controlPoint.minDistance === 25 ? 'selected' : ''}>25m (Medio)</option>
                <option value="50" ${controlPoint.minDistance === 50 ? 'selected' : ''}>50m (Lejano)</option>
                <option value="100" ${controlPoint.minDistance === 100 ? 'selected' : ''}>100m (Muy lejano)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Accuracy Mínimo:</label>
              <select id="controlPointMinAccuracy_${controlPoint.id}" class="form-input">
                <option value="5" ${controlPoint.minAccuracy === 5 ? 'selected' : ''}>5m (Alta precisión)</option>
                <option value="10" ${controlPoint.minAccuracy === 10 ? 'selected' : ''}>10m (Buena precisión)</option>
                <option value="20" ${controlPoint.minAccuracy === 20 ? 'selected' : ''}>20m (Precisión media)</option>
                <option value="50" ${controlPoint.minAccuracy === 50 ? 'selected' : ''}>50m (Baja precisión)</option>
                <option value="100" ${controlPoint.minAccuracy === 100 ? 'selected' : ''}>100m (Muy baja precisión)</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Code Challenge -->
        <div class="challenge-item" style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="codeChallenge_${controlPoint.id}" ${controlPoint.hasCodeChallenge ? 'checked' : ''}
                   onchange="window.toggleCodeInputs(${controlPoint.id})" style="margin-right: 8px;">
            <span style="font-size: 13px;">Desafío de Código</span>
          </label>
          <div id="codeInputs_${controlPoint.id}" style="margin-top: 5px; margin-left: 20px; display: ${controlPoint.hasCodeChallenge ? 'block' : 'none'}">
            <div class="form-group">
              <label class="form-label">Code:</label>
              <input type="text" id="controlPointCode_${controlPoint.id}" value="${controlPoint.code || ''}" class="form-input" placeholder="Código para tomar">
            </div>
          </div>
        </div>
        
        <!-- Bomb Challenge -->
        <div class="challenge-item" style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="checkbox" id="bombChallenge_${controlPoint.id}" ${controlPoint.hasBombChallenge ? 'checked' : ''}
                   onchange="window.toggleBombInputs(${controlPoint.id})" style="margin-right: 8px;">
            <span style="font-size: 13px;">Desafío de Bomba</span>
          </label>
          <div id="bombInputs_${controlPoint.id}" style="margin-top: 5px; margin-left: 20px; display: ${controlPoint.hasBombChallenge ? 'block' : 'none'}">
            <div class="form-group">
              <label class="form-label">Bomb Time:</label>
              <select id="controlPointBombTime_${controlPoint.id}" class="form-input">
                <option value="60" ${controlPoint.bombTime === 60 ? 'selected' : ''}>1 minuto</option>
                <option value="120" ${controlPoint.bombTime === 120 ? 'selected' : ''}>2 minutos</option>
                <option value="180" ${controlPoint.bombTime === 180 ? 'selected' : ''}>3 minutos</option>
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
              <div style="margin-top: 10px; display: flex; gap: 5px;">
                <button onclick="window.activateBombAsOwner(${controlPoint.id})" class="btn btn-danger" style="background: #F44336; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Activar Bomba</button>
                <button onclick="window.deactivateBombAsOwner(${controlPoint.id})" class="btn btn-success" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; font-size: 12px;">Desactivar</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="action-buttons" style="margin-top: 15px; display: flex; gap: 5px; justify-content: space-between;">
        <button onclick="window.enableDragMode(${controlPoint.id}, ${(marker as any)._leaflet_id})" class="btn btn-move" title="Mover punto" style="background: rgba(33, 150, 243, 0.2); border: 1px solid #2196F3; color: #2196F3; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">🧭 Mover</button>
        <button onclick="window.updateControlPoint(${controlPoint.id}, ${(marker as any)._leaflet_id})" class="btn btn-primary" style="background: #2196F3; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Actualizar</button>
        <button onclick="window.deleteControlPoint(${controlPoint.id}, ${(marker as any)._leaflet_id})" class="btn btn-danger" style="background: #F44336; color: white; border: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">Eliminar</button>
      </div>
    </div>
  `;

  return popup;
};

// Create player popup content
export const createPlayerPopupContent = (controlPoint: ControlPoint, marker: L.Marker): HTMLElement => {
  const popup = document.createElement('div');
  popup.className = 'control-point-popup player';
  
  // Show ownership status and hold time
  let ownershipStatus = '';
  if (controlPoint.ownedByTeam) {
    const teamColors: Record<string, string> = {
      'blue': 'Azul',
      'red': 'Rojo',
      'green': 'Verde',
      'yellow': 'Amarillo'
    };
    const holdTime = controlPoint.displayTime || '00:00';
    ownershipStatus = `
      <div class="ownership-status" style="color: ${controlPoint.ownedByTeam}; font-weight: bold;">
        Controlado por: ${teamColors[controlPoint.ownedByTeam] || controlPoint.ownedByTeam}
      </div>
      <div class="hold-time" style="font-size: 12px; color: #666; margin-top: 5px;">
        Tiempo: ${holdTime}
      </div>
    `;
  }
  
  // Only show challenge buttons when game is running
  const isGameRunning = true; // This should come from game state
  const canTakePoint = isGameRunning;
  
  // Show code challenge input and submit button if code challenge is active
  let codeChallengeSection = '';
  if (canTakePoint && controlPoint.hasCodeChallenge) {
    codeChallengeSection = `
      <div class="code-challenge-section" style="margin-top: 10px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código:</label>
        <input type="text" id="codeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código">
        <button class="submit-code-button" onclick="window.submitCodeChallenge(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Enviar Código</button>
      </div>
    `;
  }
  
  // Show bomb challenge inputs and submit button if bomb challenge is active
  let bombChallengeSection = '';
  if (canTakePoint && controlPoint.hasBombChallenge) {
    // Check if bomb is already active by looking at active bomb timers
    let isBombActive = false;
    
    // Check if there's an active bomb timer for this control point
    const activeBombTimers = (window as any).activeBombTimers;
    if (activeBombTimers && activeBombTimers instanceof Map) {
      const bombTimer = activeBombTimers.get(controlPoint.id);
      if (bombTimer && bombTimer.isActive) {
        isBombActive = true;
      }
    }
    
    if (isBombActive) {
      // Bomb is active - show disarmed code input and deactivation button
      bombChallengeSection = `
        <div class="bomb-challenge-section" style="margin-top: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Desactivación:</label>
          <input type="text" id="disarmedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código de desactivación">
          <button class="submit-bomb-button" onclick="window.submitBombDeactivation(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Desactivar Bomba</button>
        </div>
      `;
    } else {
      // Bomb is not active - show armed code input and activation button
      bombChallengeSection = `
        <div class="bomb-challenge-section" style="margin-top: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Código Armado:</label>
          <input type="text" id="armedCodeInput_${controlPoint.id}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Ingresa el código armado">
          <button class="submit-bomb-button" onclick="window.submitBombChallenge(${controlPoint.id})" style="width: 100%; margin-top: 8px; padding: 8px; background: #FF5722; color: white; border: none; border-radius: 4px; cursor: pointer;">Activar Bomba</button>
        </div>
      `;
    }
  }
  popup.innerHTML = `
    <div class="point-name" style="font-weight: bold; font-size: 16px; margin-bottom: 10px;">${controlPoint.name}</div>
    ${ownershipStatus}
    ${codeChallengeSection}
    ${bombChallengeSection}
  `;
  
  return popup;
};
  
