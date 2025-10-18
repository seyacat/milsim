// Global functions for player interactions
export const setupGlobalPlayerFunctions = () => {
  (window as any).submitCodeChallenge = (controlPointId: number, code?: string) => {
    // If code is provided directly, use it
    let finalCode = code;
    
    // If code is not provided, try to get it from DOM input (for backward compatibility)
    if (!finalCode) {
      const codeInput = document.getElementById(`codeInput_${controlPointId}`) as HTMLInputElement;
      finalCode = codeInput?.value;
    }
    
    if (!finalCode || finalCode.trim() === '') {
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
          code: finalCode.trim(),
          userId: currentUser.id
        }
      });
      
      // Clear input after submission if we used DOM input
      if (!code) {
        const codeInput = document.getElementById(`codeInput_${controlPointId}`) as HTMLInputElement;
        if (codeInput) {
          codeInput.value = '';
        }
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

  (window as any).submitBombChallenge = (controlPointId: number, armedCode?: string) => {
    // If armedCode is provided directly, use it
    let finalArmedCode = armedCode;
    
    // If armedCode is not provided, try to get it from DOM input (for backward compatibility)
    if (!finalArmedCode) {
      const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`) as HTMLInputElement;
      finalArmedCode = armedCodeInput?.value;
    }
    
    if (!finalArmedCode || finalArmedCode.trim() === '') {
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
          armedCode: finalArmedCode.trim(),
          userId: currentUser.id
        }
      });
      
      // Clear input after submission if we used DOM input
      if (!armedCode) {
        const armedCodeInput = document.getElementById(`armedCodeInput_${controlPointId}`) as HTMLInputElement;
        if (armedCodeInput) {
          armedCodeInput.value = '';
        }
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

  (window as any).submitBombDeactivation = (controlPointId: number, disarmedCode?: string) => {
    // If disarmedCode is provided directly, use it
    let finalDisarmedCode = disarmedCode;
    
    // If disarmedCode is not provided, try to get it from DOM input (for backward compatibility)
    if (!finalDisarmedCode) {
      const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`) as HTMLInputElement;
      finalDisarmedCode = disarmedCodeInput?.value;
    }
    
    if (!finalDisarmedCode || finalDisarmedCode.trim() === '') {
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
          disarmedCode: finalDisarmedCode.trim(),
          userId: currentUser.id
        }
      });
      
      // Clear input after submission if we used DOM input
      if (!disarmedCode) {
        const disarmedCodeInput = document.getElementById(`disarmedCodeInput_${controlPointId}`) as HTMLInputElement;
        if (disarmedCodeInput) {
          disarmedCodeInput.value = '';
        }
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