import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ControlPoint } from './entities/control-point.entity';

interface GameTimer {
  gameId: number;
  totalTime: number; // Total time in seconds
  remainingTime: number; // Remaining time in seconds
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
      console.log(`User ${userId} is already in game ${gameId}, allowing reconnection`);
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
    return players.map((player) => player.game);
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

    // Check if trying to create a Site and one already exists
    if (controlPointData.type === 'site') {
      const existingSite = await this.controlPointsRepository.findOne({
        where: {
          game: { id: controlPointData.gameId },
          type: 'site',
        },
      });
      
      if (existingSite) {
        throw new ConflictException(
          'Solo puede haber un punto de tipo Site por juego',
        );
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

    // Check if trying to change to Site and one already exists
    if (updateData.type === 'site' && controlPoint.type !== 'site') {
      const existingSite = await this.controlPointsRepository.findOne({
        where: {
          game: { id: controlPoint.game.id },
          type: 'site',
        },
      });
      
      if (existingSite && existingSite.id !== id) {
        throw new ConflictException(
          'Solo puede haber un punto de tipo Site por juego',
        );
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

    // Update game status
    game.status = 'running';
    const updatedGame = await this.gamesRepository.save(game);

    // Start timer if game has time limit
    if (game.totalTime && game.totalTime > 0) {
      this.startGameTimer(gameId, game.totalTime);
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

    // Pause timer if exists
    this.pauseGameTimer(gameId);

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

    // Resume timer if exists
    this.resumeGameTimer(gameId);

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

    // Update game status
    game.status = 'stopped';
    const updatedGame = await this.gamesRepository.save(game);

    // Stop timer if exists
    this.stopGameTimer(gameId);

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
      throw new ConflictException('Solo el propietario del juego puede cambiar el número de equipos');
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
  private startGameTimer(gameId: number, totalTime: number): void {
    // Stop existing timer if any
    this.stopGameTimer(gameId);

    const timer: GameTimer = {
      gameId,
      totalTime,
      remainingTime: totalTime,
      startTime: new Date(),
      isRunning: true,
    };

    // Start countdown interval
    timer.intervalId = setInterval(() => {
      if (timer.isRunning && timer.remainingTime > 0) {
        timer.remainingTime--;
        
        // Broadcast time update to all connected clients
        // This will be handled by the gateway
        console.log(`Game ${gameId} time update: ${timer.remainingTime}s remaining`);
        
        // TODO: Broadcast time update via WebSocket
      } else if (timer.remainingTime <= 0) {
        // Time's up - end the game
        this.endGame(gameId, 0).catch(console.error); // 0 is system user ID
      }
    }, 1000);

    this.gameTimers.set(gameId, timer);
    console.log(`Started timer for game ${gameId}, total time: ${totalTime}s`);
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

  // Get current time for a game
  getGameTime(gameId: number): { remainingTime: number; totalTime: number } | null {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      return {
        remainingTime: timer.remainingTime,
        totalTime: timer.totalTime,
      };
    }
    return null;
  }

  async addTime(gameId: number, minutes: number): Promise<Game> {
    const timer = this.gameTimers.get(gameId);
    if (!timer) {
      throw new Error('No hay un temporizador activo para este juego');
    }

    if (timer.totalTime) {
      timer.totalTime += minutes * 60;
      timer.remainingTime += minutes * 60;
    } else {
      // If game was indefinite, now it becomes limited
      const elapsed = timer.totalTime - timer.remainingTime;
      timer.totalTime = elapsed + (minutes * 60);
      timer.remainingTime = minutes * 60;
    }

    const game = await this.findOne(gameId);
    game.totalTime = timer.totalTime;
    await this.gamesRepository.save(game);

    return game;
  }
}
