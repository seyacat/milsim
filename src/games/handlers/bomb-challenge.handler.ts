import { Socket } from 'socket.io';
import { GamesService } from '../games.service';
import { BroadcastUtilitiesHandler } from './broadcast-utilities.handler';
import { ConflictException } from '@nestjs/common';

export class BombChallengeHandler {
  private broadcastUtilitiesHandler: BroadcastUtilitiesHandler;

  constructor(private readonly gamesService: GamesService) {
    this.broadcastUtilitiesHandler = new BroadcastUtilitiesHandler(gamesService);
  }

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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb activated action to all clients in the game room using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'bombActivated',
          {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
          },
          server,
          client.id,
        );

        // Use normalized broadcast function for control point updated event
        await this.broadcastUtilitiesHandler.broadcastControlPointUpdate(
          gameId,
          result.controlPoint,
          'controlPointUpdated',
          {},
          server,
        );

        // Send the full control point data (with codes) only to the owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          this.broadcastUtilitiesHandler.broadcastGameAction(
            gameId,
            'bombActivated',
            {
              controlPointId: data.controlPointId,
              userId: user.id,
              userName: user.name,
              controlPoint: result.controlPoint, // Full data with codes
            },
            server,
            client.id,
          );

          // Send full control point update to owner using normalized function
          this.broadcastUtilitiesHandler.broadcastGameAction(
            gameId,
            'controlPointUpdated',
            { controlPoint: result.controlPoint }, // Full data with codes
            server,
            client.id,
          );
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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb deactivated action to all clients in the game room using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'bombDeactivated',
          {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
          },
          server,
          client.id,
        );

        // Use normalized broadcast function for control point updated event
        await this.broadcastUtilitiesHandler.broadcastControlPointUpdate(
          gameId,
          result.controlPoint,
          'controlPointUpdated',
          {},
          server,
        );

        // Send the full control point data (with codes) only to the owner
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          this.broadcastUtilitiesHandler.broadcastGameAction(
            gameId,
            'bombDeactivated',
            {
              controlPointId: data.controlPointId,
              userId: user.id,
              userName: user.name,
              controlPoint: result.controlPoint, // Full data with codes
            },
            server,
            client.id,
          );

          // Send full control point update to owner using normalized function
          this.broadcastUtilitiesHandler.broadcastGameAction(
            gameId,
            'controlPointUpdated',
            { controlPoint: result.controlPoint }, // Full data with codes
            server,
            client.id,
          );
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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb activated action to all clients in the game room using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'bombActivated',
          {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            activatedByOwner: true,
          },
          server,
          client.id,
        );

        // Use normalized broadcast function for control point updated event
        await this.broadcastUtilitiesHandler.broadcastControlPointUpdate(
          gameId,
          result.controlPoint,
          'controlPointUpdated',
          {},
          server,
        );

        // Send the full control point data (with codes) only to the owner using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'bombActivated',
          {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: result.controlPoint, // Full data with codes
            activatedByOwner: true,
          },
          server,
          client.id,
        );

        // Send full control point update to owner using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'controlPointUpdated',
          { controlPoint: result.controlPoint }, // Full data with codes
          server,
          client.id,
        );

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

        // Get the complete updated game with all control points AFTER the update
        const updatedGame = await this.gamesService.findOne(gameId, user.id);

        // Broadcast bomb deactivated action to all clients in the game room using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'bombDeactivated',
          {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            deactivatedByOwner: true,
          },
          server,
          client.id,
        );

        // Use normalized broadcast function for control point updated event
        await this.broadcastUtilitiesHandler.broadcastControlPointUpdate(
          gameId,
          result.controlPoint,
          'controlPointUpdated',
          {},
          server,
        );

        // Send the full control point data (with codes) only to the owner using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'bombDeactivated',
          {
            controlPointId: data.controlPointId,
            userId: user.id,
            userName: user.name,
            controlPoint: result.controlPoint, // Full data with codes
            deactivatedByOwner: true,
          },
          server,
          client.id,
        );

        // Send full control point update to owner using normalized function
        this.broadcastUtilitiesHandler.broadcastGameAction(
          gameId,
          'controlPointUpdated',
          { controlPoint: result.controlPoint }, // Full data with codes
          server,
          client.id,
        );

      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'deactivateBombAsOwner',
          error: error.message,
        });
      }
    }
  }
}