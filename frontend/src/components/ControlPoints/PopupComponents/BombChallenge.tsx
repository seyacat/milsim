import React, { useState } from 'react';
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
  const [bombTime, setBombTime] = useState(controlPoint.bombTime || 180);
  const [armedCode, setArmedCode] = useState(controlPoint.armedCode || '');
  const [disarmedCode, setDisarmedCode] = useState(controlPoint.disarmedCode || '');

  const handleToggle = () => {
    onToggle(controlPoint.id);
  };

  const handleBombTimeChange = (value: number) => {
    setBombTime(value);
    onUpdate(controlPoint.id, value, armedCode, disarmedCode);
  };

  const handleArmedCodeChange = (value: string) => {
    setArmedCode(value);
    onUpdate(controlPoint.id, bombTime, value, disarmedCode);
  };

  const handleDisarmedCodeChange = (value: string) => {
    setDisarmedCode(value);
    onUpdate(controlPoint.id, bombTime, armedCode, value);
  };

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
          checked={controlPoint.hasBombChallenge || false}
          onChange={handleToggle}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontSize: '13px' }}>Desafío de Bomba</span>
      </label>
      {controlPoint.hasBombChallenge && (
        <div style={{ marginTop: '5px', marginLeft: '20px' }}>
          <div className="form-group">
            <label className="form-label">Bomb Time:</label>
            <select 
              value={bombTime}
              onChange={(e) => handleBombTimeChange(Number(e.target.value))}
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
              value={armedCode}
              onChange={(e) => handleArmedCodeChange(e.target.value)}
              className="form-input" 
              placeholder="Código para armar"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Disarmed Code:</label>
            <input 
              type="text" 
              value={disarmedCode}
              onChange={(e) => handleDisarmedCodeChange(e.target.value)}
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