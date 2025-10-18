import React, { useState, useEffect } from 'react';
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
  const [showInputs, setShowInputs] = useState(controlPoint.hasPositionChallenge || false);

  const handleToggle = () => {
    setShowInputs(!showInputs);
    onToggle(controlPoint.id);
  };

  // Update showInputs when controlPoint changes
  useEffect(() => {
    setShowInputs(controlPoint.hasPositionChallenge || false);
  }, [controlPoint.hasPositionChallenge]);

  return (
    <div className="challenge-item" style={{ marginBottom: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          id={`positionChallenge_${controlPoint.id}`}
          defaultChecked={controlPoint.hasPositionChallenge || false}
          onChange={handleToggle}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontSize: '13px' }}>Desafío de Posición</span>
      </label>
      {showInputs && (
        <div id={`positionInputs_${controlPoint.id}`} style={{ marginTop: '5px', marginLeft: '20px' }}>
          <div className="form-group">
            <label className="form-label">Distancia Mínima:</label>
            <select
              id={`controlPointMinDistance_${controlPoint.id}`}
              defaultValue={controlPoint.minDistance || 25}
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
              id={`controlPointMinAccuracy_${controlPoint.id}`}
              defaultValue={controlPoint.minAccuracy || 20}
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