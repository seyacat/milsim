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
}

@Injectable()
export class GamesService {
  private gameTimers = new Map<number, GameTimer>();

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
  ) {}

  async findAll(): Promise<Game[]> {
    return this.gamesRepository.find({
      relations: ['owner', 'players', 'players.user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id },
      relations: ['owner', 'players', 'players.user', 'controlPoints'],
    });
    if (!game) {
      throw new NotFoundException('Game not found');
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
    // Check if game exists
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'players'],
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is already in the game
    const existingPlayer = await this.playersRepository.findOne({
      where: { game: { id: gameId }, user: { id: userId } },
    });
    if (existingPlayer) {
      // User is already in the game, return the existing player (allow reconnection)
      return existingPlayer;
    }

    // Check if game is full
    if (game.players.length >= game.maxPlayers) {
      throw new ConflictException('Game is full');
    }

    // Create player entry
    const player = this.playersRepository.create({
      game: { id: gameId },
      user: { id: userId },
    });

    return this.playersRepository.save(player);
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
  }): Promise<ControlPoint> {
    // Check if game exists
    const game = await this.gamesRepository.findOne({
      where: { id: controlPointData.gameId },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Validate control point type
    const validTypes = ['control_point', 'site', 'bomb'];
    if (controlPointData.type && !validTypes.includes(controlPointData.type)) {
      throw new ConflictException('Tipo de punto de control inválido');
    }

    // Check if trying to create a Site and one already exists
    if (controlPointData.type === 'site') {
      const existingSite = await this.controlPointsRepository.findOne({
        where: {
          game: { id: controlPointData.gameId },
          type: 'site',
        },
      });

      if (existingSite) {
        throw new ConflictException('Solo puede haber un punto de tipo Site por juego');
      }
    }

    const controlPoint = this.controlPointsRepository.create({
      ...controlPointData,
      game: { id: controlPointData.gameId },
    });

    return this.controlPointsRepository.save(controlPoint);
  }

  async updateControlPoint(
    id: number,
    updateData: { name: string; type: string },
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
    await this.controlPointsRepository.update(id, updateData);

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

    // Start timer for running games (both limited and indefinite)
    console.log(`Game ${gameId} totalTime: ${game.totalTime}, type: ${typeof game.totalTime}`);
    console.log(`Game ${gameId} status: ${game.status}`);

    // ALWAYS start timer for running games, even if totalTime is null (indefinite games)
    if (game.status === 'running') {
      console.log(
        `Starting timer for game ${gameId} with total time: ${game.totalTime}s (indefinite: ${game.totalTime === null})`,
      );
      console.log(`GamesGateway available: ${!!this.gamesGateway}`);
      this.startGameTimer(gameId, game.totalTime);
    } else {
      console.log(`Game ${gameId} is not running, not starting timer`);
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
    }

    // Pause timer if exists
    this.pauseGameTimer(gameId);

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
    }

    // Resume timer if exists
    this.resumeGameTimer(gameId);

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
  private startGameTimer(gameId: number, totalTime: number | null): void {
    // Stop existing timer if any
    this.stopGameTimer(gameId);

    const timer: GameTimer = {
      gameId,
      totalTime: totalTime === 0 ? null : totalTime, // Treat 0 as indefinite (null)
      remainingTime: totalTime === 0 ? null : totalTime, // Treat 0 as indefinite (null)
      elapsedTime: 0,
      startTime: new Date(),
      isRunning: true,
    };

    // Start countdown interval (update every second internally, broadcast every 20 seconds)
    timer.intervalId = setInterval(() => {
      if (timer.isRunning) {
        timer.elapsedTime++;

        // Update remaining time if there's a total time limit
        if (timer.totalTime !== null && timer.remainingTime !== null) {
          timer.remainingTime = Math.max(0, timer.totalTime - timer.elapsedTime);
        }

        // Broadcast time update ONLY every 20 seconds
        if (timer.elapsedTime % 20 === 0 && this.gamesGateway) {
          console.log(
            `[TIMER] Broadcasting time update for game ${gameId}: elapsed=${timer.elapsedTime}, remaining=${timer.remainingTime}`,
          );
          this.gamesGateway.broadcastTimeUpdate(gameId, {
            remainingTime: timer.remainingTime,
            playedTime: timer.elapsedTime,
            totalTime: timer.totalTime,
          });
        }

        // Check if time's up for limited games (only if totalTime is not null)
        if (timer.totalTime !== null && timer.remainingTime !== null && timer.remainingTime <= 0) {
          // Time's up - end the game automatically (system action)
          console.log(`[TIMER] Time expired for game ${gameId}, ending automatically`);
          this.endGameAutomatically(gameId).catch(console.error);

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
        } else if (timer.totalTime === null) {
          // For indefinite games, just log the elapsed time without ending the game
          console.log(`[TIMER] Indefinite game ${gameId} - elapsed time: ${timer.elapsedTime}s`);
        }
      }
    }, 1000); // 1 second interval

    console.log(`[TIMER] Interval set, storing timer for game ${gameId}`);
    this.gameTimers.set(gameId, timer);
    console.log(`[TIMER] Started timer for game ${gameId}, total time: ${totalTime}s`);

    // Send initial time update
    if (this.gamesGateway) {
      console.log(`[TIMER] Sending initial time update for game ${gameId}`);
      this.gamesGateway.broadcastTimeUpdate(gameId, {
        remainingTime: timer.remainingTime,
        playedTime: timer.elapsedTime,
        totalTime: timer.totalTime,
      });
    }
  }

  private pauseGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      timer.isRunning = false;
      console.log(`Paused timer for game ${gameId}`);
    }
  }

  private resumeGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      timer.isRunning = true;
      console.log(`Resumed timer for game ${gameId}`);
    }
  }

  private stopGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer && timer.intervalId) {
      clearInterval(timer.intervalId);
      this.gameTimers.delete(gameId);
      console.log(`Stopped timer for game ${gameId}`);
    }
  }

  // Force broadcast time update (used for important events)
  private forceTimeBroadcast(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer && this.gamesGateway) {
      console.log(
        `[TIMER] Force broadcasting time update for game ${gameId}: elapsed=${timer.elapsedTime}, remaining=${timer.remainingTime}`,
      );
      this.gamesGateway.broadcastTimeUpdate(gameId, {
        remainingTime: timer.remainingTime,
        playedTime: timer.elapsedTime,
        totalTime: timer.totalTime,
      });
    }
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
    console.log(`[ADD_TIME] Adding ${seconds} seconds to game ${gameId}`);

    const timer = this.gameTimers.get(gameId);
    if (!timer) {
      console.error(`[ADD_TIME] No timer found for game ${gameId}`);
      throw new Error('No hay un temporizador activo para este juego');
    }

    console.log(`[ADD_TIME] Current timer state:`, {
      totalTime: timer.totalTime,
      remainingTime: timer.remainingTime,
      elapsedTime: timer.elapsedTime,
    });

    // Handle negative time (removing time)
    if (seconds < 0) {
      // For limited games, ensure we don't go below elapsed time
      if (timer.totalTime !== null && timer.remainingTime !== null) {
        const newTotalTime = Math.max(timer.elapsedTime, timer.totalTime + seconds);
        const newRemainingTime = Math.max(0, timer.remainingTime + seconds);

        timer.totalTime = newTotalTime;
        timer.remainingTime = newRemainingTime;
        console.log(
          `[ADD_TIME] Removed time: totalTime=${timer.totalTime}, remainingTime=${timer.remainingTime}`,
        );
      } else {
        // For indefinite games, cannot remove time
        console.log(`[ADD_TIME] Cannot remove time from indefinite game`);
        throw new Error('No se puede quitar tiempo de un juego indefinido');
      }
    } else {
      // Handle positive time (adding time)
      if (timer.totalTime !== null && timer.remainingTime !== null) {
        timer.totalTime += seconds;
        timer.remainingTime += seconds;
        console.log(
          `[ADD_TIME] Added time: totalTime=${timer.totalTime}, remainingTime=${timer.remainingTime}`,
        );
      } else {
        // If game was indefinite (null or 0), now it becomes limited
        timer.totalTime = timer.elapsedTime + seconds;
        timer.remainingTime = seconds;
        console.log(
          `[ADD_TIME] Converted to limited: totalTime=${timer.totalTime}, remainingTime=${timer.remainingTime}`,
        );
      }
    }

    const game = await this.findOne(gameId);
    console.log(`[ADD_TIME] Current game totalTime: ${game.totalTime}`);

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
          console.log(`[ADD_TIME] Setting game instance totalTime to: ${gameInstance.totalTime}`);
        } else {
          console.warn(
            `[ADD_TIME] Invalid totalTime value: ${timer.totalTime}, keeping original value: ${gameInstance.totalTime}`,
          );
        }

        try {
          await this.gameInstancesRepository.save(gameInstance);
          console.log(`[ADD_TIME] Game instance saved successfully`);
        } catch (error) {
          console.error(`[ADD_TIME] Error saving game instance:`, error);
          throw error;
        }
      }
    } else {
      // Update game entity when game is stopped
      // Ensure we're not setting NaN values
      if (timer.totalTime !== null && !isNaN(timer.totalTime)) {
        game.totalTime = timer.totalTime;
        console.log(`[ADD_TIME] Setting game totalTime to: ${game.totalTime}`);
      } else {
        console.warn(
          `[ADD_TIME] Invalid totalTime value: ${timer.totalTime}, keeping original value: ${game.totalTime}`,
        );
      }

      try {
        await this.gamesRepository.save(game);
        console.log(`[ADD_TIME] Game saved successfully`);
      } catch (error) {
        console.error(`[ADD_TIME] Error saving game:`, error);
        throw error;
      }
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
}
