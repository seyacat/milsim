import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { GameInstance } from '../entities/game-instance.entity';
import { GameHistory } from '../entities/game-history.entity';
import { ControlPoint } from '../entities/control-point.entity';
import { Player } from '../entities/player.entity';
import { GamesGateway } from '../games.gateway';
import { TimerCalculationService } from './timer-calculation.service';

@Injectable()
export class GameManagementService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameInstance)
    private gameInstancesRepository: Repository<GameInstance>,
    @InjectRepository(GameHistory)
    private gameHistoryRepository: Repository<GameHistory>,
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    @InjectRepository(ControlPoint)
    private controlPointsRepository: Repository<ControlPoint>,
    @Inject(forwardRef(() => GamesGateway))
    private gamesGateway: GamesGateway,
    private timerCalculationService: TimerCalculationService,
  ) {}

  async findAll(): Promise<Game[]> {
    return this.gamesRepository.find({
      relations: ['owner'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId?: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id },
      relations: ['owner', 'controlPoints'],
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Load players from the active game instance if it exists
    if (game.instanceId) {
      const gameInstance = await this.gameInstancesRepository.findOne({
        where: { id: game.instanceId },
        relations: ['players', 'players.user'],
      });
      if (gameInstance && gameInstance.players) {
        game.players = gameInstance.players;
      }
    } else {
      game.players = [];
    }

    // Calculate bomb status for control points with bomb challenge
    if (game.controlPoints && game.instanceId) {
      for (const controlPoint of game.controlPoints) {
        if (controlPoint.hasBombChallenge) {
          try {
            const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
              controlPoint.id,
              game.instanceId,
            );
            if (bombTimeData) {
              // Add bombStatus to control point
              (controlPoint as any).bombStatus = {
                isActive: bombTimeData.isActive,
                remainingTime: bombTimeData.remainingTime,
                totalTime: bombTimeData.totalTime,
                activatedByUserId: bombTimeData.activatedByUserId,
                activatedByUserName: bombTimeData.activatedByUserName,
                activatedByTeam: bombTimeData.activatedByTeam,
              };
            }
          } catch (error) {
            console.error(`Error calculating bomb time for control point ${controlPoint.id}:`, error);
          }
        }
      }
    }

    // Remove sensitive code data from control points only for non-owner users
    if (game.controlPoints && (!userId || game.owner.id !== userId)) {
      game.controlPoints = game.controlPoints.map(cp => {
        const { code, armedCode, disarmedCode, ...safeControlPoint } = cp;
        // Preserve bombStatus even for non-owner users
        if ((cp as any).bombStatus) {
          (safeControlPoint as any).bombStatus = (cp as any).bombStatus;
        }
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
    // Note: This will be handled by the player management service
    return savedGame;
  }

  async deleteGame(gameId: number, userId: number): Promise<void> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints', 'owner'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if user is the owner of the game
    if (game.owner.id !== userId) {
      throw new ConflictException('Solo el propietario del juego puede eliminarlo');
    }

    // Delete related players from game instance
    const gameInstance = await this.gameInstancesRepository.findOne({
      where: { game: { id: gameId } },
      relations: ['players'],
    });
    
    if (gameInstance && gameInstance.players && gameInstance.players.length > 0) {
      await this.playersRepository.remove(gameInstance.players);
    }

    // Delete related control points
    if (game.controlPoints && game.controlPoints.length > 0) {
      await this.controlPointsRepository.remove(game.controlPoints);
    }

    // Delete the game
    await this.gamesRepository.delete(gameId);
  }

  async updateGame(gameId: number, updateData: { name?: string }, userId: number): Promise<Game> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner', 'controlPoints'],
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

  // Game History methods - delegate to TimerCalculationService
  async addGameHistory(
    gameInstanceId: number,
    eventType: string,
    data?: any,
  ): Promise<GameHistory> {
    return this.timerCalculationService.addGameHistory(gameInstanceId, eventType, data);
  }

  async getGameHistory(gameInstanceId: number): Promise<GameHistory[]> {
    // Use TimerCalculationService which now has cache support
    return this.timerCalculationService.getGameHistoryWithCache(gameInstanceId);
  }
}
