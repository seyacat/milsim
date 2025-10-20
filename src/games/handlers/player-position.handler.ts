import { Socket } from 'socket.io';
import { GamesService } from '../games.service';
import { BroadcastUtilitiesHandler } from './broadcast-utilities.handler';

export class PlayerPositionHandler {
  constructor(
    private readonly gamesService: GamesService,
    private readonly broadcastUtilities: BroadcastUtilitiesHandler,
  ) {}

  handlePositionUpdate(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    playerPositions: Map<number, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      // Store the player's position with timestamp
      playerPositions.set(user.id, {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        socketId: client.id,
        lastUpdate: new Date(),
      });

      // Broadcast position update to all clients in the game using normalized function
      this.broadcastUtilities.broadcastGameAction(
        gameId,
        'positionUpdate',
        {
          userId: user.id,
          userName: user.name,
          lat: data.lat,
          lng: data.lng,
          accuracy: data.accuracy,
        },
        server,
        client.id,
      );
    }
  }

  handlePositionChallengeUpdate(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    playerPositions: Map<number, any>,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      // Store the player's position for position challenge calculations
      playerPositions.set(user.id, {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        socketId: client.id,
        lastUpdate: new Date(),
      });
    }
  }

  async handleRequestPlayerPositions(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    playerPositions: Map<number, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      // Check if user is the game owner
      const game = await this.gamesService.findOne(gameId, user.id);
      if (game.owner && game.owner.id === user.id) {
        // Collect current positions of all connected players
        const positions: Array<{
          userId: number;
          userName: string;
          lat: number;
          lng: number;
          accuracy: number;
        }> = [];

        // Get all connected users in this game
        const gameRoom = server.sockets.adapter.rooms.get(`game_${gameId}`);
        if (gameRoom) {
          for (const socketId of gameRoom) {
            const connectedUser = connectedUsers.get(socketId);
            if (connectedUser && connectedUser.id !== user.id) {
              const position = playerPositions.get(connectedUser.id);
              if (position) {
                positions.push({
                  userId: connectedUser.id,
                  userName: connectedUser.name,
                  lat: position.lat,
                  lng: position.lng,
                  accuracy: position.accuracy,
                });
              }
            }
          }
        }

        // Send positions back to the requesting owner using normalized function
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'playerPositionsResponse',
          { positions },
          server,
          client.id,
        );
      }
    }
  }

  /**
   * Check for inactive players and notify frontend
   */
  checkInactivePlayers(
    gameId: number,
    playerPositions: Map<number, any>,
    server: any,
  ): void {
    const now = new Date();
    const inactiveThreshold = 20000; // 20 seconds in milliseconds

    playerPositions.forEach((position, userId) => {
      const timeSinceLastUpdate = now.getTime() - position.lastUpdate.getTime();
      
      if (timeSinceLastUpdate > inactiveThreshold) {
        // Player is inactive, notify all clients in the game using normalized function
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'playerInactive',
          {
            userId: userId,
            inactiveSince: position.lastUpdate,
          },
          server,
          'server',
        );

        // Remove the player's position from tracking
        playerPositions.delete(userId);
      }
    });
  }

  /**
   * Get current player positions for position challenge processing
   */
  getCurrentPlayerPositions(playerPositions: Map<number, any>): Map<number, any> {
    return playerPositions;
  }
}