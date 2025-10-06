import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GamesModule } from './games/games.module';
import { SharedModule } from './shared/shared.module';
import { User } from './auth/entities/user.entity';
import { Game } from './games/entities/game.entity';
import { Player } from './games/entities/player.entity';
import { ControlPoint } from './games/entities/control-point.entity';
import { GameInstance } from './games/entities/game-instance.entity';
import { GameHistory } from './games/entities/game-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST'),
        port: 3306,
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [User, Game, Player, ControlPoint, GameInstance, GameHistory],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    GamesModule,
    SharedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
