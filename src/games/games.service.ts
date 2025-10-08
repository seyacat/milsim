import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ControlPoint } from './entities/control-point.entity';
import { GameInstance } from './entities/game-instance.entity';
import { GameHistory } from './entities/game-history.entity';
import { GamesGateway } from './games.gateway';

interface GameTimer {
  gameId: number;
  totalTime: number | null; // Total time in seconds (null for unlimited)
  remainingTime: number | null; // Remaining time in seconds (null for unlimited)
  elapsedTime: number; // Elapsed time in seconds (always tracked)
  startTime: Date; // When the game started
  intervalId?: NodeJS.Timeout;
  isRunning: boolean;
  timeEvents: Array<{
    type: 'game_started' | 'game_paused' | 'game_resumed';
    timestamp: Date;
  }>; // Track time events for accurate calculation
}

interface ControlPointTimer {
  controlPointId: number;
  gameInstanceId: number;
  currentHoldTime: number;
  currentTeam: string | null;
  intervalId?: NodeJS.Timeout;
  isRunning: boolean;
  lastBroadcastTime: number;
}

@Injectable()
export class GamesService {
  private gameTimers = new Map<number, GameTimer>();
  private controlPointTimers = new Map<number, ControlPointTimer>(); // controlPointId -> timer

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    @InjectRepository(ControlPoint)
    private controlPointsRepository: Repository<ControlPoint>,
    @InjectRepository(GameInstance)
    private gameInstancesRepository: Repository<GameInstance>,
    @InjectRepository(GameHistory)
    private gameHistoryRepository: Repository<GameHistory>,
    @Inject(forwardRef(() => GamesGateway))
    private gamesGateway: GamesGateway,
  ) {
    // Recover running games on server restart
    void this.recoverRunningGames();
  }

  async findAll(): Promise<Game[]> {
    return this.gamesRepository.find({
      relations: ['owner', 'players', 'players.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId?: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id },
      relations: ['owner', 'players', 'players.user', 'controlPoints'],
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Remove sensitive code data from control points only for non-owner users
    if (game.controlPoints && (!userId || game.owner.id !== userId)) {
      game.controlPoints = game.controlPoints.map(cp => {
        const { code, armedCode, disarmedCode, ...safeControlPoint } = cp;
        return safeControlPoint as ControlPoint;
      });
    }

    return game;
  }

  async create(gameData: Partial<Game>, ownerId: number): Promise<Game> {
    const game = this.gamesRepository.create({
      ...gameData,
      totalTime: gameData.totalTime || 1200, // Default to 20 minutes if not specified
      owner: { id: ownerId },
    });
    const savedGame = await this.gamesRepository.save(game);

    // Auto-join the owner to their own game
    await this.joinGame(savedGame.id, ownerId);

    return savedGame;
  }

  async joinGame(gameId: number, userId: number): Promise<Player> {
    console.log(`[JOIN_GAME] Attempting to join game ${gameId} with user ${userId}`);

    // Check if game exists
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'players'],
    });
    if (!game) {
      console.error(`[JOIN_GAME] Game ${gameId} not found`);
      throw new NotFoundException('Game not found');
    }

    console.log(
      `[JOIN_GAME] Game found: ${game.name}, players: ${game.players?.length || 0}/${game.maxPlayers}`,
    );

    // Check if user is already in the game
    const existingPlayer = await this.playersRepository.findOne({
      where: { game: { id: gameId }, user: { id: userId } },
    });
    if (existingPlayer) {
      console.log(`[JOIN_GAME] User ${userId} is already in game ${gameId}, allowing reconnection`);
      // User is already in the game, return the existing player (allow reconnection)
      return existingPlayer;
    }

    // Check if game is full
    if (game.players.length >= game.maxPlayers) {
      console.error(
        `[JOIN_GAME] Game ${gameId} is full: ${game.players.length}/${game.maxPlayers}`,
      );
      throw new ConflictException('Game is full');
    }

    // Create player entry
    const player = this.playersRepository.create({
      game: { id: gameId },
      user: { id: userId },
    });

    console.log(`[JOIN_GAME] Creating new player entry for user ${userId} in game ${gameId}`);
    const savedPlayer = await this.playersRepository.save(player);
    console.log(`[JOIN_GAME] Player ${savedPlayer.id} created successfully`);

    return savedPlayer;
  }

  async leaveGame(gameId: number, userId: number): Promise<void> {
    console.log(`[LEAVE_GAME] Attempting to leave game ${gameId} with user ${userId}`);

    // Find the player entry
    const player = await this.playersRepository.findOne({
      where: { game: { id: gameId }, user: { id: userId } },
    });

    if (!player) {
      console.log(`[LEAVE_GAME] User ${userId} is not in game ${gameId}`);
      return; // User is not in the game, nothing to do
    }

    console.log(`[LEAVE_GAME] Removing player ${player.id} from game ${gameId}`);
    await this.playersRepository.remove(player);
    console.log(`[LEAVE_GAME] Player ${player.id} removed successfully`);
  }

  async getPlayerGames(userId: number): Promise<Game[]> {
    const players = await this.playersRepository.find({
      where: { user: { id: userId } },
      relations: ['game', 'game.owner', 'game.players', 'game.players.user'],
    });
    return players.map(player => player.game);
  }

  async createControlPoint(controlPointData: {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    gameId: number;
    type?: string;
    challengeType?: string;
    code?: string;
    armedCode?: string;
    disarmedCode?: string;
  }): Promise<ControlPoint> {
    // Check if game exists
    const game = await this.gamesRepository.findOne({
      where: { id: controlPointData.gameId },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if there are any existing Sites in the game
    const existingSite = await this.controlPointsRepository.findOne({
      where: {
        game: { id: controlPointData.gameId },
        type: 'site',
      },
    });

    console.log(
      `[CREATE_CONTROL_POINT] Existing site found: ${!!existingSite}, requested type: ${controlPointData.type}`,
    );

    // If no Site exists, force the new control point to be a Site
    const finalType = existingSite ? controlPointData.type || 'control_point' : 'site';

    console.log(`[CREATE_CONTROL_POINT] Final type determined: ${finalType}`);

    // Validate control point type
    const validTypes = ['control_point', 'site', 'bomb'];
    if (finalType && !validTypes.includes(finalType)) {
      throw new ConflictException('Tipo de punto de control inválido');
    }

    // Validate challenge type
    const validChallengeTypes = ['position', 'code'];
    if (
      controlPointData.challengeType &&
      !validChallengeTypes.includes(controlPointData.challengeType)
    ) {
      throw new ConflictException('Tipo de challenge inválido');
    }

    // Check if trying to create a Site and one already exists (should not happen with the logic above, but keeping for safety)
    if (finalType === 'site' && existingSite) {
      throw new ConflictException('Solo puede haber un punto de tipo Site por juego');
    }

    const controlPoint = this.controlPointsRepository.create({
      ...controlPointData,
      type: finalType,
      game: { id: controlPointData.gameId },
    });

    return this.controlPointsRepository.save(controlPoint);
  }

  async updateControlPoint(
    id: number,
    updateData: {
      name?: string;
      type?: string;
      challengeType?: string;
      code?: string;
      armedCode?: string;
      disarmedCode?: string;
      minDistance?: number;
      minAccuracy?: number;
      hasPositionChallenge?: boolean;
      hasCodeChallenge?: boolean;
      hasBombChallenge?: boolean;
      bombTime?: number;
      latitude?: number;
      longitude?: number;
      ownedByTeam?: string | null;
    },
  ): Promise<ControlPoint> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Validate control point type
    const validTypes = ['control_point', 'site', 'bomb'];
    if (updateData.type && !validTypes.includes(updateData.type)) {
      throw new ConflictException('Tipo de punto de control inválido');
    }

    // Validate challenge type
    const validChallengeTypes = ['position', 'code'];
    if (updateData.challengeType && !validChallengeTypes.includes(updateData.challengeType)) {
      throw new ConflictException('Tipo de challenge inválido');
    }

    // Check if trying to change to Site and one already exists
    if (updateData.type === 'site' && controlPoint.type !== 'site') {
      const existingSite = await this.controlPointsRepository.findOne({
        where: {
          game: { id: controlPoint.game.id },
          type: 'site',
        },
      });

      if (existingSite && existingSite.id !== id) {
        throw new ConflictException('Solo puede haber un punto de tipo Site por juego');
      }
    }

    // Update the control point
    // Use save method to handle null values properly
    const controlPointToUpdate = await this.controlPointsRepository.findOne({ where: { id } });
    if (!controlPointToUpdate) {
      throw new NotFoundException('Control point not found');
    }

    // Update the entity with new values
    Object.assign(controlPointToUpdate, updateData);
    await this.controlPointsRepository.save(controlPointToUpdate);

    // Return the updated control point
    const updatedControlPoint = await this.controlPointsRepository.findOne({
      where: { id },
    });
    if (!updatedControlPoint) {
      throw new NotFoundException('Control point not found after update');
    }
    return updatedControlPoint;
  }

  async deleteControlPoint(id: number): Promise<void> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id },
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    await this.controlPointsRepository.delete(id);
  }

  async updatePlayerTeam(playerId: number, team: string): Promise<Player> {
    const player = await this.playersRepository.findOne({
      where: { id: playerId },
      relations: ['user'],
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    // Validate team value
    const validTeams = ['blue', 'red', 'green', 'yellow', 'none'];
    if (!validTeams.includes(team)) {
      throw new ConflictException('Invalid team value');
    }

    player.team = team;
    return this.playersRepository.save(player);
  }

  async getPlayersByGame(gameId: number): Promise<Player[]> {
    return this.playersRepository.find({
      where: { game: { id: gameId } },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  async deleteGame(gameId: number, userId: number): Promise<void> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['players', 'controlPoints', 'owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede eliminarlo');
    }

    // Delete related players
    if (game.players && game.players.length > 0) {
      await this.playersRepository.remove(game.players);
    }

    // Delete related control points
    if (game.controlPoints && game.controlPoints.length > 0) {
      await this.controlPointsRepository.remove(game.controlPoints);
    }

    // Delete the game
    await this.gamesRepository.delete(gameId);
  }

  async startGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede iniciarlo');
    }

    // Create game instance when game starts
    const gameInstance = await this.createGameInstance(gameId);

    // Update game instance with start time
    gameInstance.gameStartTime = new Date();
    await this.gameInstancesRepository.save(gameInstance);

    // Update game status and set instanceId
    game.status = 'running';
    game.instanceId = gameInstance.id;
    const updatedGame = await this.gamesRepository.save(game);

    // Add game started event to history
    await this.addGameHistory(gameInstance.id, 'game_started', {
      gameId,
      startedBy: userId,
      timestamp: new Date(),
    });

    // ALWAYS start timer for running games, even if totalTime is null (indefinite games)
    if (game.status === 'running') {
      void this.startGameTimer(gameId, game.totalTime, gameInstance.id);
      // Start all control point timers
      void this.startAllControlPointTimers(gameId);
    }

    return updatedGame;
  }

  async pauseGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede pausarlo');
    }

    // Update game status
    game.status = 'paused';
    const updatedGame = await this.gamesRepository.save(game);

    // Add game paused event to history if there's an active instance
    if (game.instanceId) {
      await this.addGameHistory(game.instanceId, 'game_paused', {
        gameId,
        pausedBy: userId,
        timestamp: new Date(),
      });

      // Update timer time events
      const timer = this.gameTimers.get(gameId);
      if (timer) {
        timer.timeEvents.push({
          type: 'game_paused',
          timestamp: new Date(),
        });
      }
    }

    // Pause timer if exists
    this.pauseGameTimer(gameId);
    // Pause all control point timers
    this.pauseAllControlPointTimers(gameId);

    // Force broadcast time update on pause
    this.forceTimeBroadcast(gameId);

    return updatedGame;
  }

  async resumeGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede reanudarlo');
    }

    // Update game status
    game.status = 'running';
    const updatedGame = await this.gamesRepository.save(game);

    // Add game resumed event to history if there's an active instance
    if (game.instanceId) {
      await this.addGameHistory(game.instanceId, 'game_resumed', {
        gameId,
        resumedBy: userId,
        timestamp: new Date(),
      });

      // Update timer time events
      const timer = this.gameTimers.get(gameId);
      if (timer) {
        timer.timeEvents.push({
          type: 'game_resumed',
          timestamp: new Date(),
        });
      }
    }

    // Resume timer if exists
    this.resumeGameTimer(gameId);
    // Resume all control point timers
    this.resumeAllControlPointTimers(gameId);

    // Force broadcast time update on resume
    this.forceTimeBroadcast(gameId);

    return updatedGame;
  }

  async endGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede finalizarlo');
    }

    // Add game ended event to history if there's an active instance
    if (game.instanceId) {
      await this.addGameHistory(game.instanceId, 'game_ended', {
        gameId,
        endedBy: userId,
        timestamp: new Date(),
      });
    }

    // Update game status to finished (keep instanceId for game summary)
    game.status = 'finished';
    const updatedGame = await this.gamesRepository.save(game);

    // Stop timer if exists
    this.stopGameTimer(gameId);
    // Stop all control point timers
    this.stopAllControlPointTimers(gameId);

    // Force broadcast final time update on game end
    this.forceTimeBroadcast(gameId);

    return updatedGame;
  }

  // Restart game from finished state
  async restartGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede reiniciarlo');
    }

    // Check if game is in finished state
    if (game.status !== 'finished') {
      throw new ConflictException('Solo se puede reiniciar un juego que ha finalizado');
    }

    // Update game status to stopped and clear instanceId
    game.status = 'stopped';
    game.instanceId = null;
    const updatedGame = await this.gamesRepository.save(game);

    // Add game restarted event to history
    if (game.instanceId) {
      await this.addGameHistory(game.instanceId, 'game_restarted', {
        gameId,
        restartedBy: userId,
        timestamp: new Date(),
      });
    }

    return updatedGame;
  }

  // End game automatically when time expires (system action)
  async endGameAutomatically(gameId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Add game ended event to history if there's an active instance
    if (game.instanceId) {
      await this.addGameHistory(game.instanceId, 'game_ended_automatically', {
        gameId,
        endedBy: 'system',
        timestamp: new Date(),
      });
    }

    // Update game status to finished (keep instanceId for game summary)
    game.status = 'finished';
    const updatedGame = await this.gamesRepository.save(game);

    // Stop timer if exists
    this.stopGameTimer(gameId);

    // Force broadcast final time update on game end
    this.forceTimeBroadcast(gameId);

    // Broadcast game state change
    if (this.gamesGateway) {
      this.gamesGateway.broadcastGameUpdate(gameId, updatedGame);
    }

    return updatedGame;
  }

  async updateTeamCount(gameId: number, teamCount: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException(
        'Solo el propietario del juego puede cambiar el número de equipos',
      );
    }

    // Validate team count (2, 3, or 4)
    if (![2, 3, 4].includes(teamCount)) {
      throw new ConflictException('El número de equipos debe ser 2, 3 o 4');
    }

    // Update team count
    game.teamCount = teamCount;
    return this.gamesRepository.save(game);
  }

  // Timer management methods
  private async startGameTimer(
    gameId: number,
    totalTime: number | null,
    gameInstanceId: number,
  ): Promise<void> {
    // Stop existing timer if any
    this.stopGameTimer(gameId);

    // Calculate elapsed time from game history events
    const elapsedTime = await this.calculateElapsedTimeFromEvents(gameInstanceId);

    const timer: GameTimer = {
      gameId,
      totalTime: totalTime === 0 ? null : totalTime, // Treat 0 as indefinite (null)
      remainingTime:
        totalTime === 0 ? null : totalTime !== null ? Math.max(0, totalTime - elapsedTime) : null,
      elapsedTime: elapsedTime,
      startTime: new Date(),
      isRunning: true,
      timeEvents: await this.getTimeEventsFromHistory(gameInstanceId),
    };

    // Start countdown interval (update every second internally, broadcast every 20 seconds)
    timer.intervalId = setInterval(() => {
      if (timer.isRunning) {
        // Calculate elapsed time from events for accuracy (without async/await in interval)
        this.calculateElapsedTimeFromEvents(gameInstanceId)
          .then(currentElapsedTime => {
            timer.elapsedTime = currentElapsedTime;

            // Update remaining time if there's a total time limit
            if (timer.totalTime !== null && timer.remainingTime !== null) {
              timer.remainingTime = Math.max(0, timer.totalTime - timer.elapsedTime);
            }

            // Broadcast time update ONLY every 20 seconds
            if (timer.elapsedTime % 20 === 0 && this.gamesGateway) {
              this.gamesGateway.broadcastTimeUpdate(gameId, {
                remainingTime: timer.remainingTime,
                playedTime: timer.elapsedTime,
                totalTime: timer.totalTime,
              });
            }

            // Check if time's up for limited games (only if totalTime is not null)
            if (
              timer.totalTime !== null &&
              timer.remainingTime !== null &&
              timer.remainingTime <= 0
            ) {
              // Time's up - end the game automatically (system action)
              void this.endGameAutomatically(gameId).catch(console.error);

              // Add time expired event to history
              this.gamesRepository
                .findOne({ where: { id: gameId } })
                .then(game => {
                  if (game && game.instanceId) {
                    return this.addGameHistory(game.instanceId, 'time_expired', {
                      gameId,
                      timestamp: new Date(),
                    });
                  }
                })
                .catch(console.error);
            }
          })
          .catch(console.error);
      }
    }, 1000); // 1 second interval

    this.gameTimers.set(gameId, timer);

    // Send initial time update
    if (this.gamesGateway) {
      this.gamesGateway.broadcastTimeUpdate(gameId, {
        remainingTime: timer.remainingTime,
        playedTime: timer.elapsedTime,
        totalTime: timer.totalTime,
      });
    }
  }

  // Calculate elapsed time from game history events
  private async calculateElapsedTimeFromEvents(gameInstanceId: number): Promise<number> {
    const timeEvents = await this.getTimeEventsFromHistory(gameInstanceId);
    let totalElapsedTime = 0;
    let lastStartTime: Date | null = null;

    // Get current game status to determine if we should add current time
    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });
    const isCurrentlyRunning = game && game.status === 'running';

    for (let i = 0; i < timeEvents.length; i++) {
      const event = timeEvents[i];

      if (event.type === 'game_started' || event.type === 'game_resumed') {
        if (!lastStartTime) {
          lastStartTime = event.timestamp;
        }
      } else if (event.type === 'game_paused') {
        if (lastStartTime) {
          const segmentTime = (event.timestamp.getTime() - lastStartTime.getTime()) / 1000;
          totalElapsedTime += segmentTime;
          lastStartTime = null;
        }
      }
    }

    // If game is currently running and we have a start time, add time from last start to now
    if (isCurrentlyRunning && lastStartTime) {
      const currentSegmentTime = (Date.now() - lastStartTime.getTime()) / 1000;
      totalElapsedTime += currentSegmentTime;
    }
    return Math.floor(totalElapsedTime);
  }

  // Get time events from game history
  private async getTimeEventsFromHistory(gameInstanceId: number): Promise<
    Array<{
      type: 'game_started' | 'game_paused' | 'game_resumed';
      timestamp: Date;
    }>
  > {
    // Get all history records for this game instance
    const history = await this.gameHistoryRepository.find({
      where: {
        gameInstance: { id: gameInstanceId },
      },
      order: { timestamp: 'ASC' },
    });

    // Filter for the specific time events we need
    const filteredHistory = history.filter(record =>
      ['game_started', 'game_paused', 'game_resumed'].includes(record.eventType),
    );

    return filteredHistory.map(record => ({
      type: record.eventType as 'game_started' | 'game_paused' | 'game_resumed',
      timestamp: record.timestamp,
    }));
  }

  // Recover running games on server restart
  private async recoverRunningGames(): Promise<void> {
    try {
      // Find all games that are currently running
      const runningGames = await this.gamesRepository.find({
        where: { status: 'running' },
        relations: ['instances'],
      });

      for (const game of runningGames) {
        if (game.instanceId) {
          // Get the game instance
          const gameInstance = await this.gameInstancesRepository.findOne({
            where: { id: game.instanceId },
          });

          if (gameInstance && gameInstance.gameStartTime) {
            // Restart the timer with the existing game instance
            void this.startGameTimer(game.id, game.totalTime, game.instanceId);
          }
        }
      }
    } catch (error) {
      console.error('[SERVER_RESTART] Error recovering running games:', error);
    }
  }

  private pauseGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      timer.isRunning = false;
    }
  }

  private resumeGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      timer.isRunning = true;
    }
  }

  private stopGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer && timer.intervalId) {
      clearInterval(timer.intervalId);
      this.gameTimers.delete(gameId);
    }
  }

  // Force broadcast time update (used for important events)
  private forceTimeBroadcast(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer && this.gamesGateway) {
      this.gamesGateway.broadcastTimeUpdate(gameId, {
        remainingTime: timer.remainingTime,
        playedTime: timer.elapsedTime,
        totalTime: timer.totalTime,
      });
    }
  }

  // Control Point Timer management methods
  private async startControlPointTimer(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<void> {
    // Stop existing timer if any
    this.stopControlPointTimer(controlPointId);

    // Check if game is running before starting timer
    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });
    
    if (!game || game.status !== 'running') {
      console.log(
        `[CONTROL_POINT_TIMER] Not starting timer for control point ${controlPointId} - game is not running`,
      );
      return;
    }

    // Get initial hold time data
    const holdTimeData = await this.calculateControlPointHoldTime(controlPointId, gameInstanceId);

    const timer: ControlPointTimer = {
      controlPointId,
      gameInstanceId,
      currentHoldTime: holdTimeData.currentHoldTime,
      currentTeam: holdTimeData.currentTeam,
      isRunning: true,
      lastBroadcastTime: 0,
    };

    // Start countdown interval (update every second internally, broadcast every 20 seconds)
    timer.intervalId = setInterval(() => {
      if (timer.isRunning) {
        // Increment current hold time
        timer.currentHoldTime++;

        // Broadcast time update ONLY every 20 seconds
        if (timer.currentHoldTime % 20 === 0 && this.gamesGateway) {
          this.gamesGateway.broadcastControlPointTimeUpdate(controlPointId, {
            currentHoldTime: timer.currentHoldTime,
            currentTeam: timer.currentTeam,
            displayTime: this.formatTime(timer.currentHoldTime),
          });
          timer.lastBroadcastTime = timer.currentHoldTime;
        }
      }
    }, 1000); // 1 second interval

    this.controlPointTimers.set(controlPointId, timer);

    // Send initial time update
    if (this.gamesGateway) {
      this.gamesGateway.broadcastControlPointTimeUpdate(controlPointId, {
        currentHoldTime: timer.currentHoldTime,
        currentTeam: timer.currentTeam,
        displayTime: this.formatTime(timer.currentHoldTime),
      });
    }
  }

  private pauseControlPointTimer(controlPointId: number): void {
    const timer = this.controlPointTimers.get(controlPointId);
    if (timer) {
      timer.isRunning = false;
    }
  }

  private resumeControlPointTimer(controlPointId: number): void {
    const timer = this.controlPointTimers.get(controlPointId);
    if (timer) {
      timer.isRunning = true;
    }
  }

  private stopControlPointTimer(controlPointId: number): void {
    const timer = this.controlPointTimers.get(controlPointId);
    if (timer && timer.intervalId) {
      clearInterval(timer.intervalId);
      this.controlPointTimers.delete(controlPointId);
    }
  }

  // Format time in mm:ss
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Start all control point timers for a game
  async startAllControlPointTimers(gameId: number): Promise<void> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints'],
    });

    if (!game || !game.instanceId) {
      return;
    }

    // Start timers for all control points
    if (game.controlPoints) {
      for (const controlPoint of game.controlPoints) {
        await this.startControlPointTimer(controlPoint.id, game.instanceId);
      }
    }
  }

  // Pause all control point timers for a game
  pauseAllControlPointTimers(gameId: number): void {
    const game = this.gamesRepository
      .findOne({
        where: { id: gameId },
        relations: ['controlPoints'],
      })
      .then(game => {
        if (game && game.controlPoints) {
          for (const controlPoint of game.controlPoints) {
            this.pauseControlPointTimer(controlPoint.id);
          }
        }
      });
  }

  // Resume all control point timers for a game
  resumeAllControlPointTimers(gameId: number): void {
    const game = this.gamesRepository
      .findOne({
        where: { id: gameId },
        relations: ['controlPoints'],
      })
      .then(game => {
        if (game && game.controlPoints) {
          for (const controlPoint of game.controlPoints) {
            this.resumeControlPointTimer(controlPoint.id);
          }
        }
      });
  }

  // Stop all control point timers for a game
  stopAllControlPointTimers(gameId: number): void {
    const game = this.gamesRepository
      .findOne({
        where: { id: gameId },
        relations: ['controlPoints'],
      })
      .then(game => {
        if (game && game.controlPoints) {
          for (const controlPoint of game.controlPoints) {
            this.stopControlPointTimer(controlPoint.id);
          }
        }
      });
  }

  // Update control point timer when ownership changes
  async updateControlPointTimer(controlPointId: number, gameInstanceId: number): Promise<void> {
    // Stop existing timer
    this.stopControlPointTimer(controlPointId);

    // Start new timer with updated data
    await this.startControlPointTimer(controlPointId, gameInstanceId);
  }

  // Get current time for a game
  getGameTime(
    gameId: number,
  ): { remainingTime: number | null; totalTime: number | null; playedTime: number } | null {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      return {
        remainingTime: timer.remainingTime,
        totalTime: timer.totalTime,
        playedTime: timer.elapsedTime,
      };
    }
    return null;
  }

  async addTime(gameId: number, seconds: number): Promise<Game> {
    const timer = this.gameTimers.get(gameId);
    if (!timer) {
      throw new Error('No hay un temporizador activo para este juego');
    }

    // Handle negative time (removing time)
    if (seconds < 0) {
      // For limited games, ensure we don't go below elapsed time
      if (timer.totalTime !== null && timer.remainingTime !== null) {
        const newTotalTime = Math.max(timer.elapsedTime, timer.totalTime + seconds);
        const newRemainingTime = Math.max(0, timer.remainingTime + seconds);

        timer.totalTime = newTotalTime;
        timer.remainingTime = newRemainingTime;
      } else {
        // For indefinite games, cannot remove time
        throw new Error('No se puede quitar tiempo de un juego indefinido');
      }
    } else {
      // Handle positive time (adding time)
      if (timer.totalTime !== null && timer.remainingTime !== null) {
        timer.totalTime += seconds;
        timer.remainingTime += seconds;
      } else {
        // If game was indefinite (null or 0), now it becomes limited
        timer.totalTime = timer.elapsedTime + seconds;
        timer.remainingTime = seconds;
      }
    }

    const game = await this.findOne(gameId);

    // Update the appropriate entity based on game status
    if (game.status === 'running' && game.instanceId) {
      // Update game instance when game is running
      const gameInstance = await this.gameInstancesRepository.findOne({
        where: { id: game.instanceId },
      });

      if (gameInstance) {
        // Ensure we're not setting NaN values
        if (timer.totalTime !== null && !isNaN(timer.totalTime)) {
          gameInstance.totalTime = timer.totalTime;
        }

        await this.gameInstancesRepository.save(gameInstance);
      }
    } else {
      // Update game entity when game is stopped
      // Ensure we're not setting NaN values
      if (timer.totalTime !== null && !isNaN(timer.totalTime)) {
        game.totalTime = timer.totalTime;
      }

      await this.gamesRepository.save(game);
    }

    // Force broadcast the updated time
    this.forceTimeBroadcast(gameId);

    // Log game history
    if (game.instanceId) {
      const minutesAdded = seconds / 60;
      await this.addGameHistory(game.instanceId, 'time_added', {
        minutesAdded: minutesAdded,
        newTotalTime: timer.totalTime,
        newRemainingTime: timer.remainingTime,
      });
    }

    return game;
  }

  async updateGameTime(gameId: number, timeInSeconds: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede cambiar el tiempo');
    }

    // Treat 0 as indefinite (null)
    const effectiveTime = timeInSeconds === 0 ? null : timeInSeconds;

    // Update the appropriate entity based on game status
    if (game.status === 'running' && game.instanceId) {
      // Update game instance when game is running
      const gameInstance = await this.gameInstancesRepository.findOne({
        where: { id: game.instanceId },
      });

      if (gameInstance) {
        gameInstance.totalTime = effectiveTime;
        await this.gameInstancesRepository.save(gameInstance);
      }
    } else {
      // Update game entity when game is stopped
      game.totalTime = effectiveTime;
      await this.gamesRepository.save(game);
    }

    // Update timer if exists
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      timer.totalTime = effectiveTime;
      timer.remainingTime = effectiveTime;
    }

    // Force broadcast the updated time
    this.forceTimeBroadcast(gameId);

    return game;
  }

  // Game Instance methods
  async createGameInstance(gameId: number): Promise<GameInstance> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Create a new game instance with the same settings as the game
    const gameInstance = this.gameInstancesRepository.create({
      name: game.name,
      description: game.description,
      status: game.status,
      maxPlayers: game.maxPlayers,
      teamCount: game.teamCount,
      totalTime: game.totalTime,
      game: { id: gameId },
    });

    const savedInstance = await this.gameInstancesRepository.save(gameInstance);

    // Update the game with the new instance ID
    game.instanceId = savedInstance.id;
    await this.gamesRepository.save(game);

    return savedInstance;
  }

  async getGameInstance(gameId: number): Promise<GameInstance | null> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
    });

    if (!game || !game.instanceId) {
      return null;
    }

    return this.gameInstancesRepository.findOne({
      where: { id: game.instanceId },
      relations: ['history'],
    });
  }

  // Game History methods
  async addGameHistory(
    gameInstanceId: number,
    eventType: string,
    data?: any,
  ): Promise<GameHistory> {
    const gameHistory = this.gameHistoryRepository.create({
      eventType,
      data,
      gameInstance: { id: gameInstanceId },
    });

    return this.gameHistoryRepository.save(gameHistory);
  }

  async getGameHistory(gameInstanceId: number): Promise<GameHistory[]> {
    return this.gameHistoryRepository.find({
      where: { gameInstance: { id: gameInstanceId } },
      order: { timestamp: 'DESC' },
    });
  }

  // Update active connections count for a game
  async updateActiveConnections(gameId: number, connectionCount: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    game.activeConnections = connectionCount;
    return this.gamesRepository.save(game);
  }
  async updateGame(gameId: number, updateData: { name?: string }, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede actualizarlo');
    }

    // Update the game with new data
    if (updateData.name !== undefined) {
      game.name = updateData.name;
    }

    const updatedGame = await this.gamesRepository.save(game);

    // Broadcast the update to all connected clients
    if (this.gamesGateway) {
      this.gamesGateway.broadcastGameUpdate(gameId, updatedGame);
    }

    return updatedGame;
  }

  // Take control point with code validation
  async takeControlPoint(
    controlPointId: number,
    userId: number,
    code?: string,
  ): Promise<ControlPoint> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Get the player to determine their team
    const player = await this.playersRepository.findOne({
      where: {
        game: { id: controlPoint.game.id },
        user: { id: userId },
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found in this game');
    }

    if (player.team === 'none' || !player.team) {
      throw new ConflictException('Debes estar asignado a un equipo para tomar puntos de control');
    }

    // Check if code challenge is active and validate code
    if (controlPoint.hasCodeChallenge && controlPoint.code) {
      if (!code || code.trim() !== controlPoint.code) {
        throw new ConflictException('Código incorrecto');
      }
    }

    // Check if bomb challenge is active and validate codes
    if (controlPoint.hasBombChallenge) {
      if (!code) {
        throw new ConflictException('Se requiere código para este punto de control');
      }

      // For bomb challenges, the code should match either armed or disarmed code
      const isArmedCode = controlPoint.armedCode && code.trim() === controlPoint.armedCode;
      const isDisarmedCode = controlPoint.disarmedCode && code.trim() === controlPoint.disarmedCode;

      if (!isArmedCode && !isDisarmedCode) {
        throw new ConflictException('Código incorrecto para el desafío de bomba');
      }
    }

    // Update control point ownership
    controlPoint.ownedByTeam = player.team;
    const updatedControlPoint = await this.controlPointsRepository.save(controlPoint);

    // Add to game history
    if (controlPoint.game.instanceId) {
      await this.addGameHistory(controlPoint.game.instanceId, 'control_point_taken', {
        controlPointId: controlPoint.id,
        controlPointName: controlPoint.name,
        team: player.team,
        userId: userId,
        timestamp: new Date(),
      });

      // Update control point timer with new ownership
      await this.updateControlPointTimer(controlPoint.id, controlPoint.game.instanceId);
    }

    return updatedControlPoint;
  }

  // Calculate control point hold time from game history
  async calculateControlPointHoldTime(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<{ totalHoldTime: number; currentHoldTime: number; currentTeam: string | null }> {
    // Get all control point capture events for this control point
    const history = await this.gameHistoryRepository.find({
      where: {
        gameInstance: { id: gameInstanceId },
        eventType: 'control_point_taken',
      },
      order: { timestamp: 'ASC' },
    });

    // Filter events for this specific control point
    const controlPointEvents = history.filter(
      event => event.data && event.data.controlPointId === controlPointId,
    );

    if (controlPointEvents.length === 0) {
      return { totalHoldTime: 0, currentHoldTime: 0, currentTeam: null };
    }

    let totalHoldTime = 0;
    let currentHoldStart: Date | null = null;
    let currentTeam: string | null = null;

    // Get current game status to determine if we should add current time
    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });
    const isCurrentlyRunning = game && game.status === 'running';

    // Process events chronologically
    for (let i = 0; i < controlPointEvents.length; i++) {
      const event = controlPointEvents[i];
      const eventTeam = event.data.team;
      const eventTimestamp = event.timestamp;

      if (i === controlPointEvents.length - 1) {
        // Last event - this is the current owner
        currentTeam = eventTeam;
        currentHoldStart = eventTimestamp;

        // If game is running, add time from last capture to now
        if (isCurrentlyRunning) {
          const currentTime = new Date();
          const currentHoldTime = Math.floor(
            (currentTime.getTime() - eventTimestamp.getTime()) / 1000,
          );
          totalHoldTime += currentHoldTime;
        }
      } else {
        // Calculate time between this capture and the next one
        const nextEvent = controlPointEvents[i + 1];
        const holdDuration = Math.floor(
          (nextEvent.timestamp.getTime() - eventTimestamp.getTime()) / 1000,
        );
        totalHoldTime += holdDuration;
      }
    }

    // Calculate current hold time separately
    const currentHoldTime =
      currentHoldStart && isCurrentlyRunning
        ? Math.floor((Date.now() - currentHoldStart.getTime()) / 1000)
        : 0;

    return {
      totalHoldTime,
      currentHoldTime,
      currentTeam,
    };
  }

  // Get control point hold time for display
  async getControlPointHoldTime(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<{
    displayTime: string;
    totalHoldTime: number;
    currentHoldTime: number;
    currentTeam: string | null;
  }> {
    const holdTimeData = await this.calculateControlPointHoldTime(controlPointId, gameInstanceId);

    // Format time in mm:ss
    const formatTime = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return {
      displayTime: formatTime(holdTimeData.currentHoldTime),
      totalHoldTime: holdTimeData.totalHoldTime,
      currentHoldTime: holdTimeData.currentHoldTime,
      currentTeam: holdTimeData.currentTeam,
    };
  }

  // Get control point with game relation for broadcasting
  async getControlPointWithGame(controlPointId: number): Promise<ControlPoint | null> {
    return this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });
  }

  // Get all control point times for a game
  async getControlPointTimes(gameId: number): Promise<
    Array<{
      controlPointId: number;
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    }>
  > {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints'],
    });

    if (!game || !game.instanceId) {
      return [];
    }

    const controlPointTimes: Array<{
      controlPointId: number;
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    }> = [];

    if (game.controlPoints) {
      for (const controlPoint of game.controlPoints) {
        const holdTimeData = await this.calculateControlPointHoldTime(
          controlPoint.id,
          game.instanceId,
        );

        controlPointTimes.push({
          controlPointId: controlPoint.id,
          currentHoldTime: holdTimeData.currentHoldTime,
          currentTeam: holdTimeData.currentTeam,
          displayTime: this.formatTime(holdTimeData.currentHoldTime),
        });
      }
    }

    return controlPointTimes;
  }
}
