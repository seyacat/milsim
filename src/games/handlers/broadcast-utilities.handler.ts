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

      // Ensure coordinates are always present and properly formatted
      // Use fallback values if coordinates are missing
      const latitude = safeControlPoint.latitude ? parseFloat(safeControlPoint.latitude) : 0;
      const longitude = safeControlPoint.longitude ? parseFloat(safeControlPoint.longitude) : 0;
      
      if (isNaN(latitude) || isNaN(longitude)) {
        console.error(`[BROADCAST_CONTROL_POINT_UPDATE] Control point ${controlPoint.id} has invalid coordinates:`, {
          originalLatitude: safeControlPoint.latitude,
          originalLongitude: safeControlPoint.longitude,
          parsedLatitude: latitude,
          parsedLongitude: longitude,
          controlPoint: safeControlPoint
        });
        throw new Error(`Control point ${controlPoint.id} has invalid coordinates`);
      }

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

      // Create enhanced control point data with bomb status and validated coordinates
      const enhancedControlPoint = {
        ...safeControlPoint,
        latitude,
        longitude,
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
        timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Normalized function to broadcast game actions with consistent structure
   */
  broadcastGameAction(
    gameId: number,
    action: string,
    data: any,
    server: any,
    from: string = 'server',
  ) {
    const broadcastData = {
      action,
      data,
      from,
      timestamp: new Date().toISOString(),
    };

    server.to(`game_${gameId}`).emit('gameAction', broadcastData);
  }

  /**
   * Normalized function to broadcast time updates with consistent structure
   */
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

      // Broadcast combined time update with consistent structure
      server.to(`game_${gameId}`).emit('timeUpdate', {
        ...timeData,
        controlPointTimes,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `[BROADCAST_TIME_UPDATE] Error broadcasting time update for game ${gameId}:`,
        error,
      );
      // Fallback: broadcast with consistent structure
      console.error('[WEBSOCKET_SEND] Evento: timeUpdate');
      server.to(`game_${gameId}`).emit('timeUpdate', {
        ...timeData,
        controlPointTimes: [],
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Normalized function to broadcast control point time updates
   */
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
      // Find the game that contains this control point
      const controlPoint = await this.gamesService.getControlPointWithGame(controlPointId);

      const broadcastData = {
        controlPointId,
        ...timeData,
        timestamp: new Date().toISOString(),
      };

      if (controlPoint && controlPoint.game) {
        // Broadcast to the specific game room
        server.to(`game_${controlPoint.game.id}`).emit('controlPointTimeUpdate', broadcastData);
      } else {
        // Fallback: broadcast to all connected clients
        server.emit('controlPointTimeUpdate', broadcastData);
      }
    } catch (error) {
      console.error('Error broadcasting control point time update:', error);
      // Fallback: broadcast to all connected clients with consistent structure
      server.emit('controlPointTimeUpdate', {
        controlPointId,
        ...timeData,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Normalized function to broadcast bomb time updates
   */
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

      const broadcastData = {
        controlPointId,
        ...bombTimeData,
        timestamp: new Date().toISOString(),
      };

      if (controlPoint && controlPoint.game) {
        // Broadcast to the specific game room
        server.to(`game_${controlPoint.game.id}`).emit('bombTimeUpdate', broadcastData);
      } else {
        // Fallback: broadcast to all connected clients
        server.emit('bombTimeUpdate', broadcastData);
      }
    } catch (error) {
      console.error('Error broadcasting bomb time update:', error);
      // Fallback: broadcast to all connected clients with consistent structure
      server.emit('bombTimeUpdate', {
        controlPointId,
        ...bombTimeData,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Normalized function to broadcast position challenge updates
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
      timestamp: new Date().toISOString(),
    });
  }
}