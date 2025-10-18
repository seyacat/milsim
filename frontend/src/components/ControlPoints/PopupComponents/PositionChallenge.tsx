import React, { useState } from 'react';
import { ControlPoint } from '../../../types';

interface PositionChallengeProps {
  controlPoint: ControlPoint;
  onToggle: (controlPointId: number) => void;
  onUpdate: (controlPointId: number, minDistance: number, minAccuracy: number) => void;
}

export const PositionChallenge: React.FC<PositionChallengeProps> = ({
  controlPoint,
  onToggle,
  onUpdate
}) => {
  const [minDistance, setMinDistance] = useState(controlPoint.minDistance || 25);
  const [minAccuracy, setMinAccuracy] = useState(controlPoint.minAccuracy || 20);

  const handleToggle = () => {
    onToggle(controlPoint.id);
  };

  const handleDistanceChange = (value: number) => {
    setMinDistance(value);
    onUpdate(controlPoint.id, value, minAccuracy);
  };

  const handleAccuracyChange = (value: number) => {
    setMinAccuracy(value);
    onUpdate(controlPoint.id, minDistance, value);
  };

  return (
    <div className="challenge-item" style={{ marginBottom: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={controlPoint.hasPositionChallenge || false}
          onChange={handleToggle}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontSize: '13px' }}>Desafío de Posición</span>
      </label>
      {controlPoint.hasPositionChallenge && (
        <div style={{ marginTop: '5px', marginLeft: '20px' }}>
          <div className="form-group">
            <label className="form-label">Distancia Mínima:</label>
            <select 
              value={minDistance}
              onChange={(e) => handleDistanceChange(Number(e.target.value))}
              className="form-input"
            >
              <option value="5">5m (Muy cercano)</option>
              <option value="10">10m (Cercano)</option>
              <option value="25">25m (Medio)</option>
              <option value="50">50m (Lejano)</option>
              <option value="100">100m (Muy lejano)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Accuracy Mínimo:</label>
            <select 
              value={minAccuracy}
              onChange={(e) => handleAccuracyChange(Number(e.target.value))}
              className="form-input"
            >
              <option value="5">5m (Alta precisión)</option>
              <option value="10">10m (Buena precisión)</option>
              <option value="20">20m (Precisión media)</option>
              <option value="50">50m (Baja precisión)</option>
              <option value="100">100m (Muy baja precisión)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};