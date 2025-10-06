import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { GamesService } from './games.service';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ControlPoint } from './entities/control-point.entity';

@Controller('api/games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(@Headers('authorization') authHeader: string): Promise<Game[]> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    await this.authService.validateToken(token);

    return this.gamesService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<Game> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await this.authService.validateToken(token);

    return this.gamesService.findOne(+id, user.id);
  }

  @Post()
  async create(
    @Body('name') name: string,
    @Body('ownerId') ownerId: number,
    @Headers('authorization') authHeader: string,
  ): Promise<Game> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await this.authService.validateToken(token);

    // Ensure the user can only create games for themselves
    if (user.id !== ownerId) {
      throw new UnauthorizedException('No autorizado para crear juegos como otro usuario');
    }

    return this.gamesService.create({ name }, ownerId);
  }

  @Post(':id/join')
  async joinGame(
    @Param('id') id: string,
    @Body('userId') userId: number,
    @Headers('authorization') authHeader: string,
  ): Promise<Player> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await this.authService.validateToken(token);

    // Ensure the user can only join games for themselves
    if (user.id !== userId) {
      throw new UnauthorizedException('No autorizado para unirse como otro usuario');
    }

    return this.gamesService.joinGame(+id, userId);
  }

  @Post(':id/leave')
  async leaveGame(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await this.authService.validateToken(token);

    // The service method will handle removing the player
    await this.gamesService.leaveGame(+id, user.id);
  }

  @Get('my-games/:userId')
  async getPlayerGames(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader: string,
  ): Promise<Game[]> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await this.authService.validateToken(token);

    // Ensure the user can only access their own games
    if (user.id !== +userId) {
      throw new UnauthorizedException('No autorizado para acceder a estos juegos');
    }

    return this.gamesService.getPlayerGames(+userId);
  }

  @Get(':id/players')
  async getGamePlayers(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<Player[]> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    await this.authService.validateToken(token);

    return this.gamesService.getPlayersByGame(+id);
  }

  @Post('control-points')
  async createControlPoint(
    @Body('name') name: string,
    @Body('description') description: string,
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number,
    @Body('gameId') gameId: number,
    @Headers('authorization') authHeader: string,
  ): Promise<ControlPoint> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    await this.authService.validateToken(token);

    return this.gamesService.createControlPoint({
      name,
      description,
      latitude,
      longitude,
      gameId,
    });
  }

  @Delete(':id')
  async deleteGame(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<void> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await this.authService.validateToken(token);

    return this.gamesService.deleteGame(+id, user.id);
  }

  @Patch(':id')
  async updateGame(
    @Param('id') id: string,
    @Body() updateData: { name?: string },
    @Headers('authorization') authHeader: string,
  ): Promise<Game> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización requerido');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = await this.authService.validateToken(token);

    return this.gamesService.updateGame(+id, updateData, user.id);
  }
}
