import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../entities/player.entity';
import { Game } from '../entities/game.entity';
import { GameInstance } from '../entities/game-instance.entity';

@Injectable()
export class PlayerManagementService {
  constructor(
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameInstance)
    private gameInstanceRepository: Repository<GameInstance>,
  ) {}

  async joinGame(gameId: number, userId: number): Promise<Player> {
    // Check if game exists and get the active game instance
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['owner'],
    });
    if (!game) {
      console.error(`[JOIN_GAME] Game ${gameId} not found`);
      throw new NotFoundException('Game not found');
    }

    // Get the active game instance
    if (!game.instanceId) {
      console.error(`[JOIN_GAME] Game ${gameId} has no active instance`);
      throw new NotFoundException('Game has no active instance');
    }

    const gameInstance = await this.gameInstanceRepository.findOne({
      where: { id: game.instanceId },
    });
    if (!gameInstance) {
      console.error(`[JOIN_GAME] Game instance ${game.instanceId} not found`);
      throw new NotFoundException('Game instance not found');
    }

    // Check if user is already in the game
    const existingPlayer = await this.playersRepository.findOne({
      where: { gameInstance: { id: gameInstance.id }, user: { id: userId } },
    });
    if (existingPlayer) {
      // User is already in the game, return the existing player (allow reconnection)
      return existingPlayer;
    }

    // Check if game is full by counting players in the game instance
    const playerCount = await this.playersRepository.count({
      where: { gameInstance: { id: gameInstance.id } },
    });
    if (playerCount >= game.maxPlayers) {
      console.error(
        `[JOIN_GAME] Game instance ${gameInstance.id} is full: ${playerCount}/${game.maxPlayers}`,
      );
      throw new ConflictException('Game is full');
    }

    // Create player entry
    const player = this.playersRepository.create({
      gameInstance: { id: gameInstance.id },
      user: { id: userId },
    });

    const savedPlayer = await this.playersRepository.save(player);

    return savedPlayer;
  }

  async leaveGame(gameId: number, userId: number): Promise<void> {
    // Get the game to find the active instance
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
    });
    if (!game || !game.instanceId) {
      return; // Game or instance not found, nothing to do
    }

    // Find the player entry
    const player = await this.playersRepository.findOne({
      where: { gameInstance: { id: game.instanceId }, user: { id: userId } },
    });

    if (!player) {
      return; // User is not in the game, nothing to do
    }

    await this.playersRepository.remove(player);
  }

  async getPlayerGames(userId: number): Promise<Game[]> {
    const players = await this.playersRepository.find({
      where: { user: { id: userId } },
      relations: ['gameInstance', 'gameInstance.game', 'gameInstance.game.owner'],
    });
    return players.map(player => player.gameInstance.game);
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
    // Get the game to find the active instance
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
    });
    if (!game || !game.instanceId) {
      return []; // Game or instance not found, return empty array
    }

    return this.playersRepository.find({
      where: { gameInstance: { id: game.instanceId } },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }
}
