import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { WebsocketAuthService } from '../auth/websocket-auth.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, any>(); // socket.id -> user data

  constructor(
    private readonly gamesService: GamesService,
    private readonly websocketAuthService: WebsocketAuthService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      console.log(`Client connecting: ${client.id}`);
      
      // Authenticate the user
      const user = await this.websocketAuthService.authenticateSocket(client);
      
      // Store user data
      this.connectedUsers.set(client.id, user);
      
      console.log(`Client authenticated and connected: ${client.id}, User: ${user.id}`);
    } catch (error) {
      console.log(`Authentication failed for client: ${client.id}`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.connectedUsers.delete(client.id);
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    client: Socket,
    payload: { gameId: number },
  ) {
    const { gameId } = payload;
    const user = this.connectedUsers.get(client.id);
    
    if (!user) {
      client.emit('joinError', { message: 'User not authenticated' });
      return;
    }

    try {
      // Join the room for this specific game
      client.join(`game_${gameId}`);

      // Get updated game data
      const game = await this.gamesService.findOne(gameId);

      // Join the game via service
      await this.gamesService.joinGame(gameId, user.id);

      // Get updated game data
      const updatedGame = await this.gamesService.findOne(gameId);

      // Notify all clients in the game room about the updated player list
      this.server.to(`game_${gameId}`).emit('gameUpdate', {
        type: 'playerJoined',
        game: updatedGame,
      });

      client.emit('joinSuccess', {
        message: 'Successfully joined game',
        user: { id: user.id, name: user.name }
      });
    } catch (error: any) {
      client.emit('joinError', { message: 'Failed to join game' });
    }
  }

  @SubscribeMessage('leaveGame')
  async handleLeaveGame(
    client: Socket,
    payload: { gameId: number },
  ) {
    const { gameId } = payload;
    const user = this.connectedUsers.get(client.id);
    
    if (!user) {
      client.emit('leaveError', { message: 'User not authenticated' });
      return;
    }

    try {
      // Leave the game room
      client.leave(`game_${gameId}`);

      // Get updated game data
      const game = await this.gamesService.findOne(gameId);

      // Get updated game data
      const updatedGame = await this.gamesService.findOne(gameId);

      // Notify all clients in the game room about the updated player list
      this.server.to(`game_${gameId}`).emit('gameUpdate', {
        type: 'playerLeft',
        game: updatedGame,
      });

      client.emit('leaveSuccess', {
        message: 'Successfully left game',
        user: { id: user.id, name: user.name }
      });
    } catch (error: any) {
      client.emit('leaveError', { message: 'Failed to leave game' });
    }
  }

  @SubscribeMessage('gameAction')
  async handleGameAction(
    client: Socket,
    payload: { gameId: number; action: string; data: any },
  ) {
    const { gameId, action, data } = payload;

    try {
      switch (action) {
        case 'createControlPoint': {
          const newControlPoint = await this.gamesService.createControlPoint({
            name: data.name,
            description: data.description || '',
            latitude: data.latitude,
            longitude: data.longitude,
            gameId: data.gameId,
            type: data.type || 'control_point',
          });

          // Broadcast the new control point to all clients
          this.server.to(`game_${gameId}`).emit('gameAction', {
            action: 'controlPointCreated',
            data: newControlPoint,
            from: client.id,
          });
          break;
        }

        case 'updateControlPoint': {
          const updatedControlPoint = await this.gamesService.updateControlPoint(
            data.controlPointId,
            {
              name: data.name,
              type: data.type,
            },
          );

          // Broadcast the updated control point to all clients
          this.server.to(`game_${gameId}`).emit('gameAction', {
            action: 'controlPointUpdated',
            data: updatedControlPoint,
            from: client.id,
          });
          break;
        }

        case 'deleteControlPoint': {
          await this.gamesService.deleteControlPoint(data.controlPointId);

          // Broadcast the deletion to all clients
          this.server.to(`game_${gameId}`).emit('gameAction', {
            action: 'controlPointDeleted',
            data: { controlPointId: data.controlPointId },
            from: client.id,
          });
          break;
        }

        default:
          // For other actions, just broadcast as before
          this.server.to(`game_${gameId}`).emit('gameAction', {
            action,
            data,
            from: client.id,
          });
      }
    } catch (error: any) {
      // Send error back to the client that initiated the action
      client.emit('gameActionError', {
        action,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('getGameState')
  async handleGetGameState(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;

    try {
      const game = await this.gamesService.findOne(gameId);
      client.emit('gameState', game);
    } catch (error: any) {
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
