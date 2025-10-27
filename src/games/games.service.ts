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
import { TimerCalculationService } from './services/timer-calculation.service';
import { PositionChallengeService } from './services/position-challenge.service';
import { GameManagementService } from './services/game-management.service';
import { PlayerManagementService } from './services/player-management.service';
import { ControlPointManagementService } from './services/control-point-management.service';
import { TimerManagementService } from './services/timer-management.service';
import { BombManagementService } from './services/bomb-management.service';
import { GameResultsService } from './services/game-results.service';

@Injectable()
export class GamesService {
  /**
   * Helper method to broadcast game update with player relations
   */
  private async broadcastGameUpdateWithPlayers(gameId: number): Promise<void> {
    if (this.gamesGateway) {
      try {
        const gameWithPlayers: Game = await this.findOne(gameId);
        this.gamesGateway.broadcastGameUpdate(gameId, gameWithPlayers);
      } catch (error) {
        console.error(`Error broadcasting game update for game ${gameId}:`, error);
      }
    }
  }
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
    private timerCalculationService: TimerCalculationService,
    private positionChallengeService: PositionChallengeService,
    private gameManagementService: GameManagementService,
    private playerManagementService: PlayerManagementService,
    private controlPointManagementService: ControlPointManagementService,
    private timerManagementService: TimerManagementService,
    private bombManagementService: BombManagementService,
    private gameResultsService: GameResultsService,
  ) {
    // Recover running games on server restart
    void this.recoverRunningGames();
  }

  // Game Management - delegate to GameManagementService
  async findAll(): Promise<Game[]> {
    return this.gameManagementService.findAll();
  }

  async findOne(id: number, userId?: number): Promise<Game> {
    return this.gameManagementService.findOne(id, userId);
  }

  async create(gameData: Partial<Game>, ownerId: number): Promise<Game> {
    const savedGame = await this.gameManagementService.create(gameData, ownerId);

    // Create game instance immediately when creating a new game
    const gameInstance = await this.gameManagementService.createGameInstance(savedGame.id);

    // Update the game with the instance ID
    savedGame.instanceId = gameInstance.id;
    const updatedGame = await this.gamesRepository.save(savedGame);

    // Auto-join the owner to their own game
    await this.playerManagementService.joinGame(updatedGame.id, ownerId);

    return updatedGame;
  }

  async deleteGame(gameId: number, userId: number): Promise<void> {
    return this.gameManagementService.deleteGame(gameId, userId);
  }

  async updateGame(gameId: number, updateData: { name?: string }, userId: number): Promise<Game> {
    return this.gameManagementService.updateGame(gameId, updateData, userId);
  }

  async updateTeamCount(gameId: number, teamCount: number, userId: number): Promise<Game> {
    return this.gameManagementService.updateTeamCount(gameId, teamCount, userId);
  }

  async updateActiveConnections(gameId: number, connectionCount: number): Promise<Game> {
    return this.gameManagementService.updateActiveConnections(gameId, connectionCount);
  }

  // Player Management - delegate to PlayerManagementService
  async joinGame(gameId: number, userId: number): Promise<Player> {
    return this.playerManagementService.joinGame(gameId, userId);
  }

  async leaveGame(gameId: number, userId: number): Promise<void> {
    return this.playerManagementService.leaveGame(gameId, userId);
  }

  async getPlayerGames(userId: number): Promise<Game[]> {
    return this.playerManagementService.getPlayerGames(userId);
  }

  async updatePlayerTeam(playerId: number, team: string): Promise<Player> {
    return this.playerManagementService.updatePlayerTeam(playerId, team);
  }

  async getPlayersByGame(gameId: number): Promise<Player[]> {
    return this.playerManagementService.getPlayersByGame(gameId);
  }

  // Control Point Management - delegate to ControlPointManagementService
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
    return this.controlPointManagementService.createControlPoint(controlPointData);
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
    return this.controlPointManagementService.updateControlPoint(id, updateData);
  }

  async deleteControlPoint(id: number): Promise<void> {
    return this.controlPointManagementService.deleteControlPoint(id);
  }

  async takeControlPoint(
    controlPointId: number,
    userId: number,
    code?: string,
  ): Promise<{ controlPoint: ControlPoint }> {
    return this.controlPointManagementService.takeControlPoint(controlPointId, userId, code);
  }

  async getControlPointWithGame(controlPointId: number): Promise<ControlPoint | null> {
    return this.controlPointManagementService.getControlPointWithGame(controlPointId);
  }

  // Game State Management (Start, Pause, Resume, End, Restart)
  async startGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'controlPoints'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede iniciarlo');
    }

    let gameInstance: GameInstance;

    // Check if game already has an instance (from restart)
    if (game.instanceId) {
      // Use existing game instance
      const existingInstance = await this.gameInstancesRepository.findOne({
        where: { id: game.instanceId },
      });
      if (!existingInstance) {
        throw new NotFoundException('Game instance not found');
      }
      gameInstance = existingInstance;
    } else {
      // Create new game instance when starting from scratch
      gameInstance = await this.gameManagementService.createGameInstance(gameId);
    }

    // Update game instance with start time and totalTime from game entity
    gameInstance.gameStartTime = new Date();
    gameInstance.totalTime = game.totalTime; // Sync with game.totalTime for game logic
    await this.gameInstancesRepository.save(gameInstance);

    // Update game status and set instanceId (if not already set)
    game.status = 'running';
    if (!game.instanceId) {
      game.instanceId = gameInstance.id;
    }
    const updatedGame = await this.gamesRepository.save(game);

    // Add game started event to history
    await this.gameManagementService.addGameHistory(gameInstance.id, 'game_started', {
      gameId,
      startedBy: userId,
      timestamp: new Date(),
    });

    // Register initial control point states for control points with assigned teams
    if (game.controlPoints && game.controlPoints.length > 0) {
      for (const controlPoint of game.controlPoints) {
        if (controlPoint.ownedByTeam) {
          await this.gameManagementService.addGameHistory(gameInstance.id, 'control_point_taken', {
            controlPointId: controlPoint.id,
            controlPointName: controlPoint.name,
            team: controlPoint.ownedByTeam,
            userId: null, // System/owner action
            assignedByOwner: true,
            initialState: true,
            timestamp: new Date(),
          });
        }
      }
    }

    // ALWAYS start timer for running games, even if totalTime is null (indefinite games)
    if (game.status === 'running') {
      // Use gameInstance.totalTime for game logic (already synchronized with game.totalTime)
      void this.timerManagementService.startGameTimer(gameId, gameInstance.totalTime, gameInstance.id);
      // Start all control point timers
      void this.timerManagementService.startAllControlPointTimers(gameId);
      // Start position challenge interval
      this.startPositionChallengeInterval(gameId);
    }

    // Force broadcast time update on game start to ensure all clients receive initial timer state
    this.timerManagementService.forceTimeBroadcast(gameId);

    // Force broadcast game update to ensure all players receive the state change
    // This is critical to ensure players respect pause state after restart
    await this.broadcastGameUpdateWithPlayers(gameId);

    return updatedGame;
  }

  async pauseGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'controlPoints'],
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
      await this.gameManagementService.addGameHistory(game.instanceId, 'game_paused', {
        gameId,
        pausedBy: userId,
        timestamp: new Date(),
      });
    }

    // Pause timer if exists
    this.timerManagementService.pauseGameTimer(gameId);
    // Pause all control point timers
    this.timerManagementService.pauseAllControlPointTimers(gameId);
    // Stop position challenge interval
    this.stopPositionChallengeInterval(gameId);

    // Force broadcast time update on pause
    this.timerManagementService.forceTimeBroadcast(gameId);

    // Force broadcast game update to ensure all players receive the state change
    // This is critical to ensure players respect pause state after restart
    await this.broadcastGameUpdateWithPlayers(gameId);

    return updatedGame;
  }

  async resumeGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'controlPoints'],
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
      await this.gameManagementService.addGameHistory(game.instanceId, 'game_resumed', {
        gameId,
        resumedBy: userId,
        timestamp: new Date(),
      });
    }

    // Resume timer if exists
    this.timerManagementService.resumeGameTimer(gameId);
    // Resume all control point timers
    this.timerManagementService.resumeAllControlPointTimers(gameId);
    // Start position challenge interval
    this.startPositionChallengeInterval(gameId);

    // Force broadcast time update on resume
    this.timerManagementService.forceTimeBroadcast(gameId);

    // Force broadcast game update to ensure all players receive the state change
    // This is critical to ensure players respect pause state after restart
    await this.broadcastGameUpdateWithPlayers(gameId);

    return updatedGame;
  }

  async endGame(gameId: number, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'controlPoints'],
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
      await this.gameManagementService.addGameHistory(game.instanceId, 'game_ended', {
        gameId,
        endedBy: userId,
        timestamp: new Date(),
      });
    }

    // Update game status to finished (keep instanceId for game summary)
    game.status = 'finished';
    const updatedGame = await this.gamesRepository.save(game);

    // Stop timer if exists
    this.timerManagementService.stopGameTimer(gameId);
    // Stop all control point timers
    this.timerManagementService.stopAllControlPointTimers(gameId);
    // Stop position challenge interval
    this.stopPositionChallengeInterval(gameId);

    // Force broadcast final time update on game end
    this.timerManagementService.forceTimeBroadcast(gameId);

    // Force broadcast game update to ensure all players receive the state change
    await this.broadcastGameUpdateWithPlayers(gameId);

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

    // Create new game instance and assign it to the game
    const gameInstance = await this.gameManagementService.createGameInstance(gameId);

    // Update game status to stopped and set new instanceId
    game.status = 'stopped';
    game.instanceId = gameInstance.id;
    // Keep the game's totalTime value for the dropdown synchronization
    // The game.totalTime should remain unchanged so the dropdown shows the correct value
    const updatedGame = await this.gamesRepository.save(game);

    // Include all connected players in the new game instance
    await this.includeConnectedPlayersInNewInstance(gameId, gameInstance.id);

    // Force broadcast the game update to ensure frontend receives the current game.totalTime
    // This is critical for the dropdown to show the correct value after restart
    if (this.gamesGateway) {
      await this.broadcastGameUpdateWithPlayers(gameId);
      
      // Force additional broadcast to ensure all clients receive the update
      setTimeout(() => {
        void this.broadcastGameUpdateWithPlayers(gameId);
      }, 100);
    }

    // Add game restarted event to history
    await this.gameManagementService.addGameHistory(gameInstance.id, 'game_restarted', {
      gameId,
      restartedBy: userId,
      timestamp: new Date(),
    });


    // Force broadcast game update to ensure all players receive the state change
    // This is critical to ensure players respect pause state after restart
    await this.broadcastGameUpdateWithPlayers(gameId);

    // Force broadcast timer updates to reset all control point timers
    // This ensures timers are hidden when game transitions from finished to stopped
    this.timerManagementService.forceTimeBroadcast(gameId).catch(error => {
      console.error(`Error broadcasting timer updates for game ${gameId}:`, error);
    });

    return updatedGame;
  }

  // End game automatically when time expires (system action)
  async endGameAutomatically(gameId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'controlPoints'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Add game ended event to history if there's an active instance
    if (game.instanceId) {
      await this.gameManagementService.addGameHistory(game.instanceId, 'game_ended_automatically', {
        gameId,
        endedBy: 'system',
        timestamp: new Date(),
      });
    }

    // Update game status to finished (keep instanceId for game summary)
    game.status = 'finished';
    const updatedGame = await this.gamesRepository.save(game);

    // Stop timer if exists
    this.timerManagementService.stopGameTimer(gameId);

    // Force broadcast final time update on game end
    this.timerManagementService.forceTimeBroadcast(gameId);

    // BROADCAST GAME STATE CHANGE FORCEFULLY TO ALL PLAYERS
    if (this.gamesGateway) {
      // Broadcast as game update - FORCE BROADCAST TO ALL PLAYERS
      await this.broadcastGameUpdateWithPlayers(gameId);
      
      // Broadcast as game state change - SPECIFIC EVENT FOR STATE CHANGES
      const gameWithPlayers: Game = await this.findOne(gameId);
      this.gamesGateway.broadcastGameStateChange(gameId, gameWithPlayers);
      
      // Force additional broadcast to ensure all players receive it
      setTimeout(() => {
        void this.broadcastGameUpdateWithPlayers(gameId);
      }, 100);
      
      // Also broadcast as gameStateChanged event for better compatibility
      setTimeout(() => {
        void this.findOne(gameId).then((refreshedGame: Game) => {
          this.gamesGateway.broadcastGameStateChange(gameId, refreshedGame);
        });
      }, 200);
    }

    return updatedGame;
  }

  // Timer Management - delegate to TimerManagementService
  async getGameTime(
    gameId: number,
  ): Promise<{ remainingTime: number | null; totalTime: number | null; playedTime: number } | null> {
    return this.timerManagementService.getGameTime(gameId);
  }

  async addTime(gameId: number, seconds: number): Promise<Game> {
    const timer = await this.timerManagementService.getGameTime(gameId);
    if (!timer) {
      throw new Error('No hay un temporizador activo para este juego');
    }

    // Handle negative time (removing time)
    if (seconds < 0) {
      // For limited games, ensure we don't go below elapsed time
      if (timer.totalTime !== null && timer.remainingTime !== null) {
        const newTotalTime = Math.max(timer.playedTime, timer.totalTime + seconds);
        const newRemainingTime = Math.max(0, timer.remainingTime + seconds);

        // Update timer
        // Note: This would need to be implemented in TimerManagementService
      } else {
        // For indefinite games, cannot remove time
        throw new Error('No se puede quitar tiempo de un juego indefinido');
      }
    } else {
      // Handle positive time (adding time)
      if (timer.totalTime !== null && timer.remainingTime !== null) {
        // Update timer
        // Note: This would need to be implemented in TimerManagementService
      } else {
        // If game was indefinite (null or 0), now it becomes limited
        // Note: This would need to be implemented in TimerManagementService
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
    this.timerManagementService.forceTimeBroadcast(gameId);

    // Log game history
    if (game.instanceId) {
      const minutesAdded = seconds / 60;
      await this.gameManagementService.addGameHistory(game.instanceId, 'time_added', {
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
      // Update game instance when game is running - this is what the game logic uses
      const gameInstance = await this.gameInstancesRepository.findOne({
        where: { id: game.instanceId },
      });

      if (gameInstance) {
        gameInstance.totalTime = effectiveTime;
        await this.gameInstancesRepository.save(gameInstance);
      }
    } else {
      // Update game entity when game is stopped - this is what the dropdown uses
      game.totalTime = effectiveTime;
      await this.gamesRepository.save(game);
    }

    // Update timer if exists
    const timer = await this.timerManagementService.getGameTime(gameId);
    if (timer) {
      // Note: This would need to be implemented in TimerManagementService
    }

    // Force broadcast the updated time
    this.timerManagementService.forceTimeBroadcast(gameId);

    return game;
  }

  // Game Instance methods - delegate to GameManagementService
  async createGameInstance(gameId: number): Promise<GameInstance> {
    return this.gameManagementService.createGameInstance(gameId);
  }

  async getGameInstance(gameId: number): Promise<GameInstance | null> {
    return this.gameManagementService.getGameInstance(gameId);
  }

  // Game History methods - delegate to GameManagementService
  async addGameHistory(
    gameInstanceId: number,
    eventType: string,
    data?: any,
  ): Promise<GameHistory> {
    return this.gameManagementService.addGameHistory(gameInstanceId, eventType, data);
  }

  async getGameHistory(gameInstanceId: number): Promise<GameHistory[]> {
    return this.gameManagementService.getGameHistory(gameInstanceId);
  }

  // Bomb Management - delegate to BombManagementService
  async activateBomb(
    controlPointId: number,
    userId: number,
    armedCode: string,
  ): Promise<{ controlPoint: ControlPoint }> {
    return this.bombManagementService.activateBomb(controlPointId, userId, armedCode);
  }

  async deactivateBomb(
    controlPointId: number,
    userId: number,
    disarmedCode: string,
  ): Promise<{ controlPoint: ControlPoint }> {
    return this.bombManagementService.deactivateBomb(controlPointId, userId, disarmedCode);
  }

  async activateBombAsOwner(
    controlPointId: number,
    userId: number,
  ): Promise<{ controlPoint: ControlPoint }> {
    return this.bombManagementService.activateBombAsOwner(controlPointId, userId);
  }

  async deactivateBombAsOwner(
    controlPointId: number,
    userId: number,
  ): Promise<{ controlPoint: ControlPoint }> {
    return this.bombManagementService.deactivateBombAsOwner(controlPointId, userId);
  }

  async getBombTime(controlPointId: number): Promise<{
    remainingTime: number;
    totalTime: number;
    isActive: boolean;
    activatedByUserId?: number;
    activatedByUserName?: string;
    activatedByTeam?: string;
  } | null> {
    return this.bombManagementService.getBombTime(controlPointId);
  }

  async getActiveBombTimers(gameId: number): Promise<
    Array<{
      controlPointId: number;
      remainingTime: number;
      totalTime: number;
      isActive: boolean;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
    }>
  > {
    return this.bombManagementService.getActiveBombTimers(gameId);
  }

  // Timer Management - additional methods
  async getControlPointHoldTime(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<{
    displayTime: string;
    totalHoldTime: number;
    currentHoldTime: number;
    currentTeam: string | null;
  }> {
    return this.timerManagementService.getControlPointHoldTime(controlPointId, gameInstanceId);
  }

  async getControlPointTimes(gameId: number): Promise<
    Array<{
      controlPointId: number;
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    }>
  > {
    return this.timerManagementService.getControlPointTimes(gameId);
  }

  // Game Results - delegate to GameResultsService
  async getGameResultsReport(gameId: number): Promise<{
    controlPoints: Array<{
      id: number;
      name: string;
      teamTimes: { [team: string]: number };
    }>;
    teamTotals: { [team: string]: number };
    teams: string[];
    gameDuration: number;
    playerCaptureStats: Array<{
      userId: number;
      userName: string;
      team: string;
      codeCaptureCount: number;
      positionCaptureCount: number;
      bombDeactivationCount: number;
      bombExplosionCount: number;
    }>;
    positionChallengeStats: {
      controlPoints: Array<{
        id: number;
        name: string;
        teamPoints: { [team: string]: number };
      }>;
      teamTotals: { [team: string]: number };
    };
  }> {
    return this.gameResultsService.getGameResultsReport(gameId);
  }

  // Server recovery methods
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
            // Restart the timer with the existing game instance using gameInstance.totalTime
            void this.timerManagementService.startGameTimer(
              game.id,
              gameInstance.totalTime,
              game.instanceId,
            );
          }

          // Recover active bomb timers for this game
          await this.recoverActiveBombTimers(game.id, game.instanceId);
        }
      }
    } catch (error) {
      console.error('[SERVER_RESTART] Error recovering running games:', error);
    }
  }

  // Recover active bomb timers on server restart
  private async recoverActiveBombTimers(gameId: number, gameInstanceId: number): Promise<void> {
    try {
      // Get all control points for this game
      const game = await this.gamesRepository.findOne({
        where: { id: gameId },
        relations: ['controlPoints'],
      });

      if (!game || !game.controlPoints) {
        return;
      }

      // Check each control point for active bomb timers
      for (const controlPoint of game.controlPoints) {
        if (controlPoint.hasBombChallenge && controlPoint.bombTime) {
          // Calculate remaining bomb time from history
          const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
            controlPoint.id,
            gameInstanceId,
          );

          if (bombTimeData && bombTimeData.isActive) {
            // Start periodic broadcast for this bomb timer
            // Note: This would need to be implemented in BombManagementService
          }
        }
      }
    } catch (error) {
      console.error('[SERVER_RESTART] Error recovering active bomb timers:', error);
    }
  }

  // Position challenge interval methods
  private startPositionChallengeInterval(gameId: number): void {
    // This will be handled by the GamesGateway which has access to player positions
    // The gateway will call the positionChallengeService
  }

  private stopPositionChallengeInterval(gameId: number): void {
    // This will be handled by the GamesGateway which has access to player positions
    // The gateway will call the positionChallengeService
  }

  /**
   * Include all connected players in the new game instance when restarting
   */
  private async includeConnectedPlayersInNewInstance(gameId: number, gameInstanceId: number): Promise<void> {
    try {
      // Get all connected users for this game from the gateway
      const connectedUsers = this.gamesGateway.getConnectedUsersForGame?.(gameId);
      
      if (!connectedUsers || connectedUsers.size === 0) {
        return;
      }


      // Add each connected user to the new game instance
      for (const [socketId, user] of connectedUsers.entries()) {
        try {
          await this.playerManagementService.joinGame(gameId, user.id);
        } catch (error) {
          // Log error but continue with other users
          console.error(`[INCLUDE_PLAYERS] Error including user ${user.id} in new game instance:`, error);
        }
      }

      // Broadcast the updated game state to all clients
      await this.broadcastGameUpdateWithPlayers(gameId);
    } catch (error) {
      console.error(`[INCLUDE_PLAYERS] Error including connected players in new game instance for game ${gameId}:`, error);
    }
  }
}
