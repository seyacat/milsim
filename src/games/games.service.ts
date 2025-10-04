import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ControlPoint } from './entities/control-point.entity';

@Injectable()
export class GamesService {
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
      relations: ['owner', 'players', 'players.user'],
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
      throw new ConflictException('User is already in this game');
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
          type: 'site'
        }
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

  async updateControlPoint(id: number, updateData: { name: string; type: string }): Promise<ControlPoint> {
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
      where: { id }
    });
    
    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    await this.controlPointsRepository.delete(id);
  }
}
