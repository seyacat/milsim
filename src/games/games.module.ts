import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ControlPoint } from './entities/control-point.entity';
import { GamesGateway } from './games.gateway';
import { WebsocketAuthService } from '../auth/websocket-auth.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Game, Player, ControlPoint]), AuthModule],
  controllers: [GamesController],
  providers: [GamesService, GamesGateway, WebsocketAuthService],
})
export class GamesModule {}
