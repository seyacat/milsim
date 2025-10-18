import React, { useState } from 'react';
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
  const [code, setCode] = useState(controlPoint.code || '');

  const handleToggle = () => {
    onToggle(controlPoint.id);
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    onUpdate(controlPoint.id, value);
  };

  return (
    <div className="challenge-item" style={{ marginBottom: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={controlPoint.hasCodeChallenge || false}
          onChange={handleToggle}
          style={{ marginRight: '8px' }}
        />
        <span style={{ fontSize: '13px' }}>Desafío de Código</span>
      </label>
      {controlPoint.hasCodeChallenge && (
        <div style={{ marginTop: '5px', marginLeft: '20px' }}>
          <div className="form-group">
            <label className="form-label">Code:</label>
            <input 
              type="text" 
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="form-input" 
              placeholder="Código para tomar"
            />
          </div>
        </div>
      )}
    </div>
  );
};