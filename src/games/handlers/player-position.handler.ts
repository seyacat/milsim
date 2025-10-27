import { Socket } from 'socket.io';
import { GamesService } from '../games.service';
import { BroadcastUtilitiesHandler } from './broadcast-utilities.handler';
import {
  PlayerPositionData,
  PositionUpdateData,
  PositionBroadcastData,
  PositionChallengeUpdateData
} from '../types/position-types';

export class PlayerPositionHandler {
  constructor(
    private readonly gamesService: GamesService,
    private readonly broadcastUtilities: BroadcastUtilitiesHandler,
  ) {}

  handlePositionUpdate(
    client: Socket,
    gameId: number,
    data: PositionUpdateData,
    connectedUsers: Map<string, any>,
    playerPositions: Map<number, PlayerPositionData>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      // Store the player's position with timestamp
      const positionData: PlayerPositionData = {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        socketId: client.id,
        lastUpdate: new Date(),
      };
      playerPositions.set(user.id, positionData);

      // Broadcast position update to all clients in the game using normalized function
      const broadcastData: PositionBroadcastData = {
        userId: user.id,
        userName: user.name,
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
      };
      this.broadcastUtilities.broadcastPositionUpdate(
        gameId,
        broadcastData,
        server,
        client.id,
      );
    }
  }

  handlePositionChallengeUpdate(
    client: Socket,
    gameId: number,
    data: PositionChallengeUpdateData,
    connectedUsers: Map<string, any>,
    playerPositions: Map<number, PlayerPositionData>,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      // Store the player's position for position challenge calculations
      const positionData: PlayerPositionData = {
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        socketId: client.id,
        lastUpdate: new Date(),
      };
      playerPositions.set(user.id, positionData);
    }
  }

  async handleRequestPlayerPositions(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    playerPositions: Map<number, PlayerPositionData>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      // Check if user is the game owner
      const game = await this.gamesService.findOne(gameId, user.id);
      if (game.owner && game.owner.id === user.id) {
        // Collect current positions of all connected players
        const positions: PositionBroadcastData[] = [];

        // Get all connected users in this game
        const gameRoom = server.sockets.adapter.rooms.get(`game_${gameId}`);
        if (gameRoom) {
          for (const socketId of gameRoom) {
            const connectedUser = connectedUsers.get(socketId);
            if (connectedUser && connectedUser.id !== user.id) {
              const position = playerPositions.get(connectedUser.id);
              if (position) {
                const positionData: PositionBroadcastData = {
                  userId: connectedUser.id,
                  userName: connectedUser.name,
                  lat: position.lat,
                  lng: position.lng,
                  accuracy: position.accuracy,
                };
                positions.push(positionData);
              }
            }
          }
        }

        // Send positions back to the requesting owner using normalized function
        this.broadcastUtilities.broadcastPlayerPositionsResponse(
          gameId,
          positions,
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
    playerPositions: Map<number, PlayerPositionData>,
    server: any,
  ): void {
    const now = new Date();
    const inactiveThreshold = 20000; // 20 seconds in milliseconds

    playerPositions.forEach((position, userId) => {
      const timeSinceLastUpdate = now.getTime() - position.lastUpdate.getTime();
      
      if (timeSinceLastUpdate > inactiveThreshold) {
        // Player is inactive, notify all clients in the game using normalized function
        this.broadcastUtilities.broadcastPlayerInactive(
          gameId,
          userId,
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
  getCurrentPlayerPositions(playerPositions: Map<number, PlayerPositionData>): Map<number, PlayerPositionData> {
    return playerPositions;
  }
}