import React, { useState } from 'react';
import { ControlPoint } from '../../../types';

interface PlayerPopupProps {
  controlPoint: ControlPoint;
  onSubmitCode: (controlPointId: number, code: string) => void;
  onSubmitBombChallenge: (controlPointId: number, armedCode: string) => void;
  onSubmitBombDeactivation: (controlPointId: number, disarmedCode: string) => void;
}

export const PlayerPopup: React.FC<PlayerPopupProps> = ({
  controlPoint,
  onSubmitCode,
  onSubmitBombChallenge,
  onSubmitBombDeactivation
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [armedCodeInput, setArmedCodeInput] = useState('');
  const [disarmedCodeInput, setDisarmedCodeInput] = useState('');

  const teamColors: Record<string, string> = {
    'blue': 'Azul',
    'red': 'Rojo',
    'green': 'Verde',
    'yellow': 'Amarillo'
  };

  const isGameRunning = true; // This should come from game state
  const canTakePoint = isGameRunning;

  const handleSubmitCode = () => {
    onSubmitCode(controlPoint.id, codeInput);
    setCodeInput('');
  };

  const handleSubmitBombChallenge = () => {
    onSubmitBombChallenge(controlPoint.id, armedCodeInput);
    setArmedCodeInput('');
  };

  const handleSubmitBombDeactivation = () => {
    onSubmitBombDeactivation(controlPoint.id, disarmedCodeInput);
    setDisarmedCodeInput('');
  };

  // Check if bomb is active using bombStatus from control point
  const isBombActive = controlPoint.bombStatus?.isActive || false;

  return (
    <div className="control-point-popup player">
      <div className="point-name" style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '10px' }}>
        {controlPoint.name}
      </div>
      
      {controlPoint.ownedByTeam && (
        <>
          <div 
            className="ownership-status" 
            style={{ color: controlPoint.ownedByTeam, fontWeight: 'bold' }}
          >
            Controlado por: {teamColors[controlPoint.ownedByTeam] || controlPoint.ownedByTeam}
          </div>
          <div className="hold-time" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            Tiempo: {controlPoint.displayTime || '00:00'}
          </div>
        </>
      )}
      
      {canTakePoint && controlPoint.hasCodeChallenge && (
        <div className="code-challenge-section" style={{ marginTop: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Código:</label>
          <input 
            type="text" 
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            placeholder="Ingresa el código"
          />
          <button 
            className="submit-code-button" 
            onClick={handleSubmitCode}
            style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Enviar Código
          </button>
        </div>
      )}
      
      {canTakePoint && controlPoint.hasBombChallenge && (
        <div className="bomb-challenge-section" style={{ marginTop: '10px' }}>
          {/* Bomb status indicator */}
          <div style={{
            marginBottom: '10px',
            padding: '8px',
            borderRadius: '4px',
            background: isBombActive ? '#FFEBEE' : '#E8F5E8',
            border: `1px solid ${isBombActive ? '#F44336' : '#4CAF50'}`,
            color: isBombActive ? '#C62828' : '#2E7D32',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {isBombActive ? (
              <>
                💣 Bomba ACTIVA
              </>
            ) : (
              '💣 Bomba INACTIVA'
            )}
          </div>

          {isBombActive ? (
            <>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Código Desactivación:</label>
              <input
                type="text"
                value={disarmedCodeInput}
                onChange={(e) => setDisarmedCodeInput(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="Ingresa el código de desactivación"
              />
              <button
                className="submit-bomb-button"
                onClick={handleSubmitBombDeactivation}
                style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Desactivar Bomba
              </button>
            </>
          ) : (
            <>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Código Armado:</label>
              <input
                type="text"
                value={armedCodeInput}
                onChange={(e) => setArmedCodeInput(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="Ingresa el código armado"
              />
              <button
                className="submit-bomb-button"
                onClick={handleSubmitBombChallenge}
                style={{ width: '100%', marginTop: '8px', padding: '8px', background: '#FF5722', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Activar Bomba
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};