import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, forwardRef, ConflictException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { WebsocketAuthService } from '../auth/websocket-auth.service';
import { AuthService } from '../auth/auth.service';
import { ConnectionTrackerService } from '../connection-tracker.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, any>(); // socket.id -> user data
  private playerPositions = new Map<
    number,
    { lat: number; lng: number; accuracy: number; socketId: string }
  >(); // user.id -> position data
  private gameConnections = new Map<number, Set<string>>(); // gameId -> Set of socket IDs

  constructor(
    @Inject(forwardRef(() => GamesService))
    private readonly gamesService: GamesService,
    private readonly websocketAuthService: WebsocketAuthService,
    private readonly connectionTracker: ConnectionTrackerService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Authenticate the user
      const user = await this.websocketAuthService.authenticateSocket(client);

      // Store user data
      this.connectedUsers.set(client.id, user);

      // Register connection for uptime tracking
      this.connectionTracker.registerConnection();
      console.log(
        `[CONNECTION_TRACKER] Connection registered for client ${client.id}, active connections: ${this.connectionTracker.getActiveConnectionsCount()}`,
      );
    } catch (error) {
      console.error(`Authentication failed for client: ${client.id}`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.playerPositions.delete(user.id);
    }
    this.connectedUsers.delete(client.id);

    // Remove client from all game connections and update counts
    for (const [gameId, connections] of this.gameConnections.entries()) {
      if (connections.has(client.id)) {
        connections.delete(client.id);
        const connectionCount = connections.size;
        this.gamesService
          .updateActiveConnections(gameId, connectionCount)
          .then(() => {
            console.log(
              `[DISCONNECT] Active connections updated for game ${gameId}: ${connectionCount}`,
            );
          })
          .catch(error => {
            console.error(`[DISCONNECT] Error updating connections for game ${gameId}:`, error);
          });
      }
    }

    // Unregister connection for uptime tracking
    this.connectionTracker.unregisterConnection();
    console.log(
      `[CONNECTION_TRACKER] Connection unregistered for client ${client.id}, active connections: ${this.connectionTracker.getActiveConnectionsCount()}`,
    );
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;
    const user = this.connectedUsers.get(client.id);

    console.log(`[JOIN_GAME_WS] Client ${client.id} attempting to join game ${gameId}`);
    console.log(`[JOIN_GAME_WS] User data:`, user);

    if (!user) {
      console.error(`[JOIN_GAME_WS] User not authenticated for client ${client.id}`);
      client.emit('joinError', { message: 'User not authenticated' });
      return;
    }

    try {
      // Check if user is already connected from another device
      let existingSocketId: string | null = null;
      this.connectedUsers.forEach((existingUser, socketId) => {
        if (existingUser.id === user.id && socketId !== client.id) {
          existingSocketId = socketId;
        }
      });

      // If user is already connected from another device, disconnect the old connection
      if (existingSocketId) {
        console.log(
          `[JOIN_GAME_WS] User ${user.id} is already connected from socket ${existingSocketId}, disconnecting...`,
        );

        // Send message to old device to leave the game
        const oldSocket = this.server.sockets.sockets.get(existingSocketId);
        if (oldSocket) {
          oldSocket.emit('forceDisconnect', {
            message: 'Has sido desconectado porque te has conectado desde otro dispositivo',
          });
          oldSocket.disconnect();
        }

        // Remove old connection from tracking
        this.connectedUsers.delete(existingSocketId);
        this.playerPositions.delete(user.id);
      }

      // Join the room for this specific game
      client.join(`game_${gameId}`);
      console.log(`[JOIN_GAME_WS] Client ${client.id} joined room game_${gameId}`);

      // Track game connection
      if (!this.gameConnections.has(gameId)) {
        this.gameConnections.set(gameId, new Set());
      }
      this.gameConnections.get(gameId)?.add(client.id);

      // Update active connections count in the game
      const connectionCount = this.gameConnections.get(gameId)?.size || 0;
      await this.gamesService.updateActiveConnections(gameId, connectionCount);
      console.log(
        `[JOIN_GAME_WS] Active connections updated for game ${gameId}: ${connectionCount}`,
      );

      // Get updated game data
      const game = await this.gamesService.findOne(gameId, user.id);
      console.log(`[JOIN_GAME_WS] Game data retrieved:`, game?.name);

      // Join the game via service (this will handle the case where user is already in the game)
      await this.gamesService.joinGame(gameId, user.id);
      console.log(`[JOIN_GAME_WS] User ${user.id} joined game ${gameId} via service`);

      // Get updated game data
      const updatedGame = await this.gamesService.findOne(gameId, user.id);
      console.log(`[JOIN_GAME_WS] Updated game data:`, updatedGame?.players?.length, 'players');

      // Notify all clients in the game room about the updated player list
      this.server.to(`game_${gameId}`).emit('gameUpdate', {
        type: 'playerJoined',
        game: updatedGame,
      });
      console.log(`[JOIN_GAME_WS] Game update broadcasted to room game_${gameId}`);

      // Check if user is owner and send stored positions
      const currentGame = await this.gamesService.findOne(gameId, user.id);
      if (currentGame.owner && currentGame.owner.id === user.id) {
        console.log(`[JOIN_GAME_WS] User ${user.id} is owner, sending stored positions`);
        // Send all stored positions to the owner
        const positions: Array<{
          userId: number;
          userName: string;
          lat: number;
          lng: number;
          accuracy: number;
        }> = [];
        this.playerPositions.forEach((position, userId) => {
          const connectedUser = Array.from(this.connectedUsers.values()).find(u => u.id === userId);
          if (connectedUser) {
            positions.push({
              userId: userId,
              userName: connectedUser.name,
              lat: position.lat,
              lng: position.lng,
              accuracy: position.accuracy,
            });
          }
        });

        if (positions.length > 0) {
          client.emit('gameAction', {
            action: 'playerPositionsResponse',
            data: { positions },
            from: 'server',
          });
          console.log(`[JOIN_GAME_WS] Sent ${positions.length} positions to owner`);
        }
      }

      client.emit('joinSuccess', {
        message: 'Successfully joined game',
        user: { id: user.id, name: user.name },
      });
      console.log(`[JOIN_GAME_WS] Join success sent to client ${client.id}`);
    } catch (error: any) {
      console.error('[JOIN_GAME_WS] Error joining game:', error);
      console.error('[JOIN_GAME_WS] Error details:', error.message, error.stack);
      client.emit('joinError', { message: error.message });
    }
  }

  @SubscribeMessage('leaveGame')
  async handleLeaveGame(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;
    const user = this.connectedUsers.get(client.id);

    if (!user) {
      client.emit('leaveError', { message: 'User not authenticated' });
      return;
    }

    try {
      // Leave the game room
      client.leave(`game_${gameId}`);

      // Remove game connection
      this.gameConnections.get(gameId)?.delete(client.id);

      // Update active connections count in the game
      const connectionCount = this.gameConnections.get(gameId)?.size || 0;
      await this.gamesService.updateActiveConnections(gameId, connectionCount);
      console.log(
        `[LEAVE_GAME_WS] Active connections updated for game ${gameId}: ${connectionCount}`,
      );

      // Get updated game data
      const game = await this.gamesService.findOne(gameId, user.id);

      // Get updated game data
      const updatedGame = await this.gamesService.findOne(gameId, user.id);

      // Notify all clients in the game room about the updated player list
      this.server.to(`game_${gameId}`).emit('gameUpdate', {
        type: 'playerLeft',
        game: updatedGame,
      });

      client.emit('leaveSuccess', {
        message: 'Successfully left game',
        user: { id: user.id, name: user.name },
      });
    } catch (error: any) {
      client.emit('leaveError', { message: 'Failed to leave game' });
    }
  }

  @SubscribeMessage('gameAction')
  async handleGameAction(client: Socket, payload: { gameId: number; action: string; data: any }) {
    const { gameId, action, data } = payload;

    try {
      switch (action) {
        case 'createControlPoint': {
          const user = this.connectedUsers.get(client.id);
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
          this.server.to(`game_${gameId}`).emit('gameAction', {
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
          break;
        }

        case 'updateControlPoint': {
          const user = this.connectedUsers.get(client.id);
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

            console.log('[UPDATE_CONTROL_POINT] Updated control point data:', {
              id: updatedControlPoint.id,
              name: updatedControlPoint.name,
              hasCodeChallenge: updatedControlPoint.hasCodeChallenge,
              hasBombChallenge: updatedControlPoint.hasBombChallenge,
              hasPositionChallenge: updatedControlPoint.hasPositionChallenge,
              // Don't log code values for security
            });

            console.log('[UPDATE_CONTROL_POINT] Updated game data:', {
              controlPointsCount: updatedGame.controlPoints?.length,
              firstControlPoint: updatedGame.controlPoints?.[0],
            });

            // Remove sensitive code data before broadcasting to all clients
            const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

            // Broadcast the updated control point to all clients (without codes)
            this.server.to(`game_${gameId}`).emit('gameAction', {
              action: 'controlPointUpdated',
              data: safeControlPoint,
              from: client.id,
            });

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

            // Also broadcast the complete game update so frontend has all control points
            this.server.to(`game_${gameId}`).emit('gameUpdate', {
              type: 'gameUpdated',
              game: updatedGame,
            });
          }
          break;
        }

        case 'updateControlPointPosition': {
          const user = this.connectedUsers.get(client.id);
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

            console.log('[UPDATE_CONTROL_POINT_POSITION] Updated control point position:', {
              controlPointId: data.controlPointId,
              latitude: data.latitude,
              longitude: data.longitude,
            });

            // Remove sensitive code data before broadcasting to all clients
            const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

            // Broadcast the updated control point to all clients (without codes)
            this.server.to(`game_${gameId}`).emit('gameAction', {
              action: 'controlPointUpdated',
              data: safeControlPoint,
              from: client.id,
            });

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

            // Also broadcast the complete game update so frontend has all control points
            this.server.to(`game_${gameId}`).emit('gameUpdate', {
              type: 'gameUpdated',
              game: updatedGame,
            });
          }
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

        case 'positionUpdate': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            // Store the player's position
            this.playerPositions.set(user.id, {
              lat: data.lat,
              lng: data.lng,
              accuracy: data.accuracy,
              socketId: client.id,
            });

            // Broadcast position update to all clients in the game
            this.server.to(`game_${gameId}`).emit('gameAction', {
              action: 'positionUpdate',
              data: {
                userId: user.id,
                userName: user.name,
                lat: data.lat,
                lng: data.lng,
                accuracy: data.accuracy,
              },
              from: client.id,
            });
          }
          break;
        }

        case 'takeControlPoint': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const updatedControlPoint = await this.gamesService.takeControlPoint(
                data.controlPointId,
                user.id,
                data.code,
              );

              // Remove sensitive code data before broadcasting to all clients
              const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

              // Get the complete updated game with all control points AFTER the update
              const updatedGame = await this.gamesService.findOne(gameId, user.id);

              // Broadcast the updated control point to all clients (without codes)
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'controlPointTaken',
                data: {
                  controlPointId: data.controlPointId,
                  userId: user.id,
                  userName: user.name,
                  team: updatedControlPoint.ownedByTeam,
                  controlPoint: safeControlPoint,
                },
                from: client.id,
              });

              // Send the full control point data (with codes) only to the owner
              const game = await this.gamesService.findOne(gameId, user.id);
              if (game.owner && game.owner.id === user.id) {
                client.emit('gameAction', {
                  action: 'controlPointTaken',
                  data: {
                    controlPointId: data.controlPointId,
                    userId: user.id,
                    userName: user.name,
                    team: updatedControlPoint.ownedByTeam,
                    controlPoint: updatedControlPoint, // Full data with codes
                  },
                  from: client.id,
                });
              }

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'takeControlPoint',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'assignControlPointTeam': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              // Check if user is the game owner
              const game = await this.gamesService.findOne(gameId, user.id);
              if (!game.owner || game.owner.id !== user.id) {
                throw new ConflictException(
                  'Solo el propietario del juego puede asignar equipos a puntos de control',
                );
              }

              // Update control point team
              const updatedControlPoint = await this.gamesService.updateControlPoint(
                data.controlPointId,
                {
                  ownedByTeam: data.team === 'none' ? null : data.team,
                },
              );

              // Add game history event for team assignment by owner
              if (updatedControlPoint.game?.instanceId) {
                await this.gamesService.addGameHistory(
                  updatedControlPoint.game.instanceId,
                  'control_point_taken',
                  {
                    controlPointId: data.controlPointId,
                    controlPointName: updatedControlPoint.name,
                    team: data.team === 'none' ? null : data.team,
                    userId: user.id,
                    assignedByOwner: true,
                    timestamp: new Date(),
                  },
                );

                // Update control point timer with new ownership
                await this.gamesService.updateControlPointTimer(
                  data.controlPointId,
                  updatedControlPoint.game.instanceId,
                );
              }

              // Get the complete updated game with all control points AFTER the update
              const updatedGame = await this.gamesService.findOne(gameId, user.id);

              // Remove sensitive code data before broadcasting to all clients
              const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

              // Broadcast the updated control point to all clients (without codes)
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'controlPointTeamAssigned',
                data: {
                  controlPointId: data.controlPointId,
                  team: data.team,
                  controlPoint: safeControlPoint,
                },
                from: client.id,
              });

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

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'assignControlPointTeam',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'updatePlayerTeam': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              let playerId = data.playerId;

              // If playerId is not provided but userId is, find the player by userId
              if (!playerId && data.userId) {
                const game = await this.gamesService.findOne(gameId, user.id);
                const player = game.players?.find(p => p.user.id === data.userId);
                if (player) {
                  playerId = player.id;
                } else {
                  throw new Error('No se pudo encontrar el jugador para el usuario');
                }
              }

              const updatedPlayer = await this.gamesService.updatePlayerTeam(playerId, data.team);

              // Broadcast the team update to all clients
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'playerTeamUpdated',
                data: {
                  playerId: playerId,
                  userId: updatedPlayer.user.id,
                  userName: updatedPlayer.user.name,
                  team: data.team,
                },
                from: client.id,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'updatePlayerTeam',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'startGame': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const startedGame = await this.gamesService.startGame(gameId, user.id);
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'gameStateChanged',
                data: { game: startedGame },
                from: client.id,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'startGame',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'pauseGame': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const pausedGame = await this.gamesService.pauseGame(gameId, user.id);
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'gameStateChanged',
                data: { game: pausedGame },
                from: client.id,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'pauseGame',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'resumeGame': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const resumedGame = await this.gamesService.resumeGame(gameId, user.id);
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'gameStateChanged',
                data: { game: resumedGame },
                from: client.id,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'resumeGame',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'endGame': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const endedGame = await this.gamesService.endGame(gameId, user.id);
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'gameStateChanged',
                data: { game: endedGame },
                from: client.id,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'endGame',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'restartGame': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const restartedGame = await this.gamesService.restartGame(gameId, user.id);
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'gameStateChanged',
                data: { game: restartedGame },
                from: client.id,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'restartGame',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'updateTeamCount': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const updatedGame = await this.gamesService.updateTeamCount(
                gameId,
                data.teamCount,
                user.id,
              );
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'teamCountUpdated',
                data: { game: updatedGame },
                from: client.id,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'updateTeamCount',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'addTime': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const game = await this.gamesService.findOne(gameId, user.id);
              if (game.owner && game.owner.id === user.id) {
                const updatedGame = await this.gamesService.addTime(gameId, data.seconds);
                this.server.to(`game_${gameId}`).emit('gameAction', {
                  action: 'timeAdded',
                  data: { game: updatedGame },
                  from: client.id,
                });
              }
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'addTime',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'updateGameTime': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const game = await this.gamesService.findOne(gameId, user.id);
              if (game.owner && game.owner.id === user.id) {
                const updatedGame = await this.gamesService.updateGameTime(
                  gameId,
                  data.timeInSeconds,
                  user.id,
                );
                this.server.to(`game_${gameId}`).emit('gameAction', {
                  action: 'gameTimeUpdated',
                  data: { game: updatedGame },
                  from: client.id,
                });
              }
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'updateGameTime',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'requestPlayerPositions': {
          const user = this.connectedUsers.get(client.id);
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
              const gameRoom = this.server.sockets.adapter.rooms.get(`game_${gameId}`);
              if (gameRoom) {
                for (const socketId of gameRoom) {
                  const connectedUser = this.connectedUsers.get(socketId);
                  if (connectedUser && connectedUser.id !== user.id) {
                    const position = this.playerPositions.get(connectedUser.id);
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

              // Send positions back to the requesting owner
              client.emit('gameAction', {
                action: 'playerPositionsResponse',
                data: { positions },
                from: client.id,
              });
            }
          }
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
    const user = this.connectedUsers.get(client.id);

    try {
      const game = await this.gamesService.findOne(gameId, user?.id);
      client.emit('gameState', game);
    } catch (error: any) {
      client.emit('gameStateError', { message: 'Failed to get game state' });
    }
  }

  @SubscribeMessage('getGameTime')
  async handleGetGameTime(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;

    try {
      const timeData = await this.gamesService.getGameTime(gameId);
      client.emit('gameTime', timeData);
    } catch (error: any) {
      client.emit('gameTimeError', { message: 'Failed to get game time' });
    }
  }

  @SubscribeMessage('getControlPointTimes')
  async handleGetControlPointTimes(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;
    const user = this.connectedUsers.get(client.id);

    try {
      const controlPointTimes = await this.gamesService.getControlPointTimes(gameId);
      client.emit('controlPointTimes', controlPointTimes);
    } catch (error: any) {
      client.emit('controlPointTimesError', { message: 'Failed to get control point times' });
    }
  }

  // Method to broadcast game updates to all connected clients in a game
  broadcastGameUpdate(gameId: number, game: any) {
    this.server.to(`game_${gameId}`).emit('gameUpdate', {
      type: 'gameUpdated',
      game,
    });
  }

  // Method to broadcast time updates to all connected clients in a game
  broadcastTimeUpdate(
    gameId: number,
    timeData: {
      remainingTime: number | null;
      playedTime: number;
      totalTime: number | null;
    },
  ) {
    this.server.to(`game_${gameId}`).emit('timeUpdate', timeData);
  }

  // Method to broadcast control point time updates to all connected clients in a game
  async broadcastControlPointTimeUpdate(
    controlPointId: number,
    timeData: {
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    },
  ) {
    try {
      // Find the game that contains this control point by using the takeControlPoint method structure
      // We'll get the control point with game relation through the service
      const controlPoint = await this.gamesService.getControlPointWithGame(controlPointId);

      if (controlPoint && controlPoint.game) {
        // Broadcast to the specific game room
        this.server.to(`game_${controlPoint.game.id}`).emit('controlPointTimeUpdate', {
          controlPointId,
          ...timeData,
        });
      } else {
        // Fallback: broadcast to all connected clients
        this.server.emit('controlPointTimeUpdate', {
          controlPointId,
          ...timeData,
        });
      }
    } catch (error) {
      console.error('Error broadcasting control point time update:', error);
      // Fallback: broadcast to all connected clients
      this.server.emit('controlPointTimeUpdate', {
        controlPointId,
        ...timeData,
      });
    }
  }
}
