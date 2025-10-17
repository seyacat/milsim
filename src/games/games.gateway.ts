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
import { ControlPoint } from './entities/control-point.entity';
import { PositionChallengeService } from './services/position-challenge.service';
import { TimerManagementService } from './services/timer-management.service';

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
    private readonly positionChallengeService: PositionChallengeService,
    private readonly timerManagementService: TimerManagementService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Authenticate the user
      const user = await this.websocketAuthService.authenticateSocket(client);

      // Store user data
      this.connectedUsers.set(client.id, user);

      // Register connection for uptime tracking
      this.connectionTracker.registerConnection();
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
          .then(() => {})
          .catch(error => {
            console.error(`[DISCONNECT] Error updating connections for game ${gameId}:`, error);
          });
      }
    }

    // Unregister connection for uptime tracking
    this.connectionTracker.unregisterConnection();
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;
    const user = this.connectedUsers.get(client.id);

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

      // Track game connection
      if (!this.gameConnections.has(gameId)) {
        this.gameConnections.set(gameId, new Set());
      }
      this.gameConnections.get(gameId)?.add(client.id);

      // Update active connections count in the game
      const connectionCount = this.gameConnections.get(gameId)?.size || 0;
      await this.gamesService.updateActiveConnections(gameId, connectionCount);

      // Get updated game data
      const game = await this.gamesService.findOne(gameId, user.id);

      // Join the game via service (this will handle the case where user is already in the game)
      await this.gamesService.joinGame(gameId, user.id);

      // Get updated game data
      const updatedGame = await this.gamesService.findOne(gameId, user.id);

      // Notify all clients in the game room about the updated player list
      this.server.to(`game_${gameId}`).emit('gameUpdate', {
        type: 'playerJoined',
        game: updatedGame,
      });

      // Check if user is owner and send stored positions
      const currentGame = await this.gamesService.findOne(gameId, user.id);
      if (currentGame.owner && currentGame.owner.id === user.id) {
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
        }
      }

      // Start position challenge interval if game is running and has position challenges
      if (currentGame.status === 'running') {
        this.startPositionChallengeInterval(gameId);

        // Send current position challenge data to the user
        try {
          const currentPositionChallengeData =
            await this.positionChallengeService.getCurrentPositionChallengeData(gameId);

          // Send position challenge data for each control point
          for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
            client.emit('positionChallengeUpdate', {
              controlPointId,
              teamPoints,
            });
          }
        } catch (error) {
          console.error(
            `[JOIN_GAME_WS] Error sending position challenge data to client ${client.id}:`,
            error,
          );
        }
      }

      client.emit('joinSuccess', {
        message: 'Successfully joined game',
        user: { id: user.id, name: user.name },
      });
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

            // Remove sensitive code data before broadcasting to all clients
            const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

            // Broadcast the updated control point to all clients (without codes)
            this.server.to(`game_${gameId}`).emit('gameAction', {
              action: 'controlPointUpdated',
              data: safeControlPoint,
              from: client.id,
            });

            // If this control point has position challenge, send current position challenge data
            if (safeControlPoint.hasPositionChallenge) {
              try {
                const currentPositionChallengeData =
                  await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
                const teamPoints = currentPositionChallengeData.get(safeControlPoint.id);
                if (teamPoints) {
                  this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                    controlPointId: safeControlPoint.id,
                    teamPoints,
                  });
                }
              } catch (error) {
                console.error(
                  `[CONTROL_POINT_UPDATE] Error sending position challenge data for control point ${safeControlPoint.id}:`,
                  error,
                );
              }
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

            // Also broadcast the complete game update so frontend has all control points
            this.server.to(`game_${gameId}`).emit('gameUpdate', {
              type: 'gameUpdated',
              game: updatedGame,
            });

            // Send position challenge data for all control points with position challenge
            try {
              const currentPositionChallengeData =
                await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
              for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
                this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                  controlPointId,
                  teamPoints,
                });
              }
            } catch (error) {
              console.error(`[GAME_UPDATE] Error sending position challenge data:`, error);
            }
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

            // Remove sensitive code data before broadcasting to all clients
            const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

            // Broadcast the updated control point to all clients (without codes)
            this.server.to(`game_${gameId}`).emit('gameAction', {
              action: 'controlPointUpdated',
              data: safeControlPoint,
              from: client.id,
            });

            // If this control point has position challenge, send current position challenge data
            if (safeControlPoint.hasPositionChallenge) {
              try {
                const currentPositionChallengeData =
                  await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
                const teamPoints = currentPositionChallengeData.get(safeControlPoint.id);
                if (teamPoints) {
                  this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                    controlPointId: safeControlPoint.id,
                    teamPoints,
                  });
                }
              } catch (error) {
                console.error(
                  `[CONTROL_POINT_POSITION_UPDATE] Error sending position challenge data for control point ${safeControlPoint.id}:`,
                  error,
                );
              }
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

            // Also broadcast the complete game update so frontend has all control points
            this.server.to(`game_${gameId}`).emit('gameUpdate', {
              type: 'gameUpdated',
              game: updatedGame,
            });

            // Send position challenge data for all control points with position challenge
            try {
              const currentPositionChallengeData =
                await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
              for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
                this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                  controlPointId,
                  teamPoints,
                });
              }
            } catch (error) {
              console.error(`[GAME_UPDATE_POSITION] Error sending position challenge data:`, error);
            }
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

        case 'positionChallengeUpdate': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            // Store the player's position for position challenge calculations
            this.playerPositions.set(user.id, {
              lat: data.lat,
              lng: data.lng,
              accuracy: data.accuracy,
              socketId: client.id,
            });

            // Update position challenge service with the new position
            this.positionChallengeService.updatePlayerPosition(
              gameId,
              user.id,
              data.lat,
              data.lng,
              data.accuracy,
            );
          }
          break;
        }

        case 'takeControlPoint': {
          const user = this.connectedUsers.get(client.id);
          if (user) {
            try {
              const result = await this.gamesService.takeControlPoint(
                data.controlPointId,
                user.id,
                data.code,
              );

              // Remove sensitive code data before broadcasting to all clients
              const { code, armedCode, disarmedCode, ...safeControlPoint } = result.controlPoint;

              // Get the complete updated game with all control points AFTER the update
              const updatedGame = await this.gamesService.findOne(gameId, user.id);

              // Broadcast the updated control point to all clients (without codes)
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'controlPointTaken',
                data: {
                  controlPointId: data.controlPointId,
                  userId: user.id,
                  userName: user.name,
                  team: result.controlPoint.ownedByTeam,
                  controlPoint: safeControlPoint,
                },
                from: client.id,
              });

              // If this control point has position challenge, send current position challenge data
              if (safeControlPoint.hasPositionChallenge) {
                try {
                  const currentPositionChallengeData =
                    await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
                  const teamPoints = currentPositionChallengeData.get(safeControlPoint.id);
                  if (teamPoints) {
                    this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                      controlPointId: safeControlPoint.id,
                      teamPoints,
                    });
                  }
                } catch (error) {
                  console.error(
                    `[CONTROL_POINT_TAKEN] Error sending position challenge data for control point ${safeControlPoint.id}:`,
                    error,
                  );
                }
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

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });

              // Send position challenge data for all control points with position challenge
              try {
                const currentPositionChallengeData =
                  await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
                for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
                  this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                    controlPointId,
                    teamPoints,
                  });
                }
              } catch (error) {
                console.error(`[GAME_UPDATE_TAKEN] Error sending position challenge data:`, error);
              }
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
                await this.timerManagementService.updateControlPointTimer(
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

              // If this control point has position challenge, send current position challenge data
              if (safeControlPoint.hasPositionChallenge) {
                try {
                  const currentPositionChallengeData =
                    await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
                  const teamPoints = currentPositionChallengeData.get(safeControlPoint.id);
                  if (teamPoints) {
                    this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                      controlPointId: safeControlPoint.id,
                      teamPoints,
                    });
                  }
                } catch (error) {
                  console.error(
                    `[CONTROL_POINT_TEAM_ASSIGNED] Error sending position challenge data for control point ${safeControlPoint.id}:`,
                    error,
                  );
                }
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

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });

              // Send position challenge data for all control points with position challenge
              try {
                const currentPositionChallengeData =
                  await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
                for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
                  this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                    controlPointId,
                    teamPoints,
                  });
                }
              } catch (error) {
                console.error(
                  `[GAME_UPDATE_TEAM_ASSIGNED] Error sending position challenge data:`,
                  error,
                );
              }
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

              // Recalculate and broadcast position challenge data for all control points
              // This ensures the pie charts and scores update immediately when teams change
              try {
                const currentPositionChallengeData =
                  await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
                
                // Broadcast updated position challenge data for all control points
                for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
                  this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
                    controlPointId,
                    teamPoints,
                  });
                }
              } catch (positionChallengeError) {
                console.error(
                  `[UPDATE_PLAYER_TEAM] Error recalculating position challenge data for game ${gameId}:`,
                  positionChallengeError,
                );
              }
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

        case 'activateBomb': {
          const user = this.connectedUsers.get(client.id);
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

              // Get the complete updated game with all control points AFTER the update
              const updatedGame = await this.gamesService.findOne(gameId, user.id);

              // Broadcast bomb activated action to all clients in the game room
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'bombActivated',
                data: {
                  controlPointId: data.controlPointId,
                  userId: user.id,
                  userName: user.name,
                  controlPoint: safeControlPoint,
                },
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
              }

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'activateBomb',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'deactivateBomb': {
          const user = this.connectedUsers.get(client.id);
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

              // Get the complete updated game with all control points AFTER the update
              const updatedGame = await this.gamesService.findOne(gameId, user.id);

              // Broadcast bomb deactivated action to all clients in the game room
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'bombDeactivated',
                data: {
                  controlPointId: data.controlPointId,
                  userId: user.id,
                  userName: user.name,
                  controlPoint: safeControlPoint,
                },
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
              }

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'deactivateBomb',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'activateBombAsOwner': {
          const user = this.connectedUsers.get(client.id);
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

              // Get the complete updated game with all control points AFTER the update
              const updatedGame = await this.gamesService.findOne(gameId, user.id);

              // Broadcast bomb activated action to all clients in the game room
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'bombActivated',
                data: {
                  controlPointId: data.controlPointId,
                  userId: user.id,
                  userName: user.name,
                  controlPoint: safeControlPoint,
                  activatedByOwner: true,
                },
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

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'activateBombAsOwner',
                error: error.message,
              });
            }
          }
          break;
        }

        case 'deactivateBombAsOwner': {
          const user = this.connectedUsers.get(client.id);
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

              // Get the complete updated game with all control points AFTER the update
              const updatedGame = await this.gamesService.findOne(gameId, user.id);

              // Broadcast bomb deactivated action to all clients in the game room
              this.server.to(`game_${gameId}`).emit('gameAction', {
                action: 'bombDeactivated',
                data: {
                  controlPointId: data.controlPointId,
                  userId: user.id,
                  userName: user.name,
                  controlPoint: safeControlPoint,
                  deactivatedByOwner: true,
                },
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

              // Also broadcast the complete game update so frontend has all control points
              this.server.to(`game_${gameId}`).emit('gameUpdate', {
                type: 'gameUpdated',
                game: updatedGame,
              });
            } catch (error: any) {
              client.emit('gameActionError', {
                action: 'deactivateBombAsOwner',
                error: error.message,
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

  @SubscribeMessage('getControlPointData')
  async handleGetControlPointData(client: Socket, payload: { controlPointId: number }) {
    const { controlPointId } = payload;
    const user = this.connectedUsers.get(client.id);

    try {
      // Get the control point with game relation
      const controlPoint = await this.gamesService.getControlPointWithGame(controlPointId);

      if (!controlPoint) {
        client.emit('controlPointDataError', { message: 'Control point not found' });
        return;
      }

      // Check if user is the owner of the game
      const game = await this.gamesService.findOne(controlPoint.game.id, user?.id);
      const isOwner = game.owner && game.owner.id === user?.id;

      // If user is not the owner, remove sensitive code data
      let responseControlPoint = controlPoint;
      if (!isOwner) {
        const { code, armedCode, disarmedCode, ...safeControlPoint } = controlPoint;
        responseControlPoint = safeControlPoint as ControlPoint;
      }

      client.emit('controlPointData', responseControlPoint);
    } catch (error: any) {
      client.emit('controlPointDataError', { message: 'Failed to get control point data' });
    }
  }

  @SubscribeMessage('getGameTime')
  async handleGetGameTime(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;

    try {
      const timeData = await this.gamesService.getGameTime(gameId);
      const controlPointTimes = await this.gamesService.getControlPointTimes(gameId);

      client.emit('gameTime', {
        ...timeData,
        controlPointTimes,
      });
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

  @SubscribeMessage('getActiveBombTimers')
  async handleGetActiveBombTimers(client: Socket, payload: { gameId: number }) {
    const { gameId } = payload;
    const user = this.connectedUsers.get(client.id);

    try {
      const activeBombTimers = await this.gamesService.getActiveBombTimers(gameId);
      client.emit('activeBombTimers', activeBombTimers);
    } catch (error: any) {
      client.emit('activeBombTimersError', { message: 'Failed to get active bomb timers' });
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
  async broadcastTimeUpdate(
    gameId: number,
    timeData: {
      remainingTime: number | null;
      playedTime: number;
      totalTime: number | null;
    },
  ) {
    try {
      // Get control point times for this game
      const controlPointTimes = await this.gamesService.getControlPointTimes(gameId);

      if (controlPointTimes.length > 0) {
        console.log(`[BROADCAST_TIME_UPDATE] Control point times data:`, controlPointTimes);
      }

      // Broadcast combined time update with control point times
      this.server.to(`game_${gameId}`).emit('timeUpdate', {
        ...timeData,
        controlPointTimes,
      });
    } catch (error) {
      console.error(
        `[BROADCAST_TIME_UPDATE] Error broadcasting time update for game ${gameId}:`,
        error,
      );
      // Fallback: broadcast without control point times
      this.server.to(`game_${gameId}`).emit('timeUpdate', {
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
  ) {
    try {
      // Find the game that contains this control point
      const controlPoint = await this.gamesService.getControlPointWithGame(controlPointId);

      if (controlPoint && controlPoint.game) {
        // Broadcast to the specific game room
        this.server.to(`game_${controlPoint.game.id}`).emit('bombTimeUpdate', {
          controlPointId,
          ...bombTimeData,
        });
      } else {
        // Fallback: broadcast to all connected clients
        this.server.emit('bombTimeUpdate', {
          controlPointId,
          ...bombTimeData,
        });
      }
    } catch (error) {
      console.error('Error broadcasting bomb time update:', error);
      // Fallback: broadcast to all connected clients
      this.server.emit('bombTimeUpdate', {
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
  ) {
    this.server.to(`game_${gameId}`).emit('positionChallengeUpdate', {
      controlPointId,
      teamPoints,
    });
  }

  /**
   * Process position challenge for a game
   * This is called by the timer management service every 20 seconds
   */
  async processPositionChallenge(gameId: number): Promise<void> {
    try {
      // Convert player positions to the expected format
      const playerPositions = new Map<number, any>();
      this.playerPositions.forEach((position, userId) => {
        playerPositions.set(userId, {
          userId,
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          socketId: position.socketId,
        });
      });

      // Start position challenge processing with current player positions
      this.positionChallengeService.startPositionChallengeProcessing(gameId, playerPositions);

      // Process position challenge for the game
      await this.positionChallengeService.processPositionChallengeForGame(gameId);
    } catch (error) {
      console.error(
        `[POSITION_CHALLENGE_GATEWAY] Error processing position challenge for game ${gameId}:`,
        error,
      );
    }
  }

  /**
   * Start position challenge processing for a game
   */
  private startPositionChallengeInterval(gameId: number): void {
    // Convert player positions to the expected format
    const playerPositions = new Map<number, any>();
    this.playerPositions.forEach((position, userId) => {
      playerPositions.set(userId, {
        userId,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        socketId: position.socketId,
      });
    });

    // Start position challenge processing with current player positions
    this.positionChallengeService.startPositionChallengeProcessing(gameId, playerPositions);
  }

  /**
   * Stop position challenge processing for a game
   */
  private stopPositionChallengeInterval(gameId: number): void {
    this.positionChallengeService.stopPositionChallengeProcessing(gameId);
  }
}
