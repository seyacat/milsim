// Control point edit menu and form handling for owners

// Create control point edit menu
function createControlPointEditMenu(controlPoint, marker) {
    const menu = document.createElement('div');
    menu.className = 'control-point-edit-menu';
    
    
    // Check if there's already a Site in the game (excluding current point)
    const hasOtherSite = hasSiteControlPoint() && controlPoint.type !== 'site';
    
    let typeOptions = '';
    if (hasOtherSite && controlPoint.type !== 'site') {
        // If there's already a Site and this is not it, only show Control Point
        typeOptions = `
            <option value="control_point" ${controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
        `;
    } else {
        // Show all options
        typeOptions = `
            <option value="site" ${controlPoint.type === 'site' ? 'selected' : ''}>Site</option>
            <option value="control_point" ${!controlPoint.type || controlPoint.type === 'control_point' ? 'selected' : ''}>Control Point</option>
        `;
    }
    
    // Position challenge section
    // Check if position challenge should be active based on stored checkbox state
    const positionChallengeChecked = controlPoint.hasPositionChallenge || false;
    
    // Set default values for dropdowns if not already set
    const defaultMinDistance = controlPoint.minDistance || 25; // Default to 25m
    const defaultMinAccuracy = controlPoint.minAccuracy || 20; // Default to 20m
    
    // Distance options (in meters)
    const distanceOptions = `
        <option value="5" ${defaultMinDistance === 5 ? 'selected' : ''}>5m (Muy cercano)</option>
        <option value="10" ${defaultMinDistance === 10 ? 'selected' : ''}>10m (Cercano)</option>
        <option value="25" ${defaultMinDistance === 25 ? 'selected' : ''}>25m (Medio)</option>
        <option value="50" ${defaultMinDistance === 50 ? 'selected' : ''}>50m (Lejano)</option>
        <option value="100" ${defaultMinDistance === 100 ? 'selected' : ''}>100m (Muy lejano)</option>
    `;
    
    // Accuracy options (in meters)
    const accuracyOptions = `
        <option value="5" ${defaultMinAccuracy === 5 ? 'selected' : ''}>5m (Alta precisión)</option>
        <option value="10" ${defaultMinAccuracy === 10 ? 'selected' : ''}>10m (Buena precisión)</option>
        <option value="20" ${defaultMinAccuracy === 20 ? 'selected' : ''}>20m (Precisión media)</option>
        <option value="50" ${defaultMinAccuracy === 50 ? 'selected' : ''}>50m (Baja precisión)</option>
        <option value="100" ${defaultMinAccuracy === 100 ? 'selected' : ''}>100m (Muy baja precisión)</option>
    `;
    const positionInputs = `
        <div class="form-group">
            <label class="form-label">Distancia Mínima:</label>
            <select id="controlPointMinDistance_${controlPoint.id}" class="form-input">
                ${distanceOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Accuracy Mínimo:</label>
            <select id="controlPointMinAccuracy_${controlPoint.id}" class="form-input">
                ${accuracyOptions}
            </select>
        </div>
    `;
    
    // Code challenge section
    // Check if code challenge should be active based on stored checkbox state
    const codeChallengeChecked = controlPoint.hasCodeChallenge || false;
    const codeInputs = `
        <div class="form-group">
            <label class="form-label">Code:</label>
            <input type="text" id="controlPointCode_${controlPoint.id}" value="${controlPoint.code || ''}" class="form-input" placeholder="Código para tomar">
        </div>
    `;

    // Bomb challenge section
    // Check if bomb challenge should be active based on stored checkbox state
    const bombChallengeChecked = controlPoint.hasBombChallenge || false;
    
    // Set default bomb time if not already set
    const defaultBombTime = controlPoint.bombTime || 300; // Default to 5 minutes
    
    // Bomb time options (in seconds)
    const bombTimeOptions = `
        <option value="60" ${defaultBombTime === 60 ? 'selected' : ''}>1 minuto</option>
        <option value="120" ${defaultBombTime === 120 ? 'selected' : ''}>2 minutos</option>
        <option value="180" ${defaultBombTime === 180 ? 'selected' : ''}>3 minutos</option>
        <option value="300" ${defaultBombTime === 300 ? 'selected' : ''}>5 minutos</option>
        <option value="600" ${defaultBombTime === 600 ? 'selected' : ''}>10 minutos</option>
        <option value="900" ${defaultBombTime === 900 ? 'selected' : ''}>15 minutos</option>
    `;
    
    const bombInputs = `
        <div class="form-group">
            <label class="form-label">Bomb Time:</label>
            <select id="controlPointBombTime_${controlPoint.id}" class="form-input">
                ${bombTimeOptions}
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
    `;
    
    // Get team count from current game
    const teamCount = currentGame ? currentGame.teamCount : 4; // Default to 4 if not available
    
    // Define teams based on team count
    const teams = [];
    if (teamCount >= 2) {
        teams.push({ id: 'blue', name: 'Azul', color: '#2196F3', textColor: 'white' });
        teams.push({ id: 'red', name: 'Rojo', color: '#F44336', textColor: 'white' });
    }
    if (teamCount >= 3) {
        teams.push({ id: 'green', name: 'Verde', color: '#4CAF50', textColor: 'white' });
    }
    if (teamCount >= 4) {
        teams.push({ id: 'yellow', name: 'Amarillo', color: '#FFEB3B', textColor: '#333' });
    }
    
    // Generate team buttons HTML
    let teamButtonsHTML = '';
    teams.forEach(team => {
        teamButtonsHTML += `
            <button onclick="assignControlPointTeam(${controlPoint.id}, '${team.id}')"
                    class="team-btn ${controlPoint.ownedByTeam === team.id ? 'team-btn-active' : ''}"
                    style="background: ${team.color}; color: ${team.textColor}; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1; min-width: 60px;">
                ${team.name}
            </button>
        `;
    });
    
    // Add "None" button
    teamButtonsHTML += `
        <button onclick="assignControlPointTeam(${controlPoint.id}, 'none')"
                class="team-btn ${!controlPoint.ownedByTeam ? 'team-btn-active' : ''}"
                style="background: #9E9E9E; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1; min-width: 60px;">
            Ninguno
        </button>
    `;

    menu.innerHTML = `
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
            
            <!-- Team Assignment Section -->
            <div class="team-assignment-section" style="margin-bottom: 15px;">
                <h5 class="team-title" style="margin-bottom: 8px; font-size: 14px; color: #333;">Asignar Equipo</h5>
                <div class="team-buttons" style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${teamButtonsHTML}
                </div>
            </div>
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
            
            ${controlPoint.type !== 'site' ? `
            <div class="challenges-section">
                <h5 class="challenges-title">Challenges</h5>
                
                <!-- Position Challenge -->
                <div class="challenge-group">
                    <label class="challenge-label">
                        <input type="checkbox" id="positionChallenge_${controlPoint.id}" ${positionChallengeChecked ? 'checked' : ''} class="challenge-checkbox">
                        <span class="challenge-text">Position Challenge</span>
                    </label>
                    <div id="positionInputs_${controlPoint.id}" class="challenge-inputs ${positionChallengeChecked ? '' : 'hidden'}">
                        ${positionInputs}
                    </div>
                </div>
                
                <!-- Code Challenge -->
                <div class="challenge-group">
                    <label class="challenge-label">
                        <input type="checkbox" id="codeChallenge_${controlPoint.id}" ${codeChallengeChecked ? 'checked' : ''} class="challenge-checkbox">
                        <span class="challenge-text">Code Challenge</span>
                    </label>
                    <div id="codeInputs_${controlPoint.id}" class="challenge-inputs ${codeChallengeChecked ? '' : 'hidden'}">
                        ${codeInputs}
                    </div>
                </div>
                
                <!-- Bomb Challenge -->
                <div class="challenge-group">
                    <label class="challenge-label">
                        <input type="checkbox" id="bombChallenge_${controlPoint.id}" ${bombChallengeChecked ? 'checked' : ''} class="challenge-checkbox">
                        <span class="challenge-text">Bomb Challenge</span>
                    </label>
                    <div id="bombInputs_${controlPoint.id}" class="challenge-inputs ${bombChallengeChecked ? '' : 'hidden'}">
                        ${bombInputs}
                        ${controlPoint.hasBombChallenge && controlPoint.type !== 'site' && currentGame && currentGame.status === 'running' ? `
                        <!-- Bomb Action Buttons -->
                        <div class="bomb-action-buttons" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                            <div style="display: flex; gap: 10px; justify-content: center;">
                                <button onclick="window.activateBombAsOwner(${controlPoint.id})"
                                        class="btn btn-danger"
                                        id="activateBombBtnOwner_${controlPoint.id}"
                                        style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">
                                    Activar Bomba
                                </button>
                                <button onclick="window.deactivateBombAsOwner(${controlPoint.id})"
                                        class="btn btn-success"
                                        id="deactivateBombBtnOwner_${controlPoint.id}"
                                        style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">
                                    Desactivar Bomba
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div class="action-buttons">
                <button onclick="window.enableDragMode(${controlPoint.id})" class="btn btn-move" title="Mover punto" style="background: rgba(33, 150, 243, 0.2); border: 1px solid #2196F3; color: #2196F3;">🧭</button>
                <button onclick="window.updateControlPoint(${controlPoint.id})" class="btn btn-primary">Actualizar</button>
                <button onclick="window.deleteControlPoint(${controlPoint.id})" class="btn btn-danger">Eliminar</button>
            </div>
        </div>
    `;
    
    
    // Add inline onclick handlers for checkboxes
    menu.innerHTML = menu.innerHTML.replace(
        'id="positionChallenge_' + controlPoint.id + '"',
        'id="positionChallenge_' + controlPoint.id + '" onclick="togglePositionInputs(\'' + controlPoint.id + '\')"'
    );
    
    menu.innerHTML = menu.innerHTML.replace(
        'id="codeChallenge_' + controlPoint.id + '"',
        'id="codeChallenge_' + controlPoint.id + '" onclick="toggleCodeInputs(\'' + controlPoint.id + '\')"'
    );
    
    menu.innerHTML = menu.innerHTML.replace(
        'id="bombChallenge_' + controlPoint.id + '"',
        'id="bombChallenge_' + controlPoint.id + '" onclick="toggleBombInputs(\'' + controlPoint.id + '\')"'
    );
    
    return menu;
}

// Toggle position inputs visibility
function togglePositionInputs(controlPointId) {
    const checkbox = document.getElementById(`positionChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`positionInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle code inputs visibility
function toggleCodeInputs(controlPointId) {
    const checkbox = document.getElementById(`codeChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`codeInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Toggle bomb inputs visibility
function toggleBombInputs(controlPointId) {
    const checkbox = document.getElementById(`bombChallenge_${controlPointId}`);
    const inputsDiv = document.getElementById(`bombInputs_${controlPointId}`);
    
    
    if (checkbox && inputsDiv) {
        inputsDiv.classList.toggle('hidden', !checkbox.checked);
    }
}

// Make functions available globally
window.createOwnerControlPointEditMenu = createControlPointEditMenu;
window.togglePositionInputs = togglePositionInputs;
window.toggleCodeInputs = toggleCodeInputs;
window.toggleBombInputs = toggleBombInputs;