import { Socket } from 'socket.io';
import { GamesService } from '../games.service';
import { ConflictException } from '@nestjs/common';

export class BombChallengeHandler {
  constructor(private readonly gamesService: GamesService) {}

  async handleActivateBomb(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        // Use the new activateBomb method
        const result = await this.gamesService.activateBomb(
          data.controlPointId,
          user.id,
          data.armedCode,
        );

        // Remove sensitive code data before broadcasting to all clients
        const { code, armedCode, disarmedCode, ...safeControlPoint } = result.controlPoint;

        // Calculate bomb status for this control point
        let bombStatus: any = null;
        if (result.controlPoint.hasBombChallenge && result.controlPoint.game?.instanceId) {
          const bombTimeData = await this.gamesService.getBombTime(result.controlPoint.id);
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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb activated action to all clients in the game room
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'bombActivated',
          data: {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: enhancedControlPoint,
          },
          from: client.id,
        });

        // Also send control point updated event to refresh the popup menu
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'controlPointUpdated',
          data: enhancedControlPoint,
          from: client.id,
        });

        // Send the full control point data (with codes) only to the owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          client.emit('gameAction', {
            action: 'bombActivated',
            data: {
              controlPointId: data.controlPointId,
              userId: user.id,
              userName: user.name,
              controlPoint: result.controlPoint, // Full data with codes
            },
            from: client.id,
          });

          // Send full control point update to owner
          client.emit('gameAction', {
            action: 'controlPointUpdated',
            data: result.controlPoint, // Full data with codes
            from: client.id,
          });
        }

      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'activateBomb',
          error: error.message,
        });
      }
    }
  }

  async handleDeactivateBomb(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        // Use the new deactivateBomb method
        const result = await this.gamesService.deactivateBomb(
          data.controlPointId,
          user.id,
          data.disarmedCode,
        );

        // Remove sensitive code data before broadcasting to all clients
        const { code, armedCode, disarmedCode, ...safeControlPoint } = result.controlPoint;

        // Calculate bomb status for this control point
        let bombStatus: any = null;
        if (result.controlPoint.hasBombChallenge && result.controlPoint.game?.instanceId) {
          const bombTimeData = await this.gamesService.getBombTime(result.controlPoint.id);
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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb deactivated action to all clients in the game room
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'bombDeactivated',
          data: {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: enhancedControlPoint,
          },
          from: client.id,
        });

        // Also send control point updated event to refresh the popup menu
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'controlPointUpdated',
          data: enhancedControlPoint,
          from: client.id,
        });

        // Send the full control point data (with codes) only to the owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          client.emit('gameAction', {
            action: 'bombDeactivated',
            data: {
              controlPointId: data.controlPointId,
              userId: user.id,
              userName: user.name,
              controlPoint: result.controlPoint, // Full data with codes
            },
            from: client.id,
          });

          // Send full control point update to owner
          client.emit('gameAction', {
            action: 'controlPointUpdated',
            data: result.controlPoint, // Full data with codes
            from: client.id,
          });
        }

      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'deactivateBomb',
          error: error.message,
        });
      }
    }
  }

  async handleActivateBombAsOwner(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        // Check if user is the game owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (!game.owner || game.owner.id !== user.id) {
          throw new ConflictException(
            'Solo el propietario del juego puede activar bombas sin código',
          );
        }

        // Use the new activateBombAsOwner method (no code validation)
        const result = await this.gamesService.activateBombAsOwner(
          data.controlPointId,
          user.id,
        );

        // Remove sensitive code data before broadcasting to all clients
        const { code, armedCode, disarmedCode, ...safeControlPoint } = result.controlPoint;

        // Calculate bomb status for this control point
        let bombStatus: any = null;
        if (result.controlPoint.hasBombChallenge && result.controlPoint.game?.instanceId) {
          const bombTimeData = await this.gamesService.getBombTime(result.controlPoint.id);
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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb activated action to all clients in the game room
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'bombActivated',
          data: {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: enhancedControlPoint,
            activatedByOwner: true,
          },
          from: client.id,
        });

        // Also send control point updated event to refresh the popup menu
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'controlPointUpdated',
          data: enhancedControlPoint,
          from: client.id,
        });

        // Send the full control point data (with codes) only to the owner
        client.emit('gameAction', {
          action: 'bombActivated',
          data: {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: result.controlPoint, // Full data with codes
            activatedByOwner: true,
          },
          from: client.id,
        });

        // Send full control point update to owner
        client.emit('gameAction', {
          action: 'controlPointUpdated',
          data: result.controlPoint, // Full data with codes
          from: client.id,
        });

      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'activateBombAsOwner',
          error: error.message,
        });
      }
    }
  }

  async handleDeactivateBombAsOwner(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        // Check if user is the game owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (!game.owner || game.owner.id !== user.id) {
          throw new ConflictException(
            'Solo el propietario del juego puede desactivar bombas sin código',
          );
        }

        // Use the new deactivateBombAsOwner method (no code validation)
        const result = await this.gamesService.deactivateBombAsOwner(
          data.controlPointId,
          user.id,
        );

        // Remove sensitive code data before broadcasting to all clients
        const { code, armedCode, disarmedCode, ...safeControlPoint } = result.controlPoint;

        // Calculate bomb status for this control point
        let bombStatus: any = null;
        if (result.controlPoint.hasBombChallenge && result.controlPoint.game?.instanceId) {
          const bombTimeData = await this.gamesService.getBombTime(result.controlPoint.id);
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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb deactivated action to all clients in the game room
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'bombDeactivated',
          data: {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: enhancedControlPoint,
            deactivatedByOwner: true,
          },
          from: client.id,
        });

        // Also send control point updated event to refresh the popup menu
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'controlPointUpdated',
          data: enhancedControlPoint,
          from: client.id,
        });

        // Send the full control point data (with codes) only to the owner
        client.emit('gameAction', {
          action: 'bombDeactivated',
          data: {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: result.controlPoint, // Full data with codes
            deactivatedByOwner: true,
          },
          from: client.id,
        });

        // Send full control point update to owner
        client.emit('gameAction', {
          action: 'controlPointUpdated',
          data: result.controlPoint, // Full data with codes
          from: client.id,
        });

      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'deactivateBombAsOwner',
          error: error.message,
        });
      }
    }
  }
}