import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gamesService: GamesService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(client: Socket, payload: { gameId: number; userId: number }) {
    const { gameId } = payload;

    try {
      // Join the room for this specific game
      client.join(`game_${gameId}`);

      // Get updated game data
      const game = await this.gamesService.findOne(gameId);

      // Notify all clients in the game room about the updated player list
      this.server.to(`game_${gameId}`).emit('gameUpdate', {
        type: 'playerJoined',
        game,
      });

      client.emit('joinSuccess', { message: 'Successfully joined game' });
    } catch (error) {
      client.emit('joinError', { message: 'Failed to join game' });
    }
  }

  @SubscribeMessage('leaveGame')
  async handleLeaveGame(client: Socket, payload: { gameId: number; userId: number }) {
    const { gameId } = payload;

    try {
      // Leave the game room
      client.leave(`game_${gameId}`);

      // Get updated game data
      const game = await this.gamesService.findOne(gameId);

      // Notify all clients in the game room about the updated player list
      this.server.to(`game_${gameId}`).emit('gameUpdate', {
        type: 'playerLeft',
        game,
      });

      client.emit('leaveSuccess', { message: 'Successfully left game' });
    } catch (error) {
      client.emit('leaveError', { message: 'Failed to leave game' });
    }
  }

  @SubscribeMessage('gameAction')
  async handleGameAction(client: Socket, payload: { gameId: number; action: string; data: any }) {
    const { gameId, action, data } = payload;

    // Broadcast the action to all clients in the game room
    this.server.to(`game_${gameId}`).emit('gameAction', {
      action,
      data,
      from: client.id,
    });
  }

  @SubscribeMessage('getGameState')
  async handleGetGameState(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;

    try {
      const game = await this.gamesService.findOne(gameId);
      client.emit('gameState', game);
    } catch (error) {
      client.emit('gameStateError', { message: 'Failed to get game state' });
    }
  }

  // Method to broadcast game updates to all connected clients in a game
  broadcastGameUpdate(gameId: number, game: any) {
    this.server.to(`game_${gameId}`).emit('gameUpdate', {
      type: 'gameUpdated',
      game,
    });
  }
}
