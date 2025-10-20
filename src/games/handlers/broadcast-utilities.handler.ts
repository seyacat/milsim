import { GamesService } from '../games.service';

export class BroadcastUtilitiesHandler {
  constructor(private readonly gamesService: GamesService) {}

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