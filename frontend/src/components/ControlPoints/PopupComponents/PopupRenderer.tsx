import React from 'react';
import ReactDOM from 'react-dom/client';
import { OwnerPopup } from './OwnerPopup';
import { PlayerPopup } from './PlayerPopup';
import { ControlPoint } from '../../../types';

interface PopupRendererProps {
  controlPoint: ControlPoint;
  markerId: number;
  isOwner: boolean;
  onUpdate?: (controlPointId: number, markerId: number) => void;
  onDelete?: (controlPointId: number, markerId: number) => void;
  onMove?: (controlPointId: number, markerId: number) => void;
  onAssignTeam?: (controlPointId: number, team: string) => void;
  onTogglePositionChallenge?: (controlPointId: number) => void;
  onToggleCodeChallenge?: (controlPointId: number) => void;
  onToggleBombChallenge?: (controlPointId: number) => void;
  onUpdatePositionChallenge?: (controlPointId: number, minDistance: number, minAccuracy: number) => void;
  onUpdateCodeChallenge?: (controlPointId: number, code: string) => void;
  onUpdateBombChallenge?: (controlPointId: number, bombTime: number, armedCode: string, disarmedCode: string) => void;
  onActivateBomb?: (controlPointId: number) => void;
  onDeactivateBomb?: (controlPointId: number) => void;
  onSubmitCode?: (controlPointId: number, code: string) => void;
  onSubmitBombChallenge?: (controlPointId: number, armedCode: string) => void;
  onSubmitBombDeactivation?: (controlPointId: number, disarmedCode: string) => void;
}

export const PopupRenderer: React.FC<PopupRendererProps> = ({
  controlPoint,
  markerId,
  isOwner,
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
  onDeactivateBomb,
  onSubmitCode,
  onSubmitBombChallenge,
  onSubmitBombDeactivation
}) => {
  if (isOwner) {
    return (
      <OwnerPopup
        controlPoint={controlPoint}
        markerId={markerId}
        onUpdate={onUpdate || (() => {})}
        onDelete={onDelete || (() => {})}
        onMove={onMove || (() => {})}
        onAssignTeam={onAssignTeam || (() => {})}
        onTogglePositionChallenge={onTogglePositionChallenge || (() => {})}
        onToggleCodeChallenge={onToggleCodeChallenge || (() => {})}
        onToggleBombChallenge={onToggleBombChallenge || (() => {})}
        onUpdatePositionChallenge={onUpdatePositionChallenge || (() => {})}
        onUpdateCodeChallenge={onUpdateCodeChallenge || (() => {})}
        onUpdateBombChallenge={onUpdateBombChallenge || (() => {})}
        onActivateBomb={onActivateBomb || (() => {})}
        onDeactivateBomb={onDeactivateBomb || (() => {})}
      />
    );
  } else {
    return (
      <PlayerPopup
        controlPoint={controlPoint}
        onSubmitCode={onSubmitCode || (() => {})}
        onSubmitBombChallenge={onSubmitBombChallenge || (() => {})}
        onSubmitBombDeactivation={onSubmitBombDeactivation || (() => {})}
      />
    );
  }
};

// Function to create popup content as HTMLElement (for use with Leaflet)
export const createPopupContent = (
  controlPoint: ControlPoint,
  markerId: number,
  isOwner: boolean,
  callbacks: {
    onUpdate?: (controlPointId: number, markerId: number) => void;
    onDelete?: (controlPointId: number, markerId: number) => void;
    onMove?: (controlPointId: number, markerId: number) => void;
    onAssignTeam?: (controlPointId: number, team: string) => void;
    onTogglePositionChallenge?: (controlPointId: number) => void;
    onToggleCodeChallenge?: (controlPointId: number) => void;
    onToggleBombChallenge?: (controlPointId: number) => void;
    onUpdatePositionChallenge?: (controlPointId: number, minDistance: number, minAccuracy: number) => void;
    onUpdateCodeChallenge?: (controlPointId: number, code: string) => void;
    onUpdateBombChallenge?: (controlPointId: number, bombTime: number, armedCode: string, disarmedCode: string) => void;
    onActivateBomb?: (controlPointId: number) => void;
    onDeactivateBomb?: (controlPointId: number) => void;
    onSubmitCode?: (controlPointId: number, code: string) => void;
    onSubmitBombChallenge?: (controlPointId: number, armedCode: string) => void;
    onSubmitBombDeactivation?: (controlPointId: number, disarmedCode: string) => void;
  }
): HTMLElement => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);
  
  root.render(
    <PopupRenderer
      controlPoint={controlPoint}
      markerId={markerId}
      isOwner={isOwner}
      {...callbacks}
    />
  );
  
  return container;
};