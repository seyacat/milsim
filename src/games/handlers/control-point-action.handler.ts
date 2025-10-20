import { Socket } from 'socket.io';
import { GamesService } from '../games.service';
import { PositionChallengeService } from '../services/position-challenge.service';
import { TimerManagementService } from '../services/timer-management.service';
import { ConflictException } from '@nestjs/common';

export class ControlPointActionHandler {
  constructor(
    private readonly gamesService: GamesService,
    private readonly positionChallengeService: PositionChallengeService,
    private readonly timerManagementService: TimerManagementService,
  ) {}

  async handleCreateControlPoint(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    const newControlPoint = await this.gamesService.createControlPoint({
      name: data.name,
      description: data.description || '',
      latitude: data.latitude,
      longitude: data.longitude,
      gameId: data.gameId,
      type: data.type,
    });

    // Remove sensitive code data before broadcasting to all clients
    const { code, armedCode, disarmedCode, ...safeControlPoint } = newControlPoint;

    // Broadcast the new control point to all clients (without codes)
    server.to(`game_${gameId}`).emit('gameAction', {
      action: 'controlPointCreated',
      data: safeControlPoint,
      from: client.id,
    });

    // Send the full control point data (with codes) only to the owner
    if (user) {
      const game = await this.gamesService.findOne(gameId, user.id);
      if (game.owner && game.owner.id === user.id) {
        client.emit('gameAction', {
          action: 'controlPointCreated',
          data: newControlPoint, // Full data with codes
          from: client.id,
        });
      }
    }
  }

  async handleUpdateControlPoint(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      const updatedControlPoint = await this.gamesService.updateControlPoint(
        data.controlPointId,
        {
          name: data.name,
          type: data.type,
          challengeType: data.challengeType,
          code: data.code,
          armedCode: data.armedCode,
          disarmedCode: data.disarmedCode,
          minDistance: data.minDistance,
          minAccuracy: data.minAccuracy,
          hasPositionChallenge: data.hasPositionChallenge,
          hasCodeChallenge: data.hasCodeChallenge,
          hasBombChallenge: data.hasBombChallenge,
          bombTime: data.bombTime,
        },
      );

      // Get the complete updated game with all control points AFTER the update
      const updatedGame = await this.gamesService.findOne(gameId, user.id);

      // Remove sensitive code data before broadcasting to all clients
      const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

      // Calculate bomb status for this control point
      let bombStatus: any = null;
      if (updatedControlPoint.hasBombChallenge && updatedControlPoint.game?.instanceId) {
        const bombTimeData = await this.gamesService.getBombTime(updatedControlPoint.id);
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

      // Broadcast the updated control point to all clients (without codes)
      server.to(`game_${gameId}`).emit('gameAction', {
        action: 'controlPointUpdated',
        data: enhancedControlPoint,
        from: client.id,
      });

      // If this control point has position challenge, send current position challenge data
      if (safeControlPoint.hasPositionChallenge) {
        await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
      }

      // Send the full control point data (with codes) only to the owner
      if (user) {
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          client.emit('gameAction', {
            action: 'controlPointUpdated',
            data: updatedControlPoint, // Full data with codes
            from: client.id,
          });
        }
      }

      // Send position challenge data ONLY for the control point that was updated
      if (safeControlPoint.hasPositionChallenge) {
        await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
      }
    }
  }

  async handleUpdateControlPointPosition(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      const updatedControlPoint = await this.gamesService.updateControlPoint(
        data.controlPointId,
        {
          latitude: data.latitude,
          longitude: data.longitude,
        },
      );

      // Get the complete updated game with all control points AFTER the update
      const updatedGame = await this.gamesService.findOne(gameId, user.id);

      // Remove sensitive code data before broadcasting to all clients
      const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

      // Calculate bomb status for this control point
      let bombStatus: any = null;
      if (updatedControlPoint.hasBombChallenge && updatedControlPoint.game?.instanceId) {
        const bombTimeData = await this.gamesService.getBombTime(updatedControlPoint.id);
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

      // Broadcast the updated control point to all clients (without codes)
      server.to(`game_${gameId}`).emit('gameAction', {
        action: 'controlPointUpdated',
        data: enhancedControlPoint,
        from: client.id,
      });

      // If this control point has position challenge, send current position challenge data
      if (safeControlPoint.hasPositionChallenge) {
        await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
      }

      // Send the full control point data (with codes) only to the owner
      if (user) {
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          client.emit('gameAction', {
            action: 'controlPointUpdated',
            data: updatedControlPoint, // Full data with codes
            from: client.id,
          });
        }
      }

      // Send position challenge data ONLY for the control point that was updated
      if (safeControlPoint.hasPositionChallenge) {
        await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
      }
    }
  }

  async handleDeleteControlPoint(
    client: Socket,
    gameId: number,
    data: any,
    server: any,
  ) {
    await this.gamesService.deleteControlPoint(data.controlPointId);

    // Broadcast the deletion to all clients
    server.to(`game_${gameId}`).emit('gameAction', {
      action: 'controlPointDeleted',
      data: { controlPointId: data.controlPointId },
      from: client.id,
    });
  }

  async handleTakeControlPoint(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const result = await this.gamesService.takeControlPoint(
          data.controlPointId,
          user.id,
          data.code,
        );

        // Update control point timer with new ownership ONLY if it's not from position challenge
        // Position challenge changes should NOT stop the timer
        if (result.controlPoint.game?.instanceId && !data.positionChallenge) {
          await this.timerManagementService.updateControlPointTimer(
            data.controlPointId,
            result.controlPoint.game.instanceId,
            data.positionChallenge || false, // Pass position challenge flag
          );
        }

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

        // Broadcast the updated control point to all clients (without codes)
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'controlPointTaken',
          data: {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            team: result.controlPoint.ownedByTeam,
            controlPoint: enhancedControlPoint,
          },
          from: client.id,
        });

        // If this control point has position challenge, send current position challenge data
        if (safeControlPoint.hasPositionChallenge) {
          await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
        }

        // Send the full control point data (with codes) only to the owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          client.emit('gameAction', {
            action: 'controlPointTaken',
            data: {
              controlPointId: data.controlPointId,
              userId: user.id,
              userName: user.name,
              team: result.controlPoint.ownedByTeam,
              controlPoint: result.controlPoint, // Full data with codes
            },
            from: client.id,
          });
        }

        // Send position challenge data ONLY for the control point that was updated
        if (safeControlPoint.hasPositionChallenge) {
          await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
        }
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'takeControlPoint',
          error: error.message,
        });
      }
    }
  }

  async handleAssignControlPointTeam(
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
            'Solo el propietario del juego puede asignar equipos a puntos de control',
          );
        }

        // Update control point team - the updateControlPoint method already handles ownership change checks
        const updatedControlPoint = await this.gamesService.updateControlPoint(
          data.controlPointId,
          {
            ownedByTeam: data.team === 'none' ? null : data.team,
          },
        );

        // Note: The updateControlPoint method in control-point-management.service.ts
        // already handles ownership change checks and history logging internally
        // so we don't need to duplicate that logic here

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Remove sensitive code data before broadcasting to all clients
        const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

        // Calculate bomb status for this control point
        let bombStatus: any = null;
        if (updatedControlPoint.hasBombChallenge && updatedControlPoint.game?.instanceId) {
          const bombTimeData = await this.gamesService.getBombTime(updatedControlPoint.id);
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

        // Broadcast the updated control point to all clients (without codes)
        server.to(`game_${gameId}`).emit('gameAction', {
          action: 'controlPointTeamAssigned',
          data: {
            controlPointId: data.controlPointId,
            team: data.team,
            controlPoint: enhancedControlPoint,
          },
          from: client.id,
        });

        // If this control point has position challenge, send current position challenge data
        if (safeControlPoint.hasPositionChallenge) {
          await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
        }

        // Send the full control point data (with codes) only to the owner
        client.emit('gameAction', {
          action: 'controlPointTeamAssigned',
          data: {
            controlPointId: data.controlPointId,
            team: data.team,
            controlPoint: updatedControlPoint, // Full data with codes
          },
          from: client.id,
        });

        // Send position challenge data ONLY for the control point that was updated
        if (safeControlPoint.hasPositionChallenge) {
          await this.sendPositionChallengeUpdate(gameId, safeControlPoint.id, server);
        }
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'assignControlPointTeam',
          error: error.message,
        });
      }
    }
  }

  private async sendPositionChallengeUpdate(gameId: number, controlPointId: number, server: any) {
    try {
      const currentPositionChallengeData =
        await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
      const teamPoints = currentPositionChallengeData.get(controlPointId);
      if (teamPoints) {
        server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
          controlPointId,
          teamPoints,
        });
      }
    } catch (error) {
      console.error(
        `[CONTROL_POINT_ACTION] Error sending position challenge data for control point ${controlPointId}:`,
        error,
      );
    }
  }
}