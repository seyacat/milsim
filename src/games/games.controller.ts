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
  async findAll(): Promise<Game[]> {
    return this.gamesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Game> {
    return this.gamesService.findOne(+id);
  }

  @Post()
  async create(@Body('name') name: string, @Body('ownerId') ownerId: number): Promise<Game> {
    return this.gamesService.create({ name }, ownerId);
  }

  @Post(':id/join')
  async joinGame(@Param('id') id: string, @Body('userId') userId: number): Promise<Player> {
    return this.gamesService.joinGame(+id, userId);
  }

  @Get('my-games/:userId')
  async getPlayerGames(@Param('userId') userId: string): Promise<Game[]> {
    return this.gamesService.getPlayerGames(+userId);
  }

  @Get(':id/players')
  async getGamePlayers(@Param('id') id: string): Promise<Player[]> {
    return this.gamesService.getPlayersByGame(+id);
  }

  @Post('control-points')
  async createControlPoint(
    @Body('name') name: string,
    @Body('description') description: string,
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number,
    @Body('gameId') gameId: number,
  ): Promise<ControlPoint> {
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
