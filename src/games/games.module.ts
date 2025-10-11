import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { TimerCalculationService } from './services/timer-calculation.service';
import { PositionChallengeService } from './services/position-challenge.service';
import { GameManagementService } from './services/game-management.service';
import { PlayerManagementService } from './services/player-management.service';
import { ControlPointManagementService } from './services/control-point-management.service';
import { TimerManagementService } from './services/timer-management.service';
import { BombManagementService } from './services/bomb-management.service';
import { GameResultsService } from './services/game-results.service';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { ControlPoint } from './entities/control-point.entity';
import { GameInstance } from './entities/game-instance.entity';
import { GameHistory } from './entities/game-history.entity';
import { GamesGateway } from './games.gateway';
import { WebsocketAuthService } from '../auth/websocket-auth.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, Player, ControlPoint, GameInstance, GameHistory]),
    AuthModule,
  ],
  controllers: [GamesController],
  providers: [
    GamesService,
    TimerCalculationService,
    PositionChallengeService,
    GameManagementService,
    PlayerManagementService,
    ControlPointManagementService,
    TimerManagementService,
    BombManagementService,
    GameResultsService,
    GamesGateway,
    WebsocketAuthService,
  ],
  exports: [GamesService],
})
export class GamesModule {}
