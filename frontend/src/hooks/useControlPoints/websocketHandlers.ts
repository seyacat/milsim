// Global functions for player interactions
export const setupGlobalPlayerFunctions = () => {
  (window as any).submitCodeChallenge = (controlPointId: number) => {
    const codeInput = document.getElementById(`codeInput_${controlPointId}`) as HTMLInputElement;
    const code = codeInput?.value;
    
    if (!code || code.trim() === '') {
      // Use toast instead of alert
      if ((window as any).showToast) {
        (window as any).showToast('Por favor ingresa un código', 'warning');
      } else {
        console.warn('Por favor ingresa un código');
      }
      return;
    }

    // Get socket from global context or find another way to access it
    const socket = (window as any).currentSocket;
    const game = (window as any).currentGame;
    const currentUser = (window as any).currentUser;
    
    if (socket && game && currentUser) {
      socket.emit('gameAction', {
        gameId: game.id,
        action: 'takeControlPoint',
        data: {
          controlPointId: controlPointId,
          code: code.trim(),
          userId: currentUser.id
        }
      });
      
      // Clear input after submission
      if (codeInput) {
        codeInput.value = '';
      }
    } else {
      console.error('WebSocket connection not available');
      // Use toast instead of alert
      if ((window as any).showToast) {
        (window as any).showToast('Error: No hay conexión con el servidor', 'error');
      } else {
        console.error('Error: No hay conexión con el servidor');
      }
    }
  };

  (window as any).submitBombChallenge = (controlPointId: number) => {
    const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`) as HTMLInputElement;
    const armedCode = armedCodeInput?.value;
    
    if (!armedCode || armedCode.trim() === '') {
      // Use toast instead of alert
      if ((window as any).showToast) {
        (window as any).showToast('Por favor ingresa el código para armar la bomba', 'warning');
      } else {
        console.warn('Por favor ingresa el código para armar la bomba');
      }
      return;
    }

    // Get socket from global context or find another way to access it
    const socket = (window as any).currentSocket;
    const game = (window as any).currentGame;
    const currentUser = (window as any).currentUser;
    
    if (socket && game && currentUser) {
      socket.emit('gameAction', {
        gameId: game.id,
        action: 'activateBomb',
        data: {
          controlPointId: controlPointId,
          armedCode: armedCode.trim(),
          userId: currentUser.id
        }
      });
      
      // Clear input after submission
      if (armedCodeInput) {
        armedCodeInput.value = '';
      }
    } else {
      console.error('WebSocket connection not available');
      // Use toast instead of alert
      if ((window as any).showToast) {
        (window as any).showToast('Error: No hay conexión con el servidor', 'error');
      } else {
        console.error('Error: No hay conexión con el servidor');
      }
    }
  };

  (window as any).submitBombDeactivation = (controlPointId: number) => {
    const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`) as HTMLInputElement;
    const disarmedCode = disarmedCodeInput?.value;
    
    if (!disarmedCode || disarmedCode.trim() === '') {
      // Use toast instead of alert
      if ((window as any).showToast) {
        (window as any).showToast('Por favor ingresa el código para desarmar la bomba', 'warning');
      } else {
        console.warn('Por favor ingresa el código para desarmar la bomba');
      }
      return;
    }

    // Get socket from global context or find another way to access it
    const socket = (window as any).currentSocket;
    const game = (window as any).currentGame;
    const currentUser = (window as any).currentUser;
    
    if (socket && game && currentUser) {
      socket.emit('gameAction', {
        gameId: game.id,
        action: 'deactivateBomb',
        data: {
          controlPointId: controlPointId,
          disarmedCode: disarmedCode.trim(),
          userId: currentUser.id
        }
      });
      
      // Clear input after submission
      if (disarmedCodeInput) {
        disarmedCodeInput.value = '';
      }
    } else {
      console.error('WebSocket connection not available');
      // Use toast instead of alert
      if ((window as any).showToast) {
        (window as any).showToast('Error: No hay conexión con el servidor', 'error');
      } else {
        console.error('Error: No hay conexión con el servidor');
      }
    }
  };
};