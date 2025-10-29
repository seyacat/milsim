import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameHistory } from '../entities/game-history.entity';
import { Game } from '../entities/game.entity';
import { GameInstance } from '../entities/game-instance.entity';
import { ControlPoint } from '../entities/control-point.entity';

export interface GameTimeData {
  remainingTime: number | null;
  totalTime: number | null;
  playedTime: number;
  isRunning: boolean;
}

export interface ControlPointTimeData {
  currentHoldTime: number;
  currentTeam: string | null;
  displayTime: string;
}

export interface BombTimeData {
  remainingTime: number;
  totalTime: number;
  isActive: boolean;
  activatedByUserId?: number;
  activatedByUserName?: string;
  activatedByTeam?: string;
}

export interface TimeEvent {
  type: 'game_started' | 'game_paused' | 'game_resumed' | 'game_paused_automatically';
  timestamp: Date;
}

@Injectable()
export class TimerCalculationService {
  private gameHistoryCache = new Map<number, GameHistory[]>(); // gameInstanceId -> history events

  constructor(
    @InjectRepository(GameHistory)
    private gameHistoryRepository: Repository<GameHistory>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(GameInstance)
    private gameInstancesRepository: Repository<GameInstance>,
    @InjectRepository(ControlPoint)
    private controlPointsRepository: Repository<ControlPoint>,
  ) {}

  /**
   * Add game history event
   */
  async addGameHistory(
    gameInstanceId: number,
    eventType: string,
    data?: any,
  ): Promise<GameHistory> {
    const gameHistory = this.gameHistoryRepository.create({
      eventType,
      data,
      gameInstance: { id: gameInstanceId },
    });

    const savedHistory = await this.gameHistoryRepository.save(gameHistory);

    // Update cache
    this.updateCache(gameInstanceId, savedHistory);

    return savedHistory;
  }

  /**
   * Update cache with new history event
   */
  private updateCache(gameInstanceId: number, newHistory: GameHistory): void {
    const cachedHistory = this.gameHistoryCache.get(gameInstanceId) || [];
    cachedHistory.push(newHistory);
    this.gameHistoryCache.set(gameInstanceId, cachedHistory);
  }

  /**
   * Clear cache for a game instance
   */
  clearCache(gameInstanceId: number): void {
    this.gameHistoryCache.delete(gameInstanceId);
  }

  /**
   * Calculate elapsed time from game history events
   */
  async calculateElapsedTimeFromEvents(gameInstanceId: number): Promise<number> {
    const history = await this.getGameHistoryWithCache(gameInstanceId);

    const timeEvents = history.filter(record =>
      ['game_started', 'game_paused', 'game_resumed', 'game_paused_automatically'].includes(record.eventType),
    );

    if (timeEvents.length === 0) return 0;

    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });
    const isCurrentlyRunning = game && game.status === 'running';

    let totalElapsedTime = 0;
    let currentGameState: 'running' | 'paused' = 'paused';
    let lastEventTime: Date | null = null;

    for (let i = 0; i < timeEvents.length; i++) {
      const event = timeEvents[i];

      if (event.eventType === 'game_started' || event.eventType === 'game_resumed') {
        currentGameState = 'running';
        lastEventTime = event.timestamp;
      } else if (event.eventType === 'game_paused' || event.eventType === 'game_paused_automatically') {
        if (currentGameState === 'running' && lastEventTime) {
          const segmentTime = Math.floor(
            (event.timestamp.getTime() - lastEventTime.getTime()) / 1000,
          );
          totalElapsedTime += segmentTime;
        }
        currentGameState = 'paused';
        lastEventTime = event.timestamp;
      }

      if (
        i === timeEvents.length - 1 &&
        isCurrentlyRunning &&
        currentGameState === 'running' &&
        lastEventTime
      ) {
        const currentSegmentTime = Math.floor((Date.now() - lastEventTime.getTime()) / 1000);
        totalElapsedTime += currentSegmentTime;
      }
    }

    

    return totalElapsedTime;
  }

  /**
   * Get time events from game history
   */
  async getTimeEventsFromHistory(gameInstanceId: number): Promise<TimeEvent[]> {
    const history = await this.getGameHistoryWithCache(gameInstanceId);

    const filteredHistory = history.filter(record =>
      ['game_started', 'game_paused', 'game_resumed', 'game_paused_automatically'].includes(record.eventType),
    );

    return filteredHistory.map(record => ({
      type: record.eventType as 'game_started' | 'game_paused' | 'game_resumed' | 'game_paused_automatically',
      timestamp: record.timestamp,
    }));
  }

  /**
   * Calculate accumulated hold time for a control point
   */
  async calculateAccumulatedHoldTime(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<number> {
    const history = await this.getGameHistoryWithCache(gameInstanceId);

    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });
    const isCurrentlyRunning = game && game.status === 'running';

    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
    });
    const currentOwnerTeam = controlPoint?.ownedByTeam || null;

    const timeline = [
      ...history
        .filter(event => event.eventType === 'control_point_taken' && event.data)
        .map(event => ({
          type: 'capture' as const,
          timestamp: event.timestamp,
          controlPointId: event.data.controlPointId,
          team: event.data.team,
        })),
      ...history
        .filter(event =>
          ['game_started', 'game_paused', 'game_resumed', 'game_ended', 'game_paused_automatically'].includes(event.eventType),
        )
        .map(event => ({
          type: 'game_state' as const,
          timestamp: event.timestamp,
          state: event.eventType as 'game_started' | 'game_paused' | 'game_resumed' | 'game_ended' | 'game_paused_automatically',
        })),
    ];

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let totalHoldTime = 0;
    let currentTeam: string | null = null;
    let gameState: 'running' | 'paused' | 'ended' = 'paused';
    let currentHoldStart: Date | null = null;

    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i];

      if (event.type === 'game_state') {
        if (event.state === 'game_started' || event.state === 'game_resumed') {
          gameState = 'running';
          if (currentTeam && currentTeam === currentOwnerTeam) {
            currentHoldStart = event.timestamp;
          }
        } else if (event.state === 'game_paused' || event.state === 'game_ended' || event.state === 'game_paused_automatically') {
          if (currentHoldStart && currentTeam === currentOwnerTeam) {
            const intervalTime = Math.floor(
              (event.timestamp.getTime() - currentHoldStart.getTime()) / 1000,
            );
            totalHoldTime += intervalTime;
          }
          gameState = event.state === 'game_paused' ? 'paused' : 'ended';
          currentHoldStart = null;
        }
      } else if (event.type === 'capture' && event.controlPointId === controlPointId) {
        if (currentHoldStart && currentTeam === currentOwnerTeam) {
          const intervalTime = Math.floor(
            (event.timestamp.getTime() - currentHoldStart.getTime()) / 1000,
          );
          totalHoldTime += intervalTime;
        }

        currentTeam = event.team;
        currentHoldStart =
          gameState === 'running' && currentTeam === currentOwnerTeam ? event.timestamp : null;
      }
    }

    if (isCurrentlyRunning && currentHoldStart && currentTeam === currentOwnerTeam) {
      const currentIntervalTime = Math.floor((Date.now() - currentHoldStart.getTime()) / 1000);
      totalHoldTime += currentIntervalTime;
    }

    return totalHoldTime;
  }

  /**
   * Calculate hold time for a specific team on a control point
   */
  async calculateTeamHoldTime(
    controlPointId: number,
    gameInstanceId: number,
    team: string,
  ): Promise<number> {
    const history = await this.getGameHistoryWithCache(gameInstanceId);

    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });
    const isCurrentlyRunning = game && game.status === 'running';

    // Get the control point to check current ownership
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
    });
    const currentOwnerTeam = controlPoint?.ownedByTeam || null;

    const timeline = [
      ...history
        .filter(event => event.eventType === 'control_point_taken' && event.data)
        .map(event => ({
          type: 'capture' as const,
          timestamp: event.timestamp,
          controlPointId: event.data.controlPointId,
          team: event.data.team,
          initialState: event.data.initialState || false,
        })),
      ...history
        .filter(event =>
          ['game_started', 'game_paused', 'game_resumed', 'game_ended', 'game_paused_automatically'].includes(event.eventType),
        )
        .map(event => ({
          type: 'game_state' as const,
          timestamp: event.timestamp,
          state: event.eventType as 'game_started' | 'game_paused' | 'game_resumed' | 'game_ended' | 'game_paused_automatically',
        })),
    ];

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let totalHoldTime = 0;
    let currentTeam: string | null = null;
    let gameState: 'running' | 'paused' | 'ended' = 'paused';
    let currentHoldStart: Date | null = null;
    let gameStartTime: Date | null = null;

    // Find the game start time
    const gameStartEvent = timeline.find(event => event.type === 'game_state' && event.state === 'game_started');
    if (gameStartEvent) {
      gameStartTime = gameStartEvent.timestamp;
    }

    // Check if there are any initial state assignments for this control point
    const initialAssignments = timeline.filter(
      event =>
        event.type === 'capture' &&
        event.controlPointId === controlPointId &&
        event.initialState === true
    );

    // If there are initial assignments and the team matches, add time from game start to first capture
    if (initialAssignments.length > 0 && gameStartTime) {
      const firstInitialAssignment = initialAssignments[0];
      if (firstInitialAssignment.type === 'capture' && firstInitialAssignment.team === team) {
        // Add time from game start to first capture event
        const initialTime = Math.floor(
          (firstInitialAssignment.timestamp.getTime() - gameStartTime.getTime()) / 1000
        );
        totalHoldTime += initialTime;
      }
    }

    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i];

      if (event.type === 'game_state') {
        if (event.state === 'game_started' || event.state === 'game_resumed') {
          gameState = 'running';
          if (currentTeam && currentTeam === team) {
            currentHoldStart = event.timestamp;
          }
        } else if (event.state === 'game_paused' || event.state === 'game_ended' || event.state === 'game_paused_automatically') {
          if (currentHoldStart && currentTeam === team) {
            const intervalTime = Math.floor(
              (event.timestamp.getTime() - currentHoldStart.getTime()) / 1000,
            );
            totalHoldTime += intervalTime;
          }
          gameState = event.state === 'game_paused' ? 'paused' : 'ended';
          currentHoldStart = null;
        }
      } else if (event.type === 'capture' && event.controlPointId === controlPointId) {
        if (currentHoldStart && currentTeam === team) {
          const intervalTime = Math.floor(
            (event.timestamp.getTime() - currentHoldStart.getTime()) / 1000,
          );
          totalHoldTime += intervalTime;
        }

        currentTeam = event.team;
        currentHoldStart = gameState === 'running' && currentTeam === team ? event.timestamp : null;
      }
    }

    if (isCurrentlyRunning && currentHoldStart && currentTeam === team) {
      const currentIntervalTime = Math.floor((Date.now() - currentHoldStart.getTime()) / 1000);
      totalHoldTime += currentIntervalTime;
    }

    return totalHoldTime;
  }

  /**
   * Calculate remaining bomb time from game history events
   */
  async calculateRemainingBombTime(
    controlPointId: number,
    gameInstanceId: number,
  ): Promise<BombTimeData | null> {
    const history = await this.getGameHistoryWithCache(gameInstanceId);

    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
    });
    const isCurrentlyRunning = game && game.status === 'running';

    const timeline = [
      ...history
        .filter(
          event =>
            ['bomb_activated', 'bomb_deactivated', 'bomb_exploded'].includes(event.eventType) &&
            event.data &&
            event.data.controlPointId === controlPointId,
        )
        .map(event => ({
          type: event.eventType as 'bomb_activated' | 'bomb_deactivated' | 'bomb_exploded',
          timestamp: event.timestamp,
          data: event.data,
        })),
      ...history
        .filter(event =>
          ['game_started', 'game_paused', 'game_resumed', 'game_ended', 'game_paused_automatically'].includes(event.eventType),
        )
        .map(event => ({
          type: 'game_state' as const,
          timestamp: event.timestamp,
          state: event.eventType as 'game_started' | 'game_paused' | 'game_resumed' | 'game_ended' | 'game_paused_automatically',
        })),
    ];

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let bombActive = false;
    let bombStartTime: Date | null = null;
    let totalBombTime = 0;
    let remainingTime = 0;
    let activatedByUserId: number | undefined;
    let activatedByUserName: string | undefined;
    let activatedByTeam: string | undefined;
    let gameState: 'running' | 'paused' | 'ended' = 'paused';
    let currentActiveStart: Date | null = null;

    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i];

      if (event.type === 'game_state') {
        if (event.state === 'game_started' || event.state === 'game_resumed') {
          gameState = 'running';
          if (bombActive && bombStartTime) {
            currentActiveStart = event.timestamp;
          }
        } else if (event.state === 'game_paused' || event.state === 'game_ended' || event.state === 'game_paused_automatically') {
          if (currentActiveStart && bombActive) {
            const intervalTime = Math.floor(
              (event.timestamp.getTime() - currentActiveStart.getTime()) / 1000,
            );
            remainingTime = Math.max(0, remainingTime - intervalTime);
          }
          gameState = event.state === 'game_paused' ? 'paused' : 'ended';
          currentActiveStart = null;
        }
      } else if (event.type === 'bomb_activated') {
        bombActive = true;
        bombStartTime = event.timestamp;
        totalBombTime = event.data.bombTime;
        remainingTime = totalBombTime;
        activatedByUserId = event.data.activatedByUserId;
        activatedByUserName = event.data.activatedByUserName;
        activatedByTeam = event.data.activatedByTeam;
        currentActiveStart = gameState === 'running' ? event.timestamp : null;
      } else if (event.type === 'bomb_deactivated' || event.type === 'bomb_exploded') {
        if (currentActiveStart && bombActive) {
          const intervalTime = Math.floor(
            (event.timestamp.getTime() - currentActiveStart.getTime()) / 1000,
          );
          remainingTime = Math.max(0, remainingTime - intervalTime);
        }
        bombActive = false;
        currentActiveStart = null;
      }
    }

    if (isCurrentlyRunning && currentActiveStart && bombActive) {
      const currentIntervalTime = Math.floor((Date.now() - currentActiveStart.getTime()) / 1000);
      remainingTime = Math.max(0, remainingTime - currentIntervalTime);
    }

    if (!bombActive) return null;

    return {
      remainingTime,
      totalTime: totalBombTime,
      isActive: bombActive,
      activatedByUserId,
      activatedByUserName,
      activatedByTeam,
    };
  }

  /**
   * Format time in mm:ss
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get game history with cache support
   */
  async getGameHistoryWithCache(gameInstanceId: number): Promise<GameHistory[]> {
    // Check cache first
    const cachedHistory = this.gameHistoryCache.get(gameInstanceId);
    if (cachedHistory) {
      return cachedHistory;
    }

    // If not in cache, fetch from database
    const history = await this.gameHistoryRepository.find({
      where: { gameInstance: { id: gameInstanceId } },
      order: { timestamp: 'ASC' },
    });

    // Update cache
    this.gameHistoryCache.set(gameInstanceId, history);

    return history;
  }
}
