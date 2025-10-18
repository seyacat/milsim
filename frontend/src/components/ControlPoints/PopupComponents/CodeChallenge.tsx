import React, { useState, useEffect } from 'react';
import { ControlPoint } from '../../../types';

interface CodeChallengeProps {
  controlPoint: ControlPoint;
  onToggle: (controlPointId: number) => void;
  onUpdate: (controlPointId: number, code: string) => void;
}

export const CodeChallenge: React.FC<CodeChallengeProps> = ({
  controlPoint,
  onToggle,
  onUpdate
}) => {
  const [showInputs, setShowInputs] = useState(controlPoint.hasCodeChallenge || false);

  const handleToggle = () => {
    setShowInputs(!showInputs);
    onToggle(controlPoint.id);
  };

  // Update showInputs when controlPoint changes
  useEffect(() => {
    setShowInputs(controlPoint.hasCodeChallenge || false);
  }, [controlPoint.hasCodeChallenge]);

  return (
    <div className="challenge-item" style={{ marginBottom: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          id={`codeChallenge_${controlPoint.id}`}
          defaultChecked={controlPoint.hasCodeChallenge || false}
          onChange={handleToggle}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontSize: '13px' }}>Desafío de Código</span>
      </label>
      {showInputs && (
        <div id={`codeInputs_${controlPoint.id}`} style={{ marginTop: '5px', marginLeft: '20px' }}>
          <div className="form-group">
            <label className="form-label">Code:</label>
            <input
              type="text"
              id={`controlPointCode_${controlPoint.id}`}
              defaultValue={controlPoint.code || ''}
              className="form-input"
              placeholder="Código para tomar"
            />
          </div>
        </div>
      )}
    </div>
  );
};