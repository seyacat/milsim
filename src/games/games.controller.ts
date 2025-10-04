import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { GamesService } from './games.service';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ControlPoint } from './entities/control-point.entity';

@Controller('api/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

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

}
