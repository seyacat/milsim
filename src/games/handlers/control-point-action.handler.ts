import { Socket } from 'socket.io';
import { GamesService } from '../games.service';
import { PositionChallengeService } from '../services/position-challenge.service';
import { TimerManagementService } from '../services/timer-management.service';
import { BroadcastUtilitiesHandler } from './broadcast-utilities.handler';
import { ConflictException } from '@nestjs/common';

export class ControlPointActionHandler {
  private broadcastUtilitiesHandler: BroadcastUtilitiesHandler;

  constructor(
    private readonly gamesService: GamesService,
    private readonly positionChallengeService: PositionChallengeService,
    private readonly timerManagementService: TimerManagementService,
  ) {
    this.broadcastUtilitiesHandler = new BroadcastUtilitiesHandler(gamesService);
  }

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

    // Send the control point data to all clients (without codes)
    this.broadcastUtilitiesHandler.broadcastControlPointCreated(
      gameId,
      { controlPoint: newControlPoint },
      server,
      client.id,
    );

    // Send the full control point data (with codes) only to the owner
    if (user) {
      const game = await this.gamesService.findOne(gameId, user.id);
      if (game.owner && game.owner.id === user.id) {
        this.broadcastUtilitiesHandler.broadcastControlPointCreated(
          gameId,
          { controlPoint: newControlPoint }, // Full data with codes
          server,
          client.id,
        );
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

      // Send the control point data to all clients (without codes)
      this.broadcastUtilitiesHandler.broadcastControlPointUpdated(
        gameId,
        { controlPoint: updatedControlPoint },
        server,
        client.id,
      );

      // Send the full control point data (with codes) only to the owner
      if (user) {
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          this.broadcastUtilitiesHandler.broadcastControlPointUpdated(
            gameId,
            { controlPoint: updatedControlPoint }, // Full data with codes
            server,
            client.id,
          );
        }
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

      // Send the control point data to all clients (without codes)
      this.broadcastUtilitiesHandler.broadcastControlPointUpdated(
        gameId,
        { controlPoint: updatedControlPoint },
        server,
        client.id,
      );

      // Send the full control point data (with codes) only to the owner
      if (user) {
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          this.broadcastUtilitiesHandler.broadcastControlPointUpdated(
            gameId,
            { controlPoint: updatedControlPoint }, // Full data with codes
            server,
            client.id,
          );
        }
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

    // Broadcast the deletion to all clients using normalized function
    this.broadcastUtilitiesHandler.broadcastControlPointDeleted(
      gameId,
      data.controlPointId,
      server,
      client.id,
    );
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

        // Send the control point data to all clients (without codes)
        this.broadcastUtilitiesHandler.broadcastControlPointTaken(
          gameId,
          {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            team: result.controlPoint.ownedByTeam,
            controlPoint: result.controlPoint,
          },
          server,
          client.id,
        );

        // Send the full control point data (with codes) only to the owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          this.broadcastUtilitiesHandler.broadcastControlPointTaken(
            gameId,
            {
              controlPointId: data.controlPointId,
              userId: user.id,
              userName: user.name,
              team: result.controlPoint.ownedByTeam,
              controlPoint: result.controlPoint, // Full data with codes
            },
            server,
            client.id,
          );
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

        // Send the control point data to all clients (without codes)
        this.broadcastUtilitiesHandler.broadcastControlPointTeamAssigned(
          gameId,
          {
            controlPointId: data.controlPointId,
            team: data.team,
            controlPoint: updatedControlPoint,
          },
          server,
          client.id,
        );

        // Send the full control point data (with codes) only to the owner using normalized function
        this.broadcastUtilitiesHandler.broadcastControlPointTeamAssigned(
          gameId,
          {
            controlPointId: data.controlPointId,
            team: data.team,
            controlPoint: updatedControlPoint, // Full data with codes
          },
          server,
          client.id,
        );
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
        this.broadcastUtilitiesHandler.broadcastPositionChallengeUpdate(
          gameId,
          controlPointId,
          teamPoints,
          server,
        );
      }
    } catch (error) {
      console.error(
        `[CONTROL_POINT_ACTION] Error sending position challenge data for control point ${controlPointId}:`,
        error,
      );
    }
  }
}