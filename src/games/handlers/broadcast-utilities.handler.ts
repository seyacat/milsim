import { GamesService } from '../games.service';

export class BroadcastUtilitiesHandler {
  constructor(private readonly gamesService: GamesService) {}

  /**
   * Normalized function to broadcast control point updates with complete information
   */
  async broadcastControlPointUpdate(
    gameId: number,
    controlPoint: any,
    action: string,
    additionalData: any = {},
    server: any,
  ) {
    try {
      // Remove sensitive code data for non-owner clients
      const { code, armedCode, disarmedCode, ...safeControlPoint } = controlPoint;

      // Calculate bomb status for this control point
      let bombStatus: any = null;
      if (controlPoint.hasBombChallenge && controlPoint.game?.instanceId) {
        const bombTimeData = await this.gamesService.getBombTime(controlPoint.id);
        if (bombTimeData) {
          bombStatus = {
            isActive: bombTimeData.isActive,
            remainingTime: bombTimeData.remainingTime,
            totalTime: bombTimeData.totalTime,
            activatedByUserId: bombTimeData.activatedByUserId,
            activatedByUserName: bombTimeData.activatedByUserName,
            activatedByTeam: bombTimeData.activatedByTeam,
          };
        }
      }

      // Create enhanced control point data with bomb status
      const enhancedControlPoint = {
        ...safeControlPoint,
        bombStatus,
      };

      // Broadcast to all clients (without codes)
      const broadcastData = {
        action,
        data: {
          ...additionalData,
          controlPoint: enhancedControlPoint,
        },
        from: 'server',
      };

      server.to(`game_${gameId}`).emit('gameAction', broadcastData);

      // If this control point has position challenge, send current position challenge data
      if (safeControlPoint.hasPositionChallenge) {
        await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
      }

      return enhancedControlPoint;
    } catch (error) {
      console.error(`[BROADCAST_CONTROL_POINT_UPDATE] Error broadcasting control point update:`, error);
      throw error;
    }
  }

  /**
   * Send position challenge update for a specific control point
   */
  private sendPositionChallengeUpdate(gameId: number, controlPointId: number, server: any) {
    // This method would need access to positionChallengeService
    // For now, we'll leave this as a placeholder that can be implemented later
    // The actual implementation should be in ControlPointActionHandler
  }

  // Method to broadcast game updates to all connected clients in a game
  broadcastGameUpdate(gameId: number, game: any, server: any) {
    server.to(`game_${gameId}`).emit('gameUpdate', {
      type: 'gameUpdated',
      game,
    });
  }

  // Method to broadcast time updates to all connected clients in a game
  async broadcastTimeUpdate(
    gameId: number,
    timeData: {
      remainingTime: number | null;
      playedTime: number;
      totalTime: number | null;
    },
    server: any,
  ) {
    try {
      // Get control point times for this game
      const controlPointTimes = await this.gamesService.getControlPointTimes(gameId);

      // Broadcast combined time update with control point times
      server.to(`game_${gameId}`).emit('timeUpdate', {
        ...timeData,
        controlPointTimes,
      });
    } catch (error) {
      console.error(
        `[BROADCAST_TIME_UPDATE] Error broadcasting time update for game ${gameId}:`,
        error,
      );
      // Fallback: broadcast without control point times
      server.to(`game_${gameId}`).emit('timeUpdate', {
        ...timeData,
        controlPointTimes: [],
      });
    }
  }

  // Method to broadcast control point time updates to all connected clients in a game
  async broadcastControlPointTimeUpdate(
    controlPointId: number,
    timeData: {
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    },
    server: any,
  ) {
    try {
      // Find the game that contains this control point by using the takeControlPoint method structure
      // We'll get the control point with game relation through the service
      const controlPoint = await this.gamesService.getControlPointWithGame(controlPointId);

      if (controlPoint && controlPoint.game) {
        // Broadcast to the specific game room
        server.to(`game_${controlPoint.game.id}`).emit('controlPointTimeUpdate', {
          controlPointId,
          ...timeData,
        });
      } else {
        // Fallback: broadcast to all connected clients
        server.emit('controlPointTimeUpdate', {
          controlPointId,
          ...timeData,
        });
      }
    } catch (error) {
      console.error('Error broadcasting control point time update:', error);
      // Fallback: broadcast to all connected clients
      server.emit('controlPointTimeUpdate', {
        controlPointId,
        ...timeData,
      });
    }
  }

  // Method to broadcast bomb time updates to all connected clients in a game
  async broadcastBombTimeUpdate(
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
  ) {
    try {
      // Find the game that contains this control point
      const controlPoint = await this.gamesService.getControlPointWithGame(controlPointId);

      if (controlPoint && controlPoint.game) {
        // Broadcast to the specific game room
        server.to(`game_${controlPoint.game.id}`).emit('bombTimeUpdate', {
          controlPointId,
          ...bombTimeData,
        });
      } else {
        // Fallback: broadcast to all connected clients
        server.emit('bombTimeUpdate', {
          controlPointId,
          ...bombTimeData,
        });
      }
    } catch (error) {
      console.error('Error broadcasting bomb time update:', error);
      // Fallback: broadcast to all connected clients
      server.emit('bombTimeUpdate', {
        controlPointId,
        ...bombTimeData,
      });
    }
  }

  /**
   * Broadcast position challenge update to all clients in a game
   */
  broadcastPositionChallengeUpdate(
    gameId: number,
    controlPointId: number,
    teamPoints: Record<string, number>,
    server: any,
  ) {
    server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
      controlPointId,
      teamPoints,
    });
  }
}