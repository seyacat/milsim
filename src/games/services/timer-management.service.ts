import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { GameInstance } from '../entities/game-instance.entity';
import { ControlPoint } from '../entities/control-point.entity';
import { GamesGateway } from '../games.gateway';
import { GamesService } from '../games.service';
import { TimerCalculationService } from './timer-calculation.service';

interface GameTimer {
  gameId: number;
  totalTime: number | null; // Total time in seconds (null for unlimited)
  remainingTime: number | null; // Remaining time in seconds (null for unlimited)
  elapsedTime: number; // Elapsed time in seconds (always tracked)
  startTime: Date; // When the game started
  intervalId?: NodeJS.Timeout;
  isRunning: boolean;
  timeEvents: Array<{
    type: 'game_started' | 'game_paused' | 'game_resumed';
    timestamp: Date;
  }>; // Track time events for accurate calculation
}

interface ControlPointTimer {
  controlPointId: number;
  gameInstanceId: number;
  currentHoldTime: number;
  currentTeam: string | null;
  intervalId?: NodeJS.Timeout;
  isRunning: boolean;
  lastBroadcastTime: number;
}

@Injectable()
export class TimerManagementService {
  private gameTimers = new Map<number, GameTimer>();
  private controlPointTimers = new Map<number, ControlPointTimer>(); // controlPointId -> timer
  private positionChallengeTimers = new Map<number, NodeJS.Timeout>(); // gameId -> position challenge interval

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameInstance)
    private gameInstancesRepository: Repository<GameInstance>,
    @InjectRepository(ControlPoint)
    private controlPointsRepository: Repository<ControlPoint>,
    @Inject(forwardRef(() => GamesGateway))
    private gamesGateway: GamesGateway,
    @Inject(forwardRef(() => GamesService))
    private gamesService: GamesService,
    private timerCalculationService: TimerCalculationService,
  ) {
    // Restart timers for running games when service initializes
    this.restartRunningGameTimers();
  }

  // Game Timer management methods
  async startGameTimer(
    gameId: number,
    totalTime: number | null,
    gameInstanceId: number,
  ): Promise<void> {
    // Stop existing timer if any
    this.stopGameTimer(gameId);

    // Calculate elapsed time from game history events
    const elapsedTime =
      await this.timerCalculationService.calculateElapsedTimeFromEvents(gameInstanceId);

    const timer: GameTimer = {
      gameId,
      totalTime: totalTime === 0 ? null : totalTime, // Treat 0 as indefinite (null)
      remainingTime:
        totalTime === 0 ? null : totalTime !== null ? Math.max(0, totalTime - elapsedTime) : null,
      elapsedTime: elapsedTime,
      startTime: new Date(),
      isRunning: true,
      timeEvents: await this.timerCalculationService.getTimeEventsFromHistory(gameInstanceId),
    };

    // Start countdown interval (update every second internally, broadcast every 20 seconds)
    timer.intervalId = setInterval(() => {
      if (timer.isRunning) {
        // Calculate elapsed time from events for accuracy (without async/await in interval)
        this.timerCalculationService
          .calculateElapsedTimeFromEvents(gameInstanceId)
          .then(currentElapsedTime => {
            timer.elapsedTime = currentElapsedTime;

            // Update remaining time if there's a total time limit
            if (timer.totalTime !== null && timer.remainingTime !== null) {
              timer.remainingTime = Math.max(0, timer.totalTime - timer.elapsedTime);
            }

            // Broadcast time update every 20 seconds AND on the first second
            if ((timer.elapsedTime % 20 === 0 || timer.elapsedTime === 1) && this.gamesGateway) {
              this.gamesGateway.broadcastTimeUpdate(gameId, {
                remainingTime: timer.remainingTime,
                playedTime: timer.elapsedTime,
                totalTime: timer.totalTime,
              });
            }

            // Check if time's up for limited games (only if totalTime is not null)
            if (
              timer.totalTime !== null &&
              timer.remainingTime !== null &&
              timer.remainingTime <= 0
            ) {
              // Time's up - end the game automatically (system action)
              // Stop the timer immediately to prevent further updates
              this.stopGameTimer(gameId);
              
              this.gamesService.endGameAutomatically(gameId)
                .then(() => {
                })
                .catch(error => {
                  console.error(`[TIMER_MANAGEMENT] Error ending game ${gameId} automatically:`, error);
                });
            }
          })
          .catch(console.error);
      }
    }, 1000); // 1 second interval

    this.gameTimers.set(gameId, timer);

    // Start position challenge processing interval
    this.startPositionChallengeProcessing(gameId);

    // Send initial time update
    if (this.gamesGateway) {
      this.gamesGateway.broadcastTimeUpdate(gameId, {
        remainingTime: timer.remainingTime,
        playedTime: timer.elapsedTime,
        totalTime: timer.totalTime,
      });
    }
  }

  pauseGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      timer.isRunning = false;
    }
  }

  resumeGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      timer.isRunning = true;
    }
  }

  stopGameTimer(gameId: number): void {
    const timer = this.gameTimers.get(gameId);
    if (timer && timer.intervalId) {
      clearInterval(timer.intervalId);
      this.gameTimers.delete(gameId);
    }

    // Stop position challenge processing
    this.stopPositionChallengeProcessing(gameId);
  }

  // Force broadcast time update (used for important events)
  async forceTimeBroadcast(gameId: number): Promise<void> {
    const timer = this.gameTimers.get(gameId);
    if (this.gamesGateway) {
      // Always broadcast game time update
      if (timer) {
        this.gamesGateway.broadcastTimeUpdate(gameId, {
          remainingTime: timer.remainingTime,
          playedTime: timer.elapsedTime,
          totalTime: timer.totalTime,
        });
      } else {
        // Get time data from database when no active timer exists
        const timeData = await this.getGameTime(gameId);
        if (timeData) {
          this.gamesGateway.broadcastTimeUpdate(gameId, {
            remainingTime: timeData.remainingTime,
            playedTime: timeData.playedTime,
            totalTime: timeData.totalTime,
          });
        }
      }

      // Always broadcast control point times
      const controlPointTimes = await this.getControlPointTimes(gameId);
      if (controlPointTimes.length > 0) {
        this.gamesGateway.broadcastTimeUpdate(gameId, {
          remainingTime: null, // Will be populated by broadcastTimeUpdate
          totalTime: null, // Will be populated by broadcastTimeUpdate
          playedTime: 0, // Will be populated by broadcastTimeUpdate
        });
      }
    }
  }

  // Get current time for a game
  async getGameTime(
    gameId: number,
  ): Promise<{ remainingTime: number | null; totalTime: number | null; playedTime: number } | null> {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      return {
        remainingTime: timer.remainingTime,
        totalTime: timer.totalTime,
        playedTime: timer.elapsedTime,
      };
    }

    // If no timer exists, try to calculate from game history
    try {
      const game = await this.gamesRepository.findOne({
        where: { id: gameId },
      });

      if (!game || !game.instanceId) {
        return null;
      }

      // Calculate elapsed time from game history events
      const elapsedTime = await this.timerCalculationService.calculateElapsedTimeFromEvents(game.instanceId);

      return {
        remainingTime: game.totalTime ? Math.max(0, game.totalTime - elapsedTime) : null,
        totalTime: game.totalTime,
        playedTime: elapsedTime,
      };
    } catch (error) {
      console.error(`Error calculating game time for game ${gameId}:`, error);
      return null;
    }
  }

  // Control Point Timer management methods
  async startControlPointTimer(controlPointId: number, gameInstanceId: number): Promise<void> {
    // Stop existing timer if any
    this.stopControlPointTimer(controlPointId);

    // Check if game is running before starting timer
    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });

    if (!game || game.status !== 'running') {
      return;
    }

    // Get initial control point state
    const initialState = await this.getInitialControlPointState(controlPointId, gameInstanceId);

    const timer: ControlPointTimer = {
      controlPointId,
      gameInstanceId,
      currentHoldTime: initialState.currentHoldTime,
      currentTeam: initialState.currentTeam,
      isRunning: true,
      lastBroadcastTime: 0,
    };

    // Start countdown interval (update every second internally, broadcast every 20 seconds)
    timer.intervalId = setInterval(() => {
      if (timer.isRunning) {
        // Increment current hold time
        timer.currentHoldTime++;

        // Broadcast time update every 20 seconds AND on the first second
        if ((timer.currentHoldTime % 20 === 0 || timer.currentHoldTime === 1) && this.gamesGateway) {
          this.gamesGateway.broadcastControlPointTimeUpdate(controlPointId, {
            currentHoldTime: timer.currentHoldTime,
            currentTeam: timer.currentTeam,
            displayTime: this.timerCalculationService.formatTime(timer.currentHoldTime),
          });
          timer.lastBroadcastTime = timer.currentHoldTime;
        }
      }
    }, 1000); // 1 second interval

    this.controlPointTimers.set(controlPointId, timer);

    // Send initial time update for individual control point
    if (this.gamesGateway) {
      this.gamesGateway.broadcastControlPointTimeUpdate(controlPointId, {
        currentHoldTime: timer.currentHoldTime,
        currentTeam: timer.currentTeam,
        displayTime: this.timerCalculationService.formatTime(timer.currentHoldTime),
      });

      // Also broadcast all control point times to ensure frontend has complete state
      const game = await this.gamesRepository.findOne({
        where: { instanceId: gameInstanceId },
      });
      
      if (game) {
        const allControlPointTimes = await this.getControlPointTimes(game.id);
        this.gamesGateway.broadcastTimeUpdate(game.id, {
          remainingTime: null, // Will be populated by broadcastTimeUpdate
          totalTime: null, // Will be populated by broadcastTimeUpdate
          playedTime: 0, // Will be populated by broadcastTimeUpdate
        });
      }
    }
  }

  pauseControlPointTimer(controlPointId: number): void {
    const timer = this.controlPointTimers.get(controlPointId);
    if (timer) {
      timer.isRunning = false;
    }
  }

  resumeControlPointTimer(controlPointId: number): void {
    const timer = this.controlPointTimers.get(controlPointId);
    if (timer) {
      timer.isRunning = true;
    }
  }

  stopControlPointTimer(controlPointId: number): void {
    const timer = this.controlPointTimers.get(controlPointId);
    if (timer && timer.intervalId) {
      clearInterval(timer.intervalId);
      this.controlPointTimers.delete(controlPointId);
    }
  }

  // Start all control point timers for a game
  async startAllControlPointTimers(gameId: number): Promise<void> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints'],
    });

    if (!game || !game.instanceId) {
      return;
    }

    // Start timers for all control points
    if (game.controlPoints) {
      for (const controlPoint of game.controlPoints) {
        await this.startControlPointTimer(controlPoint.id, game.instanceId);
      }
    }

    // Broadcast all control point times after starting all timers
    if (this.gamesGateway) {
      const allControlPointTimes = await this.getControlPointTimes(gameId);
      this.gamesGateway.broadcastTimeUpdate(gameId, {
        remainingTime: null, // Will be populated by broadcastTimeUpdate
        totalTime: null, // Will be populated by broadcastTimeUpdate
        playedTime: 0, // Will be populated by broadcastTimeUpdate
      });
    }
  }

  // Pause all control point timers for a game
  pauseAllControlPointTimers(gameId: number): void {
    const game = this.gamesRepository
      .findOne({
        where: { id: gameId },
        relations: ['controlPoints'],
      })
      .then(game => {
        if (game && game.controlPoints) {
          for (const controlPoint of game.controlPoints) {
            this.pauseControlPointTimer(controlPoint.id);
          }
        }
      });
  }

  // Resume all control point timers for a game
  resumeAllControlPointTimers(gameId: number): void {
    const game = this.gamesRepository
      .findOne({
        where: { id: gameId },
        relations: ['controlPoints'],
      })
      .then(game => {
        if (game && game.controlPoints) {
          for (const controlPoint of game.controlPoints) {
            this.resumeControlPointTimer(controlPoint.id);
          }
        }
      });
  }

  // Stop all control point timers for a game
  stopAllControlPointTimers(gameId: number): void {
    const game = this.gamesRepository
      .findOne({
        where: { id: gameId },
        relations: ['controlPoints'],
      })
      .then(game => {
        if (game && game.controlPoints) {
          for (const controlPoint of game.controlPoints) {
            this.stopControlPointTimer(controlPoint.id);
          }
        }
      });
  }

  // Update control point timer when ownership changes
  async updateControlPointTimer(controlPointId: number, gameInstanceId: number, fromPositionChallenge: boolean = false): Promise<void> {
    // If the change comes from position challenge, DO NOT stop the timer
    // Position challenge should continue running without interruption
    if (!fromPositionChallenge) {
      // Stop existing timer only for non-position-challenge changes
      this.stopControlPointTimer(controlPointId);
    }

    // Start new timer with updated data
    await this.startControlPointTimer(controlPointId, gameInstanceId);
  }

  // Get initial control point state from database
  async getInitialControlPointState(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<{ currentHoldTime: number; currentTeam: string | null }> {
    // Get the control point from database to check current ownership
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
    });

    if (!controlPoint) {
      return { currentHoldTime: 0, currentTeam: null };
    }

    // If control point is not owned by a team, return 0 time
    if (!controlPoint.ownedByTeam) {
      return { currentHoldTime: 0, currentTeam: null };
    }

    // Calculate accumulated time from game history for this control point
    const accumulatedTime = await this.calculateAccumulatedHoldTime(controlPointId, gameInstanceId);

    return {
      currentHoldTime: accumulatedTime,
      currentTeam: controlPoint.ownedByTeam,
    };
  }

  // Calculate accumulated hold time from game history for a specific control point
  private async calculateAccumulatedHoldTime(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<number> {
    return this.timerCalculationService.calculateAccumulatedHoldTime(
      controlPointId,
      gameInstanceId,
    );
  }

  // Get control point hold time for display
  async getControlPointHoldTime(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<{
    displayTime: string;
    totalHoldTime: number;
    currentHoldTime: number;
    currentTeam: string | null;
  }> {
    // Get current timer state if exists, otherwise get initial state
    const timer = this.controlPointTimers.get(controlPointId);
    if (timer) {
      return {
        displayTime: this.timerCalculationService.formatTime(timer.currentHoldTime),
        totalHoldTime: timer.currentHoldTime,
        currentHoldTime: timer.currentHoldTime,
        currentTeam: timer.currentTeam,
      };
    } else {
      const initialState = await this.getInitialControlPointState(controlPointId, gameInstanceId);
      return {
        displayTime: this.timerCalculationService.formatTime(initialState.currentHoldTime),
        totalHoldTime: initialState.currentHoldTime,
        currentHoldTime: initialState.currentHoldTime,
        currentTeam: initialState.currentTeam,
      };
    }
  }

  // Get all control point times for a game
  async getControlPointTimes(gameId: number): Promise<
    Array<{
      controlPointId: number;
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    }>
  > {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints'],
    });

    if (!game) {
      return [];
    }


    // If game is stopped, return zero times with null teams to hide timers
    // For paused state, keep the current team ownership but don't increment timers
    if (game.status === 'stopped') {
      
      const controlPointTimes: Array<{
        controlPointId: number;
        currentHoldTime: number;
        currentTeam: string | null;
        displayTime: string;
      }> = [];

      if (game.controlPoints) {
        for (const controlPoint of game.controlPoints) {
          controlPointTimes.push({
            controlPointId: controlPoint.id,
            currentHoldTime: 0,
            currentTeam: null, // Force null team to hide timers
            displayTime: '00:00',
          });
        }
      }

      return controlPointTimes;
    }

    // Game is running - return actual timer values
    if (!game.instanceId) {
      return [];
    }

    const controlPointTimes: Array<{
      controlPointId: number;
      currentHoldTime: number;
      currentTeam: string | null;
      displayTime: string;
    }> = [];

    if (game.controlPoints) {
      for (const controlPoint of game.controlPoints) {
        // Get current timer state if exists, otherwise get initial state
        const timer = this.controlPointTimers.get(controlPoint.id);
        if (timer) {
          controlPointTimes.push({
            controlPointId: controlPoint.id,
            currentHoldTime: timer.currentHoldTime,
            currentTeam: timer.currentTeam,
            displayTime: this.timerCalculationService.formatTime(timer.currentHoldTime),
          });
        } else {
          // Always calculate current hold time from game history, even if no timer is active
          const currentHoldTime = await this.calculateAccumulatedHoldTime(
            controlPoint.id,
            game.instanceId,
          );

          controlPointTimes.push({
            controlPointId: controlPoint.id,
            currentHoldTime: currentHoldTime,
            currentTeam: controlPoint.ownedByTeam,
            displayTime: this.timerCalculationService.formatTime(currentHoldTime),
          });
        }
      }
    }

    return controlPointTimes;
  }

  /**
   * Start position challenge processing interval for a game
   */
  private startPositionChallengeProcessing(gameId: number): void {
    // Stop existing interval if any
    this.stopPositionChallengeProcessing(gameId);

    // Start new interval every 20 seconds
    const interval = setInterval(() => {
      void (async () => {
        try {
          // Check if game is still running
          const game = await this.gamesRepository.findOne({
            where: { id: gameId },
          });

          if (!game || game.status !== 'running') {
            this.stopPositionChallengeProcessing(gameId);
            return;
          }

          // Trigger position challenge processing through games gateway
          // The games gateway has access to player positions and can call the position challenge service
          if (this.gamesGateway) {
            await this.gamesGateway.processPositionChallenge(gameId);
          }
        } catch (error) {
          console.error(
            `[POSITION_CHALLENGE_TIMER] Error in position challenge processing for game ${gameId}:`,
            error,
          );
        }
      })();
    }, 20000); // 20 seconds

    this.positionChallengeTimers.set(gameId, interval);
  }

  /**
   * Stop position challenge processing for a game
   */
  private stopPositionChallengeProcessing(gameId: number): void {
    const interval = this.positionChallengeTimers.get(gameId);
    if (interval) {
      clearInterval(interval);
      this.positionChallengeTimers.delete(gameId);
    }
  }

  // Restart timers for all running games
  private async restartRunningGameTimers(): Promise<void> {
    try {
      // Get all running games
      const runningGames = await this.gamesRepository.find({
        where: { status: 'running' },
        relations: ['controlPoints'],
      });

      for (const game of runningGames) {
        if (game.instanceId) {
          // Restart game timer
          await this.startGameTimer(game.id, game.totalTime, game.instanceId);

          // Restart control point timers
          if (game.controlPoints && game.controlPoints.length > 0) {
            await this.startAllControlPointTimers(game.id);
          }
        }
      }
    } catch (error) {
      console.error('Error restarting running game timers:', error);
    }
  }
}
