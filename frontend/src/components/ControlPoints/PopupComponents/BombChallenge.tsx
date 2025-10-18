import React, { useState, useEffect } from 'react';
import { ControlPoint } from '../../../types';

interface BombChallengeProps {
  controlPoint: ControlPoint;
  onToggle: (controlPointId: number) => void;
  onUpdate: (controlPointId: number, bombTime: number, armedCode: string, disarmedCode: string) => void;
  onActivate: (controlPointId: number) => void;
  onDeactivate: (controlPointId: number) => void;
}

export const BombChallenge: React.FC<BombChallengeProps> = ({
  controlPoint,
  onToggle,
  onUpdate,
  onActivate,
  onDeactivate
}) => {
  const [showInputs, setShowInputs] = useState(controlPoint.hasBombChallenge || false);

  const handleToggle = () => {
    setShowInputs(!showInputs);
    onToggle(controlPoint.id);
  };

  // Update showInputs when controlPoint changes
  useEffect(() => {
    setShowInputs(controlPoint.hasBombChallenge || false);
  }, [controlPoint.hasBombChallenge]);

  const handleActivate = () => {
    onActivate(controlPoint.id);
  };

  const handleDeactivate = () => {
    onDeactivate(controlPoint.id);
  };

  return (
    <div className="challenge-item" style={{ marginBottom: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          id={`bombChallenge_${controlPoint.id}`}
          defaultChecked={controlPoint.hasBombChallenge || false}
          onChange={handleToggle}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontSize: '13px' }}>Desafío de Bomba</span>
      </label>
      {showInputs && (
        <div id={`bombInputs_${controlPoint.id}`} style={{ marginTop: '5px', marginLeft: '20px' }}>
          <div className="form-group">
            <label className="form-label">Bomb Time:</label>
            <select
              id={`controlPointBombTime_${controlPoint.id}`}
              defaultValue={controlPoint.bombTime || 180}
              className="form-input"
            >
              <option value="60">1 minuto</option>
              <option value="120">2 minutos</option>
              <option value="180">3 minutos</option>
              <option value="300">5 minutos</option>
              <option value="600">10 minutos</option>
              <option value="900">15 minutos</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Armed Code:</label>
            <input
              type="text"
              id={`controlPointArmedCode_${controlPoint.id}`}
              defaultValue={controlPoint.armedCode || ''}
              className="form-input"
              placeholder="Código para armar"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Disarmed Code:</label>
            <input
              type="text"
              id={`controlPointDisarmedCode_${controlPoint.id}`}
              defaultValue={controlPoint.disarmedCode || ''}
              className="form-input"
              placeholder="Código para desarmar"
            />
          </div>
          {controlPoint.hasBombChallenge && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
              <button
                onClick={handleActivate}
                className="btn btn-danger"
                style={{ background: '#F44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', fontSize: '12px' }}
              >
                Activar Bomba
              </button>
              <button
                onClick={handleDeactivate}
                className="btn btn-success"
                style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '3px', fontSize: '12px' }}
              >
                Desactivar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};