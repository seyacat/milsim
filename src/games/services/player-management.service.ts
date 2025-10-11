import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Player } from '../entities/player.entity';
import { Game } from '../entities/game.entity';

@Injectable()
export class PlayerManagementService {
  constructor(
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
  ) {}

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
}