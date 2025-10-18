import React from 'react';
import { ControlPoint, Game } from '../../../types';
import { PositionChallenge } from './PositionChallenge';
import { CodeChallenge } from './CodeChallenge';
import { BombChallenge } from './BombChallenge';

interface OwnerPopupProps {
  controlPoint: ControlPoint;
  markerId: number;
  game?: Game;
  onUpdate: (controlPointId: number, markerId: number) => void;
  onDelete: (controlPointId: number, markerId: number) => void;
  onMove: (controlPointId: number, markerId: number) => void;
  onAssignTeam: (controlPointId: number, team: string) => void;
  onTogglePositionChallenge: (controlPointId: number) => void;
  onToggleCodeChallenge: (controlPointId: number) => void;
  onToggleBombChallenge: (controlPointId: number) => void;
  onUpdatePositionChallenge: (controlPointId: number, minDistance: number, minAccuracy: number) => void;
  onUpdateCodeChallenge: (controlPointId: number, code: string) => void;
  onUpdateBombChallenge: (controlPointId: number, bombTime: number, armedCode: string, disarmedCode: string) => void;
  onActivateBomb: (controlPointId: number) => void;
  onDeactivateBomb: (controlPointId: number) => void;
  onClose?: () => void;
}

export const OwnerPopup: React.FC<OwnerPopupProps> = ({
  controlPoint,
  markerId,
  game,
  onUpdate,
  onDelete,
  onMove,
  onAssignTeam,
  onTogglePositionChallenge,
  onToggleCodeChallenge,
  onToggleBombChallenge,
  onUpdatePositionChallenge,
  onUpdateCodeChallenge,
  onUpdateBombChallenge,
  onActivateBomb,
  onDeactivateBomb
}) => {
  const hasOtherSite = false; // This would need to be calculated from existing control points

  // Get available teams based on game team count
  const getAvailableTeams = () => {
    const teamCount = game?.teamCount || 4; // Default to 4 teams if not specified
    const allTeams = ['blue', 'red', 'green', 'yellow'] as const;
    return allTeams.slice(0, teamCount);
  };

  const availableTeams = getAvailableTeams();

  const handleUpdate = () => {
    onUpdate(controlPoint.id, markerId);
  };

  const handleDelete = () => {
    onDelete(controlPoint.id, markerId);
  };

  const handleMove = () => {
    onMove(controlPoint.id, markerId);
  };

  const handleAssignTeam = (team: string) => {
    onAssignTeam(controlPoint.id, team);
  };

  return (
    <div className="control-point-edit-menu">
      <div className="control-point-edit-content">
        <h4 className="edit-title">Editar Punto</h4>
        
        {controlPoint.ownedByTeam && (
          <>
            <div
              className="ownership-status"
              style={{
                background: controlPoint.ownedByTeam,
                color: 'white',
                padding: '5px',
                borderRadius: '4px',
                marginBottom: '10px',
                textAlign: 'center',
                fontWeight: 'bold'
              }}
            >
              Controlado por: {controlPoint.ownedByTeam.toUpperCase()}
            </div>
            <div className="hold-time" style={{ fontSize: '12px', color: '#666', textAlign: 'center', marginBottom: '10px' }}>
              Tiempo: {controlPoint.displayTime || '00:00'}
            </div>
          </>
        )}
        
        <div className="form-group">
          <label className="form-label">Tipo:</label>
          <select
            id={`controlPointType_${controlPoint.id}`}
            defaultValue={controlPoint.type}
            className="form-input"
          >
            {hasOtherSite && controlPoint.type !== 'site' ? (
              <option value="control_point">Control Point</option>
            ) : (
              <>
                <option value="site">Site</option>
                <option value="control_point">Control Point</option>
              </>
            )}
          </select>
        </div>
        
        <div className="form-group">
          <label className="form-label">Nombre:</label>
          <input
            type="text"
            id={`controlPointEditName_${controlPoint.id}`}
            defaultValue={controlPoint.name}
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Asignar Equipo:</label>
          <div className="team-buttons" style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
            {/* None button to remove team assignment */}
            <button
              onClick={() => handleAssignTeam('none')}
              className="btn btn-none"
              style={{
                background: '#9E9E9E',
                color: 'white',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '12px',
                opacity: controlPoint.ownedByTeam === 'none' || !controlPoint.ownedByTeam ? 1 : 0.7
              }}
            >
              Ninguno
            </button>
            
            {/* Dynamic team buttons based on game team count */}
            {availableTeams.map(team => {
              const teamColors: Record<string, string> = {
                'blue': '#2196F3',
                'red': '#F44336',
                'green': '#4CAF50',
                'yellow': '#FFEB3B'
              };
              const teamNames: Record<string, string> = {
                'blue': 'Azul',
                'red': 'Rojo',
                'green': 'Verde',
                'yellow': 'Amarillo'
              };
              
              return (
                <button
                  key={team}
                  onClick={() => handleAssignTeam(team)}
                  className={`btn btn-${team}`}
                  style={{
                    background: teamColors[team],
                    color: team === 'yellow' ? 'black' : 'white',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    opacity: controlPoint.ownedByTeam === team ? 1 : 0.7
                  }}
                >
                  {teamNames[team]}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="challenges-section" style={{ marginTop: '15px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
          <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>Desafíos</h5>
          
          <PositionChallenge
            controlPoint={controlPoint}
            onToggle={onTogglePositionChallenge}
            onUpdate={onUpdatePositionChallenge}
          />
          
          <CodeChallenge
            controlPoint={controlPoint}
            onToggle={onToggleCodeChallenge}
            onUpdate={onUpdateCodeChallenge}
          />
          
          <BombChallenge
            controlPoint={controlPoint}
            onToggle={onToggleBombChallenge}
            onUpdate={onUpdateBombChallenge}
            onActivate={onActivateBomb}
            onDeactivate={onDeactivateBomb}
          />
        </div>
        
        <div className="action-buttons" style={{ marginTop: '15px', display: 'flex', gap: '5px', justifyContent: 'space-between' }}>
          <button 
            onClick={handleMove} 
            className="btn btn-move" 
            title="Mover punto"
            style={{ background: 'rgba(33, 150, 243, 0.2)', border: '1px solid #2196F3', color: '#2196F3', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
          >
            Mover
          </button>
          <button 
            onClick={handleUpdate} 
            className="btn btn-primary" 
            style={{ background: '#2196F3', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
          >
            Actualizar
          </button>
          <button 
            onClick={handleDelete} 
            className="btn btn-danger" 
            style={{ background: '#F44336', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};