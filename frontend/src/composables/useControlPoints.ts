import { ref } from 'vue'
import { useToast } from './useToast.js'
import { ControlPoint } from '../types/index.js'
import {
  ControlPointCreatedEvent,
  ControlPointUpdatedEvent,
  ControlPointTakenEvent,
  BombActivatedEvent,
  BombDeactivatedEvent,
  ControlPointTeamAssignedEvent
} from '../types/websocket-events.js'

export const useControlPoints = () => {
  const { addToast } = useToast()
  const showControlPointMenu = ref(false)
  const controlPointMenuPosition = ref({ lat: 0, lng: 0 })

  // Callbacks for specific WebSocket events
  const onControlPointCreated = (controlPoint: ControlPoint) => {
    console.log('Control point created:', controlPoint)
  }

  const onControlPointUpdated = (controlPoint: ControlPoint) => {
    console.log('Control point updated:', controlPoint)
  }

  const onControlPointDeleted = (controlPointId: number) => {
    console.log('Control point deleted:', controlPointId)
  }

  const onControlPointTeamAssigned = (data: ControlPointTeamAssignedEvent) => {
    console.log('Control point team assigned:', data)
  }

  const onControlPointTaken = (data: ControlPointTakenEvent) => {
    console.log('Control point taken:', data)
  }

  const onBombActivated = (data: BombActivatedEvent) => {
    console.log('Bomb activated:', data)
  }

  const onBombDeactivated = (data: BombDeactivatedEvent) => {
    console.log('Bomb deactivated:', data)
  }

  const createControlPoint = (
    socketRef: any,
    currentGame: any,
    lat: number,
    lng: number
  ) => {
    console.log('createControlPoint function called')
    console.log('socketRef:', socketRef)
    console.log('socketRef?.connected:', socketRef?.connected)
    console.log('currentGame.value:', currentGame?.value)
    
    if (!socketRef || !currentGame?.value) {
      console.log('createControlPoint: Missing socketRef or currentGame')
      return
    }

    try {
      console.log('Emitting createControlPoint gameAction')
      socketRef.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'createControlPoint',
        data: {
          latitude: lat,
          longitude: lng,
          name: `Control Point ${(currentGame.value.controlPoints?.length || 0) + 1}`,
          gameId: currentGame.value.id
        }
      })
      addToast({ message: 'Punto de control creado', type: 'success' })
    } catch (error) {
      console.error('Error creating control point:', error)
      addToast({ message: 'Error al crear punto de control', type: 'error' })
    }
  }

  const handleControlPointUpdate = (
    socketRef: any,
    currentGame: any,
    controlPointId: number,
    mapInstance: any
  ) => {
    console.log('handleControlPointUpdate called with:', controlPointId)
    console.log('socketRef:', socketRef)
    console.log('currentGame:', currentGame)
    if (!socketRef || !currentGame.value) {
      console.log('Missing socketRef or currentGame')
      return
    }

    try {
      // Get form values from DOM - read ALL values even if inputs are hidden
      const typeSelect = document.getElementById(`controlPointType_${controlPointId}`) as HTMLSelectElement
      const nameInput = document.getElementById(`controlPointEditName_${controlPointId}`) as HTMLInputElement
      const positionChallengeCheckbox = document.getElementById(`positionChallenge_${controlPointId}`) as HTMLInputElement
      const minDistanceSelect = document.getElementById(`controlPointMinDistance_${controlPointId}`) as HTMLSelectElement
      const minAccuracySelect = document.getElementById(`controlPointMinAccuracy_${controlPointId}`) as HTMLSelectElement
      const codeChallengeCheckbox = document.getElementById(`codeChallenge_${controlPointId}`) as HTMLInputElement
      const codeInput = document.getElementById(`controlPointCode_${controlPointId}`) as HTMLInputElement
      const bombChallengeCheckbox = document.getElementById(`bombChallenge_${controlPointId}`) as HTMLInputElement
      const bombTimeSelect = document.getElementById(`controlPointBombTime_${controlPointId}`) as HTMLSelectElement
      const armedCodeInput = document.getElementById(`controlPointArmedCode_${controlPointId}`) as HTMLInputElement
      const disarmedCodeInput = document.getElementById(`controlPointDisarmedCode_${controlPointId}`) as HTMLInputElement
      
      console.log('DOM elements found:')
      console.log('typeSelect:', typeSelect)
      console.log('nameInput:', nameInput)
      console.log('positionChallengeCheckbox:', positionChallengeCheckbox)

      // Validate required fields
      if (!nameInput?.value.trim()) {
        addToast({ message: 'Por favor ingresa un nombre para el punto', type: 'warning' })
        return
      }

      // Prepare update data following the original React structure
      const updateData = {
        controlPointId: controlPointId,
        name: nameInput.value.trim(),
        type: typeSelect?.value || 'control_point',
        hasPositionChallenge: positionChallengeCheckbox?.checked || false,
        hasCodeChallenge: codeChallengeCheckbox?.checked || false,
        hasBombChallenge: bombChallengeCheckbox?.checked || false
      }

      // Add position challenge values - always read from DOM even if inputs are hidden
      const minDistance = minDistanceSelect?.value || ''
      const minAccuracy = minAccuracySelect?.value || ''
      
      // Validate position challenge if checked
      if (positionChallengeCheckbox?.checked) {
        if (!minDistance) {
          addToast({ message: 'Para position challenge, debes ingresar una distancia mínima', type: 'warning' })
          return
        }
        if (!minAccuracy) {
          addToast({ message: 'Para position challenge, debes ingresar un accuracy mínimo', type: 'warning' })
          return
        }
      }
      
      // Always send position values (they will be null if not selected)
      ;(updateData as any).minDistance = minDistance ? parseInt(minDistance) : null
      ;(updateData as any).minAccuracy = minAccuracy ? parseInt(minAccuracy) : null

      // Add code challenge values - always read from DOM even if inputs are hidden
      const code = codeInput?.value.trim() || ''
      
      // Validate code challenge if checked
      if (codeChallengeCheckbox?.checked) {
        if (!code) {
          addToast({ message: 'Para code challenge, debes ingresar un código', type: 'warning' })
          return
        }
      }
      
      // Always send code value (it will be null if empty)
      ;(updateData as any).code = code || null

      // Add bomb challenge values - always read from DOM even if inputs are hidden
      const bombTime = bombTimeSelect?.value || ''
      const armedCode = armedCodeInput?.value.trim() || ''
      const disarmedCode = disarmedCodeInput?.value.trim() || ''
      
      // Validate bomb challenge if checked
      if (bombChallengeCheckbox?.checked) {
        if (!bombTime) {
          addToast({ message: 'Para bomb challenge, debes ingresar un tiempo', type: 'warning' })
          return
        }
        if (!armedCode) {
          addToast({ message: 'Para bomb challenge, debes ingresar un código para armar', type: 'warning' })
          return
        }
        if (!disarmedCode) {
          addToast({ message: 'Para bomb challenge, debes ingresar un código para desarmar', type: 'warning' })
          return
        }
      }
      
      // Always send bomb values (they will be null if not selected)
      ;(updateData as any).bombTime = bombTime ? parseInt(bombTime) : null
      ;(updateData as any).armedCode = armedCode || null
      ;(updateData as any).disarmedCode = disarmedCode || null

      // Send update via WebSocket following the original structure
      socketRef.emit('gameAction', {
        gameId: currentGame.value.id,
        action: 'updateControlPoint',
        data: updateData
      })

      addToast({ message: 'Punto actualizado exitosamente', type: 'success' })

      // Close the popup
      if (mapInstance.value) {
        mapInstance.value.closePopup()
      }
    } catch (error) {
      console.error('Error updating control point:', error)
      addToast({ message: 'Error al actualizar punto de control', type: 'error' })
    }
  }

  const handleControlPointDelete = (
    socketRef: any,
    currentGame: any,
    controlPointId: number,
    mapInstance: any
  ) => {
    if (socketRef && currentGame.value) {
      try {
        socketRef.emit('gameAction', {
          gameId: currentGame.value.id,
          action: 'deleteControlPoint',
          data: { controlPointId }
        })
        addToast({ message: 'Punto de control eliminado', type: 'success' })
        // Close the popup by finding and closing the current open popup
        if (mapInstance.value) {
          mapInstance.value.closePopup()
        }
      } catch (error) {
        console.error('Error deleting control point:', error)
        addToast({ message: 'Error al eliminar punto de control', type: 'error' })
      }
    }
  }

  const handleAssignTeam = (
    socketRef: any,
    currentGame: any,
    controlPointId: number,
    team: string
  ) => {
    if (socketRef && currentGame.value) {
      try {
        socketRef.emit('gameAction', {
          gameId: currentGame.value.id,
          action: 'assignControlPointTeam',
          data: { controlPointId, team: team === 'none' ? null : team }
        })
        addToast({ message: `Equipo asignado: ${team}`, type: 'success' })
      } catch (error) {
        console.error('Error assigning team:', error)
        addToast({ message: 'Error al asignar equipo', type: 'error' })
      }
    }
  }

  const handleToggleChallenge = (
    socketRef: any,
    currentGame: any,
    controlPointId: number,
    challengeType: 'position' | 'code' | 'bomb'
  ) => {
    if (socketRef && currentGame.value) {
      try {
        const actionMap = {
          position: 'togglePositionChallenge',
          code: 'toggleCodeChallenge',
          bomb: 'toggleBombChallenge'
        }

        socketRef.emit('gameAction', {
          gameId: currentGame.value.id,
          action: actionMap[challengeType],
          data: { controlPointId }
        })
        addToast({ message: `${challengeType} challenge actualizado`, type: 'success' })
      } catch (error) {
        console.error(`Error toggling ${challengeType} challenge:`, error)
        addToast({ message: `Error al actualizar ${challengeType} challenge`, type: 'error' })
      }
    }
  }

  const handleUpdateChallenge = (
    socketRef: any,
    currentGame: any,
    controlPointId: number,
    challengeType: 'position' | 'code' | 'bomb',
    value: any
  ) => {
    if (socketRef && currentGame.value) {
      try {
        const actionMap = {
          position: 'updatePositionChallenge',
          code: 'updateCodeChallenge',
          bomb: 'updateBombChallenge'
        }

        const dataMap = {
          position: { controlPointId, radius: value },
          code: { controlPointId, code: value },
          bomb: { controlPointId, time: value }
        }

        socketRef.emit('gameAction', {
          gameId: currentGame.value.id,
          action: actionMap[challengeType],
          data: dataMap[challengeType]
        })
        addToast({ message: `${challengeType} challenge actualizado`, type: 'success' })
      } catch (error) {
        console.error(`Error updating ${challengeType} challenge:`, error)
        addToast({ message: `Error al actualizar ${challengeType} challenge`, type: 'error' })
      }
    }
  }

  const handleActivateBomb = (
    socketRef: any,
    currentGame: any,
    controlPointId: number
  ) => {
    if (socketRef && currentGame.value) {
      try {
        // For owner, use activateBombAsOwner which doesn't require code
        socketRef.emit('gameAction', {
          gameId: currentGame.value.id,
          action: 'activateBombAsOwner',
          data: { controlPointId }
        })
        addToast({ message: 'Bomba activada', type: 'success' })
      } catch (error) {
        console.error('Error activating bomb:', error)
        addToast({ message: 'Error al activar bomba', type: 'error' })
      }
    }
  }

  const handleDeactivateBomb = (
    socketRef: any,
    currentGame: any,
    controlPointId: number
  ) => {
    if (socketRef && currentGame.value) {
      try {
        // For owner, use deactivateBombAsOwner which doesn't require code
        socketRef.emit('gameAction', {
          gameId: currentGame.value.id,
          action: 'deactivateBombAsOwner',
          data: { controlPointId }
        })
        addToast({ message: 'Bomba desactivada', type: 'success' })
      } catch (error) {
        console.error('Error deactivating bomb:', error)
        addToast({ message: 'Error al desactivar bomba', type: 'error' })
      }
    }
  }

  return {
    showControlPointMenu,
    controlPointMenuPosition,
    createControlPoint,
    handleControlPointUpdate,
    handleControlPointDelete,
    handleAssignTeam,
    handleToggleChallenge,
    handleUpdateChallenge,
    handleActivateBomb,
    handleDeactivateBomb,
    // Callbacks for specific WebSocket events
    onControlPointCreated,
    onControlPointUpdated,
    onControlPointDeleted,
    onControlPointTeamAssigned,
    onControlPointTaken,
    onBombActivated,
    onBombDeactivated
  }
}