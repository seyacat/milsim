import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControlPoint } from '../entities/control-point.entity';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { GamesGateway } from '../games.gateway';
import { TimerCalculationService } from './timer-calculation.service';
import { GameManagementService } from './game-management.service';

interface BombTimer {
  controlPointId: number;
  gameInstanceId: number;
  totalTime: number; // Total bomb time in seconds
  remainingTime: number; // Remaining time in seconds
  isActive: boolean;
  activatedByUserId: number;
  activatedByUserName: string;
  activatedByTeam: string; // Team that activated the bomb
  lastBroadcastTime: number;
}

@Injectable()
export class BombManagementService {
  private bombTimers = new Map<number, BombTimer>(); // controlPointId -> bomb timer

  constructor(
    @InjectRepository(ControlPoint)
    private controlPointsRepository: Repository<ControlPoint>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    private gamesGateway: GamesGateway,
    private timerCalculationService: TimerCalculationService,
    private gameManagementService: GameManagementService,
  ) {}

  // Activate bomb with armed code
  async activateBomb(
    controlPointId: number,
    userId: number,
    armedCode: string,
  ): Promise<{ controlPoint: ControlPoint }> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Check if game is running
    if (controlPoint.game.status !== 'running') {
      throw new ConflictException(
        'Solo se puede activar la bomba cuando el juego está en ejecución',
      );
    }

    // Check if bomb challenge is active
    if (!controlPoint.hasBombChallenge) {
      throw new ConflictException('Este punto de control no tiene desafío de bomba');
    }

    // Validate armed code
    if (!controlPoint.armedCode || armedCode.trim() !== controlPoint.armedCode) {
      throw new ConflictException('Código de activación incorrecto');
    }

    // Check if bomb is already active by calculating from history
    if (controlPoint.game?.instanceId) {
      const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
        controlPointId,
        controlPoint.game.instanceId,
      );
      const isBombActive = bombTimeData && bombTimeData.isActive;

      if (isBombActive) {
        throw new ConflictException('La bomba ya está activada, no se puede reactivar');
      }
    }

    // Get user info for bomb activation
    const user = await this.playersRepository.findOne({
      where: {
        game: { id: controlPoint.game.id },
        user: { id: userId },
      },
      relations: ['user'],
    });

    let userName = 'Owner';
    let team = 'owner';

    if (user) {
      userName = user.user?.name || 'Unknown Player';
      team = user.team || 'owner';
    } else {
      // If user is not a player, they might be the owner
      const game = await this.gamesRepository.findOne({
        where: { id: controlPoint.game.id },
        relations: ['owner'],
      });
      if (game && game.owner && game.owner.id === userId) {
        userName = game.owner.name || 'Owner';
        team = 'owner';
      }
    }

    // Activate the bomb
    if (controlPoint.bombTime && controlPoint.game?.instanceId) {
      await this.activateBombTimer(
        controlPoint.id,
        controlPoint.game.instanceId,
        controlPoint.bombTime,
        userId,
        userName,
        team,
      );
    }

    return { controlPoint };
  }

  // Deactivate bomb with disarmed code
  async deactivateBomb(
    controlPointId: number,
    userId: number,
    disarmedCode: string,
  ): Promise<{ controlPoint: ControlPoint }> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Check if game is running
    if (controlPoint.game.status !== 'running') {
      throw new ConflictException(
        'Solo se puede desactivar la bomba cuando el juego está en ejecución',
      );
    }

    // Check if bomb challenge is active
    if (!controlPoint.hasBombChallenge) {
      throw new ConflictException('Este punto de control no tiene desafío de bomba');
    }

    // Validate disarmed code
    if (!controlPoint.disarmedCode || disarmedCode.trim() !== controlPoint.disarmedCode) {
      throw new ConflictException('Código de desactivación incorrecto');
    }

    // Check if bomb is active by calculating from history
    if (controlPoint.game?.instanceId) {
      const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
        controlPointId,
        controlPoint.game.instanceId,
      );
      const isBombActive = bombTimeData && bombTimeData.isActive;

      if (!isBombActive) {
        throw new ConflictException('La bomba no está activada, no se puede desactivar');
      }
    } else {
      throw new ConflictException('La bomba no está activada, no se puede desactivar');
    }

    // Get user info for bomb deactivation
    const user = await this.playersRepository.findOne({
      where: {
        game: { id: controlPoint.game.id },
        user: { id: userId },
      },
      relations: ['user'],
    });

    let userName = 'Owner';
    let team = 'owner';

    if (user) {
      userName = user.user?.name || 'Unknown Player';
      team = user.team || 'owner';
    } else {
      // If user is not a player, they might be the owner
      const game = await this.gamesRepository.findOne({
        where: { id: controlPoint.game.id },
        relations: ['owner'],
      });
      if (game && game.owner && game.owner.id === userId) {
        userName = game.owner.name || 'Owner';
        team = 'owner';
      }
    }

    // Deactivate the bomb
    if (controlPoint.game?.instanceId) {
      await this.deactivateBombTimer(
        controlPoint.id,
        controlPoint.game.instanceId,
        userId,
        userName,
        team,
      );
    }

    return { controlPoint };
  }

  // Activate bomb without code validation (for owner)
  async activateBombAsOwner(
    controlPointId: number,
    userId: number,
  ): Promise<{ controlPoint: ControlPoint }> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Check if game is running
    if (controlPoint.game.status !== 'running') {
      throw new ConflictException(
        'Solo se puede activar la bomba cuando el juego está en ejecución',
      );
    }

    // Check if bomb challenge is active
    if (!controlPoint.hasBombChallenge) {
      throw new ConflictException('Este punto de control no tiene desafío de bomba');
    }

    // Check if bomb is already active by calculating from history
    if (controlPoint.game?.instanceId) {
      const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
        controlPointId,
        controlPoint.game.instanceId,
      );
      const isBombActive = bombTimeData && bombTimeData.isActive;

      if (isBombActive) {
        throw new ConflictException('La bomba ya está activada, no se puede reactivar');
      }
    }

    // Get user info for bomb activation
    const user = await this.playersRepository.findOne({
      where: {
        game: { id: controlPoint.game.id },
        user: { id: userId },
      },
      relations: ['user'],
    });

    let userName = 'Owner';
    let team = 'owner';

    if (user) {
      userName = user.user?.name || 'Unknown Player';
      team = user.team || 'owner';
    } else {
      // If user is not a player, they might be the owner
      const game = await this.gamesRepository.findOne({
        where: { id: controlPoint.game.id },
        relations: ['owner'],
      });
      if (game && game.owner && game.owner.id === userId) {
        userName = game.owner.name || 'Owner';
        team = 'owner';
      }
    }

    // Activate the bomb
    if (controlPoint.bombTime && controlPoint.game?.instanceId) {
      await this.activateBombTimer(
        controlPoint.id,
        controlPoint.game.instanceId,
        controlPoint.bombTime,
        userId,
        userName,
        team,
      );
    }

    return { controlPoint };
  }

  // Deactivate bomb without code validation (for owner)
  async deactivateBombAsOwner(
    controlPointId: number,
    userId: number,
  ): Promise<{ controlPoint: ControlPoint }> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Check if game is running
    if (controlPoint.game.status !== 'running') {
      throw new ConflictException(
        'Solo se puede desactivar la bomba cuando el juego está en ejecución',
      );
    }

    // Check if bomb challenge is active
    if (!controlPoint.hasBombChallenge) {
      throw new ConflictException('Este punto de control no tiene desafío de bomba');
    }

    // Check if bomb is active by calculating from history
    if (controlPoint.game?.instanceId) {
      const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
        controlPointId,
        controlPoint.game.instanceId,
      );
      const isBombActive = bombTimeData && bombTimeData.isActive;

      if (!isBombActive) {
        throw new ConflictException('La bomba no está activada, no se puede desactivar');
      }
    } else {
      throw new ConflictException('La bomba no está activada, no se puede desactivar');
    }

    // Get user info for bomb deactivation
    const user = await this.playersRepository.findOne({
      where: {
        game: { id: controlPoint.game.id },
        user: { id: userId },
      },
      relations: ['user'],
    });

    let userName = 'Owner';
    let team = 'owner';

    if (user) {
      userName = user.user?.name || 'Unknown Player';
      team = user.team || 'owner';
    } else {
      // If user is not a player, they might be the owner
      const game = await this.gamesRepository.findOne({
        where: { id: controlPoint.game.id },
        relations: ['owner'],
      });
      if (game && game.owner && game.owner.id === userId) {
        userName = game.owner.name || 'Owner';
        team = 'owner';
      }
    }

    // Deactivate the bomb
    if (controlPoint.game?.instanceId) {
      await this.deactivateBombTimer(
        controlPoint.id,
        controlPoint.game.instanceId,
        userId,
        userName,
        team,
      );
    }

    return { controlPoint };
  }

  // Bomb timer management methods
  private async activateBombTimer(
    controlPointId: number,
    gameInstanceId: number,
    bombTime: number,
    userId: number,
    userName: string,
    team: string,
  ): Promise<void> {
    // Stop existing bomb timer if any
    this.stopBombTimer(controlPointId);

    // Check if game is running before starting bomb timer
    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });

    if (!game || game.status !== 'running') {
      return;
    }

    // Add bomb activated event to history
    await this.gameManagementService.addGameHistory(gameInstanceId, 'bomb_activated', {
      controlPointId,
      bombTime,
      activatedByUserId: userId,
      activatedByUserName: userName,
      activatedByTeam: team,
      timestamp: new Date(),
    });

    // Send initial bomb time update IMMEDIATELY when bomb is activated
    if (this.gamesGateway) {
      this.gamesGateway.broadcastBombTimeUpdate(controlPointId, {
        remainingTime: bombTime,
        totalTime: bombTime,
        isActive: true,
        activatedByUserId: userId,
        activatedByUserName: userName,
        activatedByTeam: team,
      });
    }

    // Start periodic bomb time calculation and broadcast
    this.startBombTimeBroadcast(controlPointId, gameInstanceId);
  }

  private stopBombTimer(controlPointId: number): void {
    // No in-memory timer to stop - handled by history calculation
  }

  // Start periodic bomb time calculation and broadcast
  private startBombTimeBroadcast(controlPointId: number, gameInstanceId: number): void {
    let lastBroadcastTime = 0;

    const intervalId = setInterval(() => {
      void (async () => {
        const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
          controlPointId,
          gameInstanceId,
        );

        if (!bombTimeData || !bombTimeData.isActive) {
          // Bomb is no longer active, stop broadcasting
          clearInterval(intervalId);
          return;
        }

        // Check if bomb time's up FIRST - this is critical
        if (bombTimeData.remainingTime <= 0) {
          // Bomb exploded - handle explosion logic
          await this.handleBombExplosion(controlPointId, gameInstanceId);
          clearInterval(intervalId);
          return;
        }

        // Broadcast bomb time update ONLY every 20 seconds
        const currentTime = bombTimeData.totalTime - bombTimeData.remainingTime;
        if (currentTime - lastBroadcastTime >= 20) {
          if (this.gamesGateway) {
            this.gamesGateway.broadcastBombTimeUpdate(controlPointId, {
              remainingTime: bombTimeData.remainingTime,
              totalTime: bombTimeData.totalTime,
              isActive: bombTimeData.isActive,
              activatedByUserId: bombTimeData.activatedByUserId,
              activatedByUserName: bombTimeData.activatedByUserName,
              activatedByTeam: bombTimeData.activatedByTeam,
            });
          }
          lastBroadcastTime = currentTime;
        }
      })();
    }, 1000); // 1 second interval for calculation, 20 seconds for broadcast
  }

  private async handleBombExplosion(controlPointId: number, gameInstanceId: number): Promise<void> {
    // Stop the bomb timer
    this.stopBombTimer(controlPointId);

    // Get the bomb activation data from history to determine who activated it
    const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
      controlPointId,
      gameInstanceId,
    );
    const activatedByUserId = bombTimeData?.activatedByUserId;
    const activatedByUserName = bombTimeData?.activatedByUserName;
    const activatedByTeam = bombTimeData?.activatedByTeam;

    // Add bomb exploded event to history
    await this.gameManagementService.addGameHistory(gameInstanceId, 'bomb_exploded', {
      controlPointId,
      activatedByUserId,
      activatedByUserName,
      activatedByTeam,
      timestamp: new Date(),
    });

    // Broadcast bomb explosion
    if (this.gamesGateway) {
      this.gamesGateway.broadcastBombTimeUpdate(controlPointId, {
        remainingTime: 0,
        totalTime: 0,
        isActive: false,
        exploded: true,
      });
    }
  }

  // Get current bomb time for a control point
  async getBombTime(controlPointId: number): Promise<{
    remainingTime: number;
    totalTime: number;
    isActive: boolean;
    activatedByUserId?: number;
    activatedByUserName?: string;
    activatedByTeam?: string;
  } | null> {
    // Always calculate from game history events, not from in-memory timer
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });

    if (!controlPoint || !controlPoint.game?.instanceId) {
      return null;
    }

    return this.timerCalculationService.calculateRemainingBombTime(
      controlPointId,
      controlPoint.game.instanceId,
    );
  }

  // Deactivate bomb timer
  private async deactivateBombTimer(
    controlPointId: number,
    gameInstanceId: number,
    userId: number,
    userName: string,
    team: string,
  ): Promise<void> {
    // Get the bomb activation data from history to check who activated it
    const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
      controlPointId,
      gameInstanceId,
    );
    const activatedByTeam = bombTimeData?.activatedByTeam;

    // Check if this is a deactivation by opposing team (only count points for opposing team deactivations)
    const isOpposingTeamDeactivation = activatedByTeam && activatedByTeam !== team;

    // Add bomb deactivated event to history
    await this.gameManagementService.addGameHistory(gameInstanceId, 'bomb_deactivated', {
      controlPointId,
      deactivatedByUserId: userId,
      deactivatedByUserName: userName,
      deactivatedByTeam: team,
      activatedByTeam: activatedByTeam,
      isOpposingTeamDeactivation: isOpposingTeamDeactivation,
      timestamp: new Date(),
    });

    // Broadcast bomb deactivation
    if (this.gamesGateway) {
      this.gamesGateway.broadcastBombTimeUpdate(controlPointId, {
        remainingTime: 0,
        totalTime: 0,
        isActive: false,
      });
    }
  }

  // Get all active bomb timers for a game
  async getActiveBombTimers(gameId: number): Promise<
    Array<{
      controlPointId: number;
      remainingTime: number;
      totalTime: number;
      isActive: boolean;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
    }>
  > {
    const activeBombTimers: Array<{
      controlPointId: number;
      remainingTime: number;
      totalTime: number;
      isActive: boolean;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
    }> = [];

    // Get all control points for this game
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints'],
    });

    if (game && game.instanceId && game.controlPoints) {
      for (const controlPoint of game.controlPoints) {
        if (controlPoint.hasBombChallenge && controlPoint.bombTime) {
          // Calculate remaining bomb time from history (not from in-memory timer)
          const bombTimeData = await this.timerCalculationService.calculateRemainingBombTime(
            controlPoint.id,
            game.instanceId,
          );

          if (bombTimeData && bombTimeData.isActive) {
            activeBombTimers.push({
              controlPointId: controlPoint.id,
              remainingTime: bombTimeData.remainingTime,
              totalTime: bombTimeData.totalTime,
              isActive: bombTimeData.isActive,
              activatedByUserId: bombTimeData.activatedByUserId,
              activatedByUserName: bombTimeData.activatedByUserName,
              activatedByTeam: bombTimeData.activatedByTeam,
            });
          }
        }
      }
    }

    return activeBombTimers;
  }
}
