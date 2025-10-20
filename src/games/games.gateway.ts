
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { WebsocketAuthService } from '../auth/websocket-auth.service';
import { ConnectionTrackerService } from '../connection-tracker.service';
import { PositionChallengeService } from './services/position-challenge.service';
import { TimerManagementService } from './services/timer-management.service';
import { ControlPointActionHandler } from './handlers/control-point-action.handler';
import { GameStateHandler } from './handlers/game-state.handler';
import { BombChallengeHandler } from './handlers/bomb-challenge.handler';
import { PlayerPositionHandler } from './handlers/player-position.handler';
import { BroadcastUtilitiesHandler } from './handlers/broadcast-utilities.handler';

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
    { lat: number; lng: number; accuracy: number; socketId: string; lastUpdate: Date }
  >(); // user.id -> position data
  private gameConnections = new Map<number, Set<string>>(); // gameId -> Set of socket IDs
  private gameIntervals = new Map<number, NodeJS.Timeout>(); // gameId -> interval ID

  private controlPointActionHandler: ControlPointActionHandler;
  private gameStateHandler: GameStateHandler;
  private bombChallengeHandler: BombChallengeHandler;
  private playerPositionHandler: PlayerPositionHandler;
  private broadcastUtilitiesHandler: BroadcastUtilitiesHandler;

  constructor(
    @Inject(forwardRef(() => GamesService))
    private readonly gamesService: GamesService,
    private readonly websocketAuthService: WebsocketAuthService,
    private readonly connectionTracker: ConnectionTrackerService,
    private readonly positionChallengeService: PositionChallengeService,
    private readonly timerManagementService: TimerManagementService,
  ) {
    this.initializeHandlers();
  }

  private initializeHandlers() {
    // Initialize BroadcastUtilitiesHandler first since other handlers depend on it
    this.broadcastUtilitiesHandler = new BroadcastUtilitiesHandler(this.gamesService);
    
    this.controlPointActionHandler = new ControlPointActionHandler(
      this.gamesService,
      this.positionChallengeService,
      this.timerManagementService,
    );
    this.gameStateHandler = new GameStateHandler(
      this.gamesService,
      this.positionChallengeService,
      this.broadcastUtilitiesHandler,
    );
    this.bombChallengeHandler = new BombChallengeHandler(this.gamesService);
    this.playerPositionHandler = new PlayerPositionHandler(
      this.gamesService,
      this.broadcastUtilitiesHandler,
    );
  }

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

      // Notify only the joining client about the updated player list
      // Removed broadcast to all players to prevent PIE chart disappearance
      client.emit('gameUpdate', {
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
          this.broadcastUtilitiesHandler.broadcastGameAction(
            gameId,
            'playerPositionsResponse',
            { positions },
            this.server,
            'server',
          );
        }
      }

      // Start position challenge interval if game is running and has position challenges
      if (currentGame.status === 'running') {
        this.startPositionChallengeInterval(gameId);
        this.startInactivePlayerCheck(gameId);

        // Send current position challenge data to the user
        try {
          const currentPositionChallengeData =
            await this.positionChallengeService.getCurrentPositionChallengeData(gameId);

          // Send position challenge data for each control point
          for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
            this.broadcastUtilitiesHandler.broadcastPositionChallengeUpdate(
              gameId,
              controlPointId,
              teamPoints,
              this.server,
            );
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

      // Notify only the leaving client about the updated player list
      // Removed broadcast to all players to prevent PIE chart disappearance
      client.emit('gameUpdate', {
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
        case 'createControlPoint':
          await this.controlPointActionHandler.handleCreateControlPoint(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'updateControlPoint':
          await this.controlPointActionHandler.handleUpdateControlPoint(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'updateControlPointPosition':
          await this.controlPointActionHandler.handleUpdateControlPointPosition(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'deleteControlPoint':
          await this.controlPointActionHandler.handleDeleteControlPoint(
            client, gameId, data, this.server
          );
          break;

        case 'takeControlPoint':
          await this.controlPointActionHandler.handleTakeControlPoint(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'assignControlPointTeam':
          await this.controlPointActionHandler.handleAssignControlPointTeam(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'updatePlayerTeam':
          await this.gameStateHandler.handleUpdatePlayerTeam(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'startGame':
          await this.gameStateHandler.handleStartGame(
            client, gameId, data, this.connectedUsers, this.server,
            this.startInactivePlayerCheck.bind(this)
          );
          break;

        case 'pauseGame':
          await this.gameStateHandler.handlePauseGame(
            client, gameId, data, this.connectedUsers, this.server,
            this.stopInactivePlayerCheck.bind(this)
          );
          break;

        case 'resumeGame':
          await this.gameStateHandler.handleResumeGame(
            client, gameId, data, this.connectedUsers, this.server,
            this.startInactivePlayerCheck.bind(this)
          );
          break;

        case 'endGame':
          await this.gameStateHandler.handleEndGame(
            client, gameId, data, this.connectedUsers, this.server,
            this.stopInactivePlayerCheck.bind(this)
          );
          break;

        case 'restartGame':
          await this.gameStateHandler.handleRestartGame(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'updateTeamCount':
          await this.gameStateHandler.handleUpdateTeamCount(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'addTime':
          await this.gameStateHandler.handleAddTime(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'updateGameTime':
          await this.gameStateHandler.handleUpdateGameTime(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'positionUpdate':
          this.playerPositionHandler.handlePositionUpdate(
            client, gameId, data, this.connectedUsers, this.playerPositions, this.server
          );
          break;

        case 'positionChallengeUpdate':
          this.playerPositionHandler.handlePositionChallengeUpdate(
            client, gameId, data, this.connectedUsers, this.playerPositions
          );
          break;

        case 'requestPlayerPositions':
          await this.playerPositionHandler.handleRequestPlayerPositions(
            client, gameId, data, this.connectedUsers, this.playerPositions, this.server
          );
          break;

        case 'activateBomb':
          await this.bombChallengeHandler.handleActivateBomb(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'deactivateBomb':
          await this.bombChallengeHandler.handleDeactivateBomb(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'activateBombAsOwner':
          await this.bombChallengeHandler.handleActivateBombAsOwner(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        case 'deactivateBombAsOwner':
          await this.bombChallengeHandler.handleDeactivateBombAsOwner(
            client, gameId, data, this.connectedUsers, this.server
          );
          break;

        default:
          // For other actions, use normalized broadcast function
          this.broadcastUtilitiesHandler.broadcastGameAction(
            gameId,
            action,
            data,
            this.server,
            client.id,
          );
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
        responseControlPoint = safeControlPoint as any;
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

      if (!timeData) {
        throw new Error('No hay un temporizador activo para este juego');
      }

      client.emit('gameTime', {
        ...timeData,
        controlPointTimes,
      });
    } catch (error: any) {
      client.emit('gameTimeError', { message: error.message });
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
    this.broadcastUtilitiesHandler.broadcastGameUpdate(gameId, game, this.server);
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
    await this.broadcastUtilitiesHandler.broadcastTimeUpdate(gameId, timeData, this.server);
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
    await this.broadcastUtilitiesHandler.broadcastControlPointTimeUpdate(
      controlPointId, timeData, this.server
    );
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
    await this.broadcastUtilitiesHandler.broadcastBombTimeUpdate(
      controlPointId, bombTimeData, this.server
    );
  }

  /**
   * Broadcast position challenge update to all clients in a game
   */
  broadcastPositionChallengeUpdate(
    gameId: number,
    controlPointId: number,
    teamPoints: Record<string, number>,
  ) {
    this.broadcastUtilitiesHandler.broadcastPositionChallengeUpdate(
      gameId, controlPointId, teamPoints, this.server
    );
  }

  /**
   * Get current player positions for position challenge processing
   */
  getCurrentPlayerPositions(): Map<number, any> {
    return this.playerPositionHandler.getCurrentPlayerPositions(this.playerPositions);
  }

  /**
   * Process position challenge for a game
   * This is called by the timer management service every 20 seconds
   */
  async processPositionChallenge(gameId: number): Promise<void> {
    try {
      // Process position challenge for the game - now the service gets positions directly from Gateway
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
  }

  /**
   * Check for inactive players and notify frontend
   */
  private checkInactivePlayers(gameId: number): void {
    this.playerPositionHandler.checkInactivePlayers(gameId, this.playerPositions, this.server);
  }

  /**
   * Start inactive player checking interval for a game
   */
  private startInactivePlayerCheck(gameId: number): void {
    // Check for inactive players every 5 seconds
    const interval = setInterval(() => {
      this.checkInactivePlayers(gameId);
    }, 5000);

    // Store the interval ID so we can clear it later
    if (!this.gameIntervals) {
      this.gameIntervals = new Map();
    }
    this.gameIntervals.set(gameId, interval);
  }

  /**
   * Stop inactive player checking for a game
   */
  private stopInactivePlayerCheck(gameId: number): void {
    if (this.gameIntervals && this.gameIntervals.has(gameId)) {
      clearInterval(this.gameIntervals.get(gameId));
      this.gameIntervals.delete(gameId);
    }
  }
}
