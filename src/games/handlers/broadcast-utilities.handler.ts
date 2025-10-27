import { GamesService } from '../games.service';
import { Game } from '../entities/game.entity';
import {
  GameStateChangedEvent,
  TeamCountUpdatedEvent,
  TimeAddedEvent,
  GameTimeUpdatedEvent,
  ControlPointCreatedEvent,
  ControlPointUpdatedEvent,
  ControlPointDeletedEvent,
  ControlPointTeamAssignedEvent,
  ControlPointTakenEvent,
  PlayerTeamUpdatedEvent,
  PositionUpdateEvent,
  PlayerPositionsResponseEvent,
  PlayerInactiveEvent,
  GameTimeEvent,
  TimeUpdateEvent,
  ControlPointTimeUpdateEvent,
  BombTimeUpdateEvent,
  ActiveBombTimersEvent,
  PositionChallengeUpdateEvent,
  BombActivatedEvent,
  BombDeactivatedEvent,
  BaseWebSocketEvent
} from '../types/websocket-events';

export class BroadcastUtilitiesHandler {
  constructor(private readonly gamesService: GamesService) {}

  /**
   * Broadcast game state changes as specific events
   */
  broadcastGameStateChange(
    gameId: number,
    game: Game,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: GameStateChangedEvent = {
      game,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('gameStateChanged', eventData);
  }

  /**
   * Broadcast team count updates as specific events
   */
  broadcastTeamCountUpdated(
    gameId: number,
    game: Game,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: TeamCountUpdatedEvent = {
      game,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('teamCountUpdated', eventData);
  }

  /**
   * Broadcast time added events as specific events
   */
  broadcastTimeAdded(
    gameId: number,
    game: Game,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: TimeAddedEvent = {
      game,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('timeAdded', eventData);
  }

  /**
   * Broadcast game time updates as specific events
   */
  broadcastGameTimeUpdated(
    gameId: number,
    game: Game,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: GameTimeUpdatedEvent = {
      game,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('gameTimeUpdated', eventData);
  }

  /**
   * Broadcast control point created events
   */
  broadcastControlPointCreated(
    gameId: number,
    controlPointData: any,
    server: any,
    from: string = 'server',
  ): void {
    // Handle both direct control point object and { controlPoint: ... } structure
    const controlPoint = controlPointData.controlPoint || controlPointData;
    
    const eventData: ControlPointCreatedEvent = {
      controlPoint,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('controlPointCreated', eventData);
  }

  /**
   * Broadcast control point updated events
   */
  broadcastControlPointUpdated(
    gameId: number,
    controlPointData: any,
    server: any,
    from: string = 'server',
  ): void {
    // Handle both direct control point object and { controlPoint: ... } structure
    const controlPoint = controlPointData.controlPoint || controlPointData;
    
    const eventData: ControlPointUpdatedEvent = {
      controlPoint,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('controlPointUpdated', eventData);
  }

  /**
   * Broadcast control point deleted events
   */
  broadcastControlPointDeleted(
    gameId: number,
    controlPointId: number,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: ControlPointDeletedEvent = {
      controlPointId,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('controlPointDeleted', eventData);
  }

  /**
   * Broadcast control point team assigned events
   */
  broadcastControlPointTeamAssigned(
    gameId: number,
    controlPointData: any,
    server: any,
    from: string = 'server',
  ): void {
    // Handle both direct control point object and { controlPoint: ... } structure
    const controlPoint = controlPointData.controlPoint || controlPointData;
    
    const eventData: ControlPointTeamAssignedEvent = {
      controlPoint,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('controlPointTeamAssigned', eventData);
  }

  /**
   * Broadcast control point taken events
   */
  broadcastControlPointTaken(
    gameId: number,
    controlPointData: any,
    userId: number,
    userName: string,
    team: string,
    server: any,
    from: string = 'server',
  ): void {
    // Handle both direct control point object and { controlPoint: ... } structure
    const controlPoint = controlPointData.controlPoint || controlPointData;
    
    const eventData: ControlPointTakenEvent = {
      controlPointId: controlPoint.id,
      userId,
      userName,
      team,
      controlPoint,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('controlPointTaken', eventData);
  }

  /**
   * Broadcast player team updated events
   */
  broadcastPlayerTeamUpdated(
    gameId: number,
    playerId: number,
    userId: number,
    team: string,
    userName?: string,
    server?: any,
    from: string = 'server',
  ): void {
    const eventData: PlayerTeamUpdatedEvent = {
      playerId,
      userId,
      team,
      userName,
      from,
      timestamp: new Date().toISOString(),
    };

    if (server) {
      server.to(`game_${gameId}`).emit('playerTeamUpdated', eventData);
    }
  }

  /**
   * Broadcast position update events
   */
  broadcastPositionUpdate(
    gameId: number,
    positionData: {
      userId: number;
      userName: string;
      lat: number;
      lng: number;
      accuracy: number;
    },
    server: any,
    from: string = 'server',
  ): void {
    const eventData: PositionUpdateEvent = {
      ...positionData,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('positionUpdate', eventData);
  }

  /**
   * Broadcast player positions response events
   */
  broadcastPlayerPositionsResponse(
    gameId: number,
    positions: Array<{
      userId: number;
      userName: string;
      lat: number;
      lng: number;
      accuracy: number;
    }>,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: PlayerPositionsResponseEvent = {
      positions,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('playerPositionsResponse', eventData);
  }

  /**
   * Broadcast player inactive events
   */
  broadcastPlayerInactive(
    gameId: number,
    userId: number,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: PlayerInactiveEvent = {
      userId,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('playerInactive', eventData);
  }

  /**
   * Broadcast game time events
   */
  broadcastGameTime(
    gameId: number,
    timeData: {
      remainingTime: number | null;
      totalTime: number | null;
      playedTime: number;
      controlPointTimes: Array<{
        controlPointId: number;
        currentHoldTime: number;
        currentTeam: string | null;
        displayTime: string;
      }>;
    },
    server: any,
    from: string = 'server',
  ): void {
    const eventData: GameTimeEvent = {
      ...timeData,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('gameTime', eventData);
  }

  /**
   * Broadcast time update events
   */
  async broadcastTimeUpdate(
    gameId: number,
    timeData: {
      remainingTime: number | null;
      totalTime: number | null;
      playedTime: number;
    },
    server: any,
    from: string = 'server',
  ): Promise<void> {
    try {
      // Get control point times for this game
      const controlPointTimes = await this.gamesService.getControlPointTimes(gameId);

      const eventData: TimeUpdateEvent = {
        ...timeData,
        controlPointTimes,
        from,
        timestamp: new Date().toISOString(),
      };

      server.to(`game_${gameId}`).emit('timeUpdate', eventData);
    } catch (error) {
      console.error(
        `[BROADCAST_TIME_UPDATE] Error broadcasting time update for game ${gameId}:`,
        error,
      );
      // Fallback: broadcast with consistent structure
      const eventData: TimeUpdateEvent = {
        ...timeData,
        controlPointTimes: [],
        from,
        timestamp: new Date().toISOString(),
      };
      server.to(`game_${gameId}`).emit('timeUpdate', eventData);
    }
  }

  /**
   * Broadcast control point time update events
   */
  broadcastControlPointTimeUpdate(
    controlPointId: number,
    timeData: {
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    },
    server: any,
    from: string = 'server',
  ): void {
    const eventData: ControlPointTimeUpdateEvent = {
      controlPointId,
      ...timeData,
      from,
      timestamp: new Date().toISOString(),
    };

    // Find the game that contains this control point
    this.gamesService.getControlPointWithGame(controlPointId)
      .then(controlPoint => {
        if (controlPoint && controlPoint.game) {
          server.to(`game_${controlPoint.game.id}`).emit('controlPointTimeUpdate', eventData);
        }
      })
      .catch(error => {
        console.error('Error broadcasting control point time update:', error);
      });
  }

  /**
   * Broadcast bomb time update events
   */
  broadcastBombTimeUpdate(
    controlPointId: number,
    bombTimeData: {
      remainingTime: number;
      totalTime: number;
      isActive: boolean;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
      exploded?: boolean;
    },
    server: any,
    from: string = 'server',
  ): void {
    const eventData: BombTimeUpdateEvent = {
      controlPointId,
      ...bombTimeData,
      from,
      timestamp: new Date().toISOString(),
    };

    // Find the game that contains this control point
    this.gamesService.getControlPointWithGame(controlPointId)
      .then(controlPoint => {
        if (controlPoint && controlPoint.game) {
          server.to(`game_${controlPoint.game.id}`).emit('bombTimeUpdate', eventData);
        }
      })
      .catch(error => {
        console.error('Error broadcasting bomb time update:', error);
      });
  }

  /**
   * Broadcast active bomb timers events
   */
  broadcastActiveBombTimers(
    gameId: number,
    timers: Array<{
      controlPointId: number;
      remainingTime: number;
      totalTime: number;
      isActive: boolean;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
    }>,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: ActiveBombTimersEvent = {
      timers,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('activeBombTimers', eventData);
  }

  /**
   * Broadcast position challenge update events
   */
  broadcastPositionChallengeUpdate(
    gameId: number,
    controlPointId: number,
    teamPoints: Record<string, number>,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: PositionChallengeUpdateEvent = {
      controlPointId,
      teamPoints,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('positionChallengeUpdate', eventData);
  }

  /**
   * Broadcast bomb activated events
   */
  broadcastBombActivated(
    gameId: number,
    bombData: any,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: BombActivatedEvent = {
      ...bombData,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('bombActivated', eventData);
  }

  /**
   * Broadcast bomb deactivated events
   */
  broadcastBombDeactivated(
    gameId: number,
    bombData: any,
    server: any,
    from: string = 'server',
  ): void {
    const eventData: BombDeactivatedEvent = {
      ...bombData,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('bombDeactivated', eventData);
  }

  /**
   * Broadcast game updates to all connected clients in a game
   */
  broadcastGameUpdate(gameId: number, game: Game, server: any): void {
    const eventData: BaseWebSocketEvent = {
      from: 'server',
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('gameUpdate', {
      type: 'gameUpdated',
      game,
      ...eventData,
    });
  }

  /**
   * DEPRECATED: Normalized function to broadcast game actions with consistent structure
   * Use specific event types instead
   */
  broadcastGameAction(
    gameId: number,
    action: string,
    data: any,
    server: any,
    from: string = 'server',
  ): void {
    const broadcastData = {
      action,
      data,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('gameAction', broadcastData);
  }
}