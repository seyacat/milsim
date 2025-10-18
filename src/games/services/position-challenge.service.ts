import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamesService } from '../games.service';
import { GamesGateway } from '../games.gateway';
import { TimerCalculationService } from './timer-calculation.service';
import { TimerManagementService } from './timer-management.service';
import { ControlPoint } from '../entities/control-point.entity';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';

interface PlayerPosition {
  userId: number;
  lat: number;
  lng: number;
  accuracy: number;
  socketId: string;
}

interface PositionChallengeResult {
  controlPointId: number;
  controlPointName: string;
  players: Array<{
    userId: number;
    userName: string;
    team: string;
    points: number;
  }>;
  totalPoints: number;
}

interface ControlPointAccumulatedPoints {
  controlPointId: number;
  controlPointName: string;
  teamPoints: Map<string, number>;
  lastControlChange: Date | null;
}

@Injectable()
export class PositionChallengeService {
  // Removed internal playerPositions map - now using Gateway's positions directly

  constructor(
    @InjectRepository(ControlPoint)
    private controlPointsRepository: Repository<ControlPoint>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    @Inject(forwardRef(() => GamesService))
    private gamesService: GamesService,
    @Inject(forwardRef(() => GamesGateway))
    private gamesGateway: GamesGateway,
    private timerCalculationService: TimerCalculationService,
    private timerManagementService: TimerManagementService,
  ) {}

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // Convert to meters
    return distance;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Check if a player is within a control point's position challenge radius
   */
  isPlayerInControlPointRadius(
    playerPosition: PlayerPosition,
    controlPoint: ControlPoint,
  ): boolean {
    if (!controlPoint.hasPositionChallenge || !controlPoint.minDistance) {
      return false;
    }

    const distance = this.calculateDistance(
      playerPosition.lat,
      playerPosition.lng,
      controlPoint.latitude,
      controlPoint.longitude,
    );

    return distance <= controlPoint.minDistance;
  }

  /**
   * Check if a player meets the accuracy requirement for position challenge
   */
  isPlayerAccuracyValid(playerPosition: PlayerPosition, controlPoint: ControlPoint): boolean {
    if (!controlPoint.hasPositionChallenge || !controlPoint.minAccuracy) {
      return false;
    }

    return playerPosition.accuracy <= controlPoint.minAccuracy;
  }

  /**
   * Get all players within a control point's radius meeting accuracy requirements
   */
  async getPlayersInControlPoint(
    controlPoint: ControlPoint,
    playerPositions: Map<number, PlayerPosition>,
  ): Promise<Array<{ player: Player; position: PlayerPosition }>> {
    const playersInControlPoint: Array<{ player: Player; position: PlayerPosition }> = [];

    // Get all players in the game instance
    const game = await this.gamesRepository.findOne({
      where: { id: controlPoint.gameId },
    });
    if (!game || !game.instanceId) {
      return [];
    }

    const players = await this.playersRepository.find({
      where: { gameInstance: { id: game.instanceId } },
      relations: ['user', 'gameInstance'],
    });

    for (const player of players) {
      const position = playerPositions.get(player.user.id);
      if (!position) {
        continue;
      }

      // Check if player is within radius and meets accuracy requirements
      const isInRadius = this.isPlayerInControlPointRadius(position, controlPoint);
      const hasValidAccuracy = this.isPlayerAccuracyValid(position, controlPoint);

      const distance = this.calculateDistance(
        position.lat,
        position.lng,
        controlPoint.latitude,
        controlPoint.longitude,
      );

      if (isInRadius && hasValidAccuracy) {
        playersInControlPoint.push({ player, position });
      }
    }

    return playersInControlPoint;
  }

  /**
   * Calculate points for players in a control point
   */
  calculatePointsForControlPoint(
    controlPoint: ControlPoint,
    playersInControlPoint: Array<{ player: Player; position: PlayerPosition }>,
  ): PositionChallengeResult {
    const result: PositionChallengeResult = {
      controlPointId: controlPoint.id,
      controlPointName: controlPoint.name,
      players: [],
      totalPoints: 0,
    };

    if (playersInControlPoint.length === 0) {
      return result;
    }

    // Calculate points: 20 points divided by number of players in the CP
    const pointsPerPlayer = 20 / playersInControlPoint.length;

    // Group players by team and assign points
    const teamPoints = new Map<string, number>();

    for (const { player } of playersInControlPoint) {
      if (player.team && player.team !== 'none') {
        const currentPoints = teamPoints.get(player.team) || 0;
        teamPoints.set(player.team, currentPoints + pointsPerPlayer);

        result.players.push({
          userId: player.user.id,
          userName: player.user.name,
          team: player.team,
          points: pointsPerPlayer,
        });
      }
    }

    // Calculate total points (sum of all team points)
    result.totalPoints = Array.from(teamPoints.values()).reduce((sum, points) => sum + points, 0);

    return result;
  }

  /**
   * Process position challenge for all control points in a game
   */
  async processPositionChallenge(
    gameId: number,
    playerPositions: Map<number, PlayerPosition>,
  ): Promise<{
    results: PositionChallengeResult[];
    teamPointsByControlPoint: Map<number, Record<string, number>>;
  }> {
    const results: PositionChallengeResult[] = [];
    const teamPointsByControlPoint = new Map<number, Record<string, number>>();

    // Get all control points for the game
    const controlPoints = await this.controlPointsRepository.find({
      where: { game: { id: gameId }, hasPositionChallenge: true },
      relations: ['game'],
    });

    for (const controlPoint of controlPoints) {
      const playersInControlPoint = await this.getPlayersInControlPoint(
        controlPoint,
        playerPositions,
      );

      if (playersInControlPoint.length > 0) {
        const result = this.calculatePointsForControlPoint(controlPoint, playersInControlPoint);
        results.push(result);

        // Extract team points for broadcasting
        const teamPoints: Record<string, number> = {};
        for (const player of result.players) {
          teamPoints[player.team] = (teamPoints[player.team] || 0) + player.points;
        }
        teamPointsByControlPoint.set(controlPoint.id, teamPoints);
      } else {
        console.log(`[POSITION_CHALLENGE] Control point ${controlPoint.name} has no valid players`);
      }
    }

    return { results, teamPointsByControlPoint };
  }

  /**
   * Get current player positions from Gateway for position challenge calculations
   */
  private getCurrentPlayerPositionsFromGateway(gameId: number): Map<number, PlayerPosition> {
    const gatewayPositions = this.gamesGateway.getCurrentPlayerPositions();
    const playerPositions = new Map<number, PlayerPosition>();

    // Convert Gateway positions to the format expected by Position Challenge Service
    gatewayPositions.forEach((position, userId) => {
      playerPositions.set(userId, {
        userId,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        socketId: position.socketId,
      });
    });

    return playerPositions;
  }

  /**
   * Process position challenge for a game
   * This should be called periodically (e.g., every 20 seconds) by the timer management service
   */
  async processPositionChallengeForGame(gameId: number): Promise<void> {
    try {
      // Get current player positions from the Gateway instead of internal map
      const currentPlayerPositions = this.getCurrentPlayerPositionsFromGateway(gameId);

      if (currentPlayerPositions.size === 0) {
        return;
      }

      const { results, teamPointsByControlPoint } =
        await this.processPositionChallengeWithAccumulation(gameId, currentPlayerPositions);

      // Create events for Timer Calculation Service
      for (const result of results) {
        if (result.players.length > 0) {
          await this.createPositionChallengeEvent(gameId, result);
        }
      }

      // Broadcast position challenge updates to frontend
      for (const [controlPointId, teamPoints] of teamPointsByControlPoint.entries()) {
        this.gamesGateway.broadcastPositionChallengeUpdate(gameId, controlPointId, teamPoints);
      }
    } catch (error) {
      console.error(
        `[POSITION_CHALLENGE] Error processing position challenge for game ${gameId}:`,
        error,
      );
    }
  }

  /**
   * Create position challenge event for Timer Calculation Service
   */
  private async createPositionChallengeEvent(
    gameId: number,
    result: PositionChallengeResult,
  ): Promise<void> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
    });

    if (!game || !game.instanceId) {
      return;
    }

    await this.timerCalculationService.addGameHistory(
      game.instanceId,
      'position_challenge_scored',
      {
        controlPointId: result.controlPointId,
        controlPointName: result.controlPointName,
        players: result.players,
        totalPoints: result.totalPoints,
        timestamp: new Date(),
      },
    );
  }

  /**
   * Get position challenge statistics for game results
   */
  async getPositionChallengeStats(gameInstanceId: number): Promise<{
    controlPoints: Array<{
      id: number;
      name: string;
      teamPoints: { [team: string]: number };
    }>;
    teamTotals: { [team: string]: number };
  }> {
    const history = await this.timerCalculationService.getGameHistoryWithCache(gameInstanceId);

    const positionChallengeEvents = history.filter(
      event => event.eventType === 'position_challenge_scored' && event.data,
    );

    const controlPointStats = new Map<number, { name: string; teamPoints: Map<string, number> }>();
    const teamTotals = new Map<string, number>();

    for (const event of positionChallengeEvents) {
      const { controlPointId, controlPointName, players } = event.data;

      if (!controlPointStats.has(controlPointId)) {
        controlPointStats.set(controlPointId, {
          name: controlPointName,
          teamPoints: new Map<string, number>(),
        });
      }

      const cpStats = controlPointStats.get(controlPointId)!;

      for (const player of players) {
        const currentPoints = cpStats.teamPoints.get(player.team) || 0;
        cpStats.teamPoints.set(player.team, currentPoints + player.points);

        const currentTeamTotal = teamTotals.get(player.team) || 0;
        teamTotals.set(player.team, currentTeamTotal + player.points);
      }
    }

    return {
      controlPoints: Array.from(controlPointStats.entries()).map(([id, stats]) => ({
        id,
        name: stats.name,
        teamPoints: Object.fromEntries(stats.teamPoints),
      })),
      teamTotals: Object.fromEntries(teamTotals),
    };
  }

  /**
   * Get current position challenge data for a game
   * This is used when a user joins or refreshes the page
   */
  async getCurrentPositionChallengeData(
    gameId: number,
  ): Promise<Map<number, Record<string, number>>> {
    const teamPointsByControlPoint = new Map<number, Record<string, number>>();

    try {
      // Get all control points with position challenge enabled for this game
      const controlPoints = await this.controlPointsRepository.find({
        where: { game: { id: gameId }, hasPositionChallenge: true },
        relations: ['game'],
      });

      // Get game instance for point calculation
      const game = await this.gamesRepository.findOne({ where: { id: gameId } });
      if (!game || !game.instanceId) {
        return teamPointsByControlPoint;
      }

      // Calculate team points since last reset for each control point (same calculation as control logic)
      for (const controlPoint of controlPoints) {
        const teamPointsSinceReset = await this.calculateTeamPointsSinceReset(
          game.instanceId,
          controlPoint.id,
        );

        // If there are no position_challenge_scored events but the control point is owned by a team,
        // broadcast 60 points for that team to show the pie chart correctly
        if (Object.keys(teamPointsSinceReset).length === 0 && controlPoint.ownedByTeam) {
          teamPointsSinceReset[controlPoint.ownedByTeam] = 60;
        }

        teamPointsByControlPoint.set(controlPoint.id, teamPointsSinceReset);
      }

      return teamPointsByControlPoint;
    } catch (error) {
      console.error(
        `[POSITION_CHALLENGE] Error getting current position challenge data for game ${gameId}:`,
        error,
      );
      return teamPointsByControlPoint;
    }
  }

  /**
   * Calculate accumulated points from Timer Calculation Service history
   */
  private async calculateAccumulatedPoints(
    gameId: number,
    controlPointId: number,
  ): Promise<ControlPointAccumulatedPoints> {
    try {
      // Get game to access history
      const game = await this.gamesRepository.findOne({
        where: { id: gameId },
      });

      if (!game || !game.instanceId) {
        return {
          controlPointId,
          controlPointName: `Control Point ${controlPointId}`,
          teamPoints: new Map<string, number>(),
          lastControlChange: null,
        };
      }

      // Get control point info
      const controlPoint = await this.controlPointsRepository.findOne({
        where: { id: controlPointId },
        relations: ['game'],
      });

      // Get position challenge events from Timer Calculation Service
      const history = await this.timerCalculationService.getGameHistoryWithCache(game.instanceId);
      const positionChallengeEvents = history.filter(
        event => event.eventType === 'position_challenge_scored' && event.data,
      );

      // Filter events for this control point
      const relevantEvents = positionChallengeEvents.filter(event => {
        const eventData = event.data;
        return eventData.controlPointId === controlPointId;
      });

      // Calculate accumulated points from all events
      const teamPoints = new Map<string, number>();
      for (const event of relevantEvents) {
        const { players } = event.data;

        for (const player of players) {
          const currentPoints = teamPoints.get(player.team) || 0;
          teamPoints.set(player.team, currentPoints + player.points);
        }
      }

      return {
        controlPointId,
        controlPointName: controlPoint?.name || `Control Point ${controlPointId}`,
        teamPoints,
        lastControlChange: null, // Control changes are now handled by the timer-calculation service
      };
    } catch (error) {
      console.error(
        `[POSITION_CHALLENGE] Error calculating accumulated points for control point ${controlPointId}:`,
        error,
      );
      return {
        controlPointId,
        controlPointName: `Control Point ${controlPointId}`,
        teamPoints: new Map<string, number>(),
        lastControlChange: null,
      };
    }
  }

  /**
   * Check if a team should take control based on points since last reset
   * New algorithm: Count points from most recent position_challenge_scored event backwards
   * until we find a control_point_taken or game_started event
   */
  private async checkControlPointControl(
    gameId: number,
    controlPointId: number,
    accumulatedPoints: ControlPointAccumulatedPoints,
  ): Promise<string | null> {
    const THRESHOLD = 60; // Points threshold to take control

    try {
      // Get game to access history
      const game = await this.gamesRepository.findOne({
        where: { id: gameId },
      });

      if (!game || !game.instanceId) {
        return null;
      }

      // Get game history
      const history = await this.timerCalculationService.getGameHistoryWithCache(game.instanceId);

      // Find all position_challenge_scored events for this control point, sorted by newest first
      const positionChallengeEvents = history
        .filter(
          event =>
            event.eventType === 'position_challenge_scored' &&
            event.data &&
            event.data.controlPointId === controlPointId,
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

      // Find the most recent control_point_taken event for this control point
      const controlTakenEvents = history
        .filter(
          event =>
            event.eventType === 'control_point_taken' &&
            event.data &&
            event.data.controlPointId === controlPointId,
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

      // Find game start event
      const gameStartEvents = history.filter(event => event.eventType === 'game_started');

      // Determine the reset timestamp - use the most recent control change or game start
      let resetTimestamp: Date | null = null;

      if (controlTakenEvents.length > 0) {
        // Use the most recent control_point_taken event (when control last changed)
        resetTimestamp = controlTakenEvents[0].timestamp;
      } else if (gameStartEvents.length > 0) {
        // Use game start event
        resetTimestamp = gameStartEvents[0].timestamp;
      } else {
        return null;
      }

      // Get current control point to check current ownership
      const currentControlPoint = await this.controlPointsRepository.findOne({
        where: { id: controlPointId },
        relations: ['game'],
      });

      // Count points from most recent event backwards until we reach reset timestamp
      const teamPointsTracker = new Map<string, number>();
      let winningTeam: string | null = null;

      // Process events from newest to oldest, stopping when we reach reset timestamp
      for (const event of positionChallengeEvents) {
        // Stop if we reach the reset timestamp
        if (event.timestamp < resetTimestamp) {
          break;
        }

        // Add points from this event to each team
        for (const player of event.data.players) {
          const currentPoints = teamPointsTracker.get(player.team) || 0;
          const newPoints = currentPoints + player.points;

          // Always add points to track progress
          teamPointsTracker.set(player.team, newPoints);

          // Check if this team just reached 60 points
          if (newPoints >= THRESHOLD && currentPoints < THRESHOLD && !winningTeam) {
            winningTeam = player.team;
          }
        }

        // Stop counting if a team reached 60 points
        if (winningTeam) {
          break;
        }
      }

      // Check if we have a team that reached 60 points
      if (winningTeam) {
        // Check if the team that reached 60 points already owns the control point
        if (currentControlPoint && currentControlPoint.ownedByTeam === winningTeam) {
          // Update control point timer to ensure it's running and broadcasting
          if (currentControlPoint.game?.instanceId) {
            await this.timerManagementService.updateControlPointTimer(
              controlPointId,
              currentControlPoint.game.instanceId,
              true, // fromPositionChallenge: true
            );
          }

          // Still broadcast the points update to show the pie chart with 60 points
          const teamPointsSinceReset = await this.calculateTeamPointsSinceReset(
            game.instanceId,
            controlPointId,
          );
          this.gamesGateway.broadcastPositionChallengeUpdate(
            gameId,
            controlPointId,
            teamPointsSinceReset,
          );

          return winningTeam;
        }

        // Update control point ownership
        const updateResult = await this.controlPointsRepository.update(controlPointId, {
          ownedByTeam: winningTeam,
        });

        // Get the updated control point with game relation
        const updatedControlPoint = await this.controlPointsRepository.findOne({
          where: { id: controlPointId },
          relations: ['game'],
        });

        if (updatedControlPoint) {
          // Update control point timer with new ownership for position challenge
          if (updatedControlPoint.game?.instanceId) {
            await this.timerManagementService.updateControlPointTimer(
              controlPointId,
              updatedControlPoint.game.instanceId,
              true, // fromPositionChallenge: true
            );
          }

          // Remove sensitive code data before broadcasting to all clients
          const { code, armedCode, disarmedCode, ...safeControlPoint } = updatedControlPoint;

          // Broadcast control point taken event to refresh UI and show toast
          this.gamesGateway.server.to(`game_${gameId}`).emit('gameAction', {
            action: 'controlPointTaken',
            data: {
              controlPointId,
              team: winningTeam,
              controlPoint: safeControlPoint,
              positionChallenge: true, // Mark as position challenge control change
            },
            from: 'system',
          });

          // Also broadcast a controlPointUpdated event to ensure the control point markers are refreshed
          // This ensures the marker colors update immediately
          this.gamesGateway.server.to(`game_${gameId}`).emit('gameAction', {
            action: 'controlPointUpdated',
            data: safeControlPoint,
            from: 'system',
          });
        }

        // Create control change event using control_point_taken (same as code challenge)
        // Get the most recent position_challenge_scored event to get the players involved
        const history = await this.timerCalculationService.getGameHistoryWithCache(game.instanceId);
        const recentPositionEvents = history
          .filter(
            event =>
              event.eventType === 'position_challenge_scored' &&
              event.data &&
              event.data.controlPointId === controlPointId,
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

        let playerIdsInvolved = [];
        if (recentPositionEvents.length > 0) {
          // Get only user IDs from players of the same team that captured the point
          const recentPlayers = recentPositionEvents[0].data.players || [];
          playerIdsInvolved = recentPlayers
            .filter(player => player.team === winningTeam)
            .map(player => player.userId);
        }

        const historyEvent = await this.timerCalculationService.addGameHistory(
          game.instanceId,
          'control_point_taken',
          {
            controlPointId,
            controlPointName: accumulatedPoints.controlPointName,
            team: winningTeam,
            points: THRESHOLD,
            timestamp: new Date(),
            positionChallenge: true, // Mark as position challenge control change
            playerIds: playerIdsInvolved, // Include only user IDs of players from the same team
          },
        );

        return winningTeam;
      } else {
        const currentMaxPoints = Math.max(...Array.from(teamPointsTracker.values()), 0);
        // No team has reached threshold yet, continue tracking points
      }

      return null;
    } catch (error) {
      console.error(
        `[POSITION_CHALLENGE] Error checking control point control for ${controlPointId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Calculate team points since last reset for pie chart display
   * New algorithm: Count points from most recent event backwards until reset
   * Stop counting when a team reaches 60 points
   * If no events to count, return 60 points for current owner
   */
  private async calculateTeamPointsSinceReset(
    gameInstanceId: number,
    controlPointId: number,
  ): Promise<Record<string, number>> {
    try {
      const history = await this.timerCalculationService.getGameHistoryWithCache(gameInstanceId);

      // Find the most recent control_point_taken event for this control point
      const controlTakenEvents = history
        .filter(
          event =>
            event.eventType === 'control_point_taken' &&
            event.data &&
            event.data.controlPointId === controlPointId,
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

      // Find game start event
      const gameStartEvents = history.filter(event => event.eventType === 'game_started');

      // Determine the reset timestamp
      let resetTimestamp: Date | null = null;

      if (controlTakenEvents.length > 0) {
        // Use the most recent control_point_taken event
        resetTimestamp = controlTakenEvents[0].timestamp;
      } else if (gameStartEvents.length > 0) {
        // Use game start event
        resetTimestamp = gameStartEvents[0].timestamp;
      } else {
        // No reset events found, check if control point has an owner
        const controlPoint = await this.controlPointsRepository.findOne({
          where: { id: controlPointId },
        });

        // If control point has an owner, return 60 points for that team
        if (controlPoint && controlPoint.ownedByTeam) {
          return { [controlPoint.ownedByTeam]: 60 };
        }

        return {};
      }

      // Get position challenge events for this control point, sorted by newest first
      const positionChallengeEvents = history
        .filter(
          event =>
            event.eventType === 'position_challenge_scored' &&
            event.data &&
            event.data.controlPointId === controlPointId,
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

      // Track points for each team, but stop counting when a team reaches 60
      const teamPointsSinceReset = new Map<string, number>();
      let winningTeam: string | null = null;

      // Process events from newest to oldest, stopping when we reach reset timestamp
      for (const event of positionChallengeEvents) {
        // Stop if we reach the reset timestamp
        if (event.timestamp < resetTimestamp) {
          break;
        }

        // Stop counting if a team already reached 60 points
        if (winningTeam) {
          break;
        }

        // Add points from this event to each team
        for (const player of event.data.players) {
          const currentPoints = teamPointsSinceReset.get(player.team) || 0;
          const newPoints = currentPoints + player.points;

          // Always add points to track progress
          teamPointsSinceReset.set(player.team, newPoints);

          // Check if this team just reached 60 points
          if (newPoints >= 60 && currentPoints < 60 && !winningTeam) {
            winningTeam = player.team;
          }
        }
      }

      // If no events were processed but control point has an owner, return 60 points for that team
      if (teamPointsSinceReset.size === 0) {
        const controlPoint = await this.controlPointsRepository.findOne({
          where: { id: controlPointId },
        });

        if (controlPoint && controlPoint.ownedByTeam) {
          return { [controlPoint.ownedByTeam]: 60 };
        }
      }

      return Object.fromEntries(teamPointsSinceReset);
    } catch (error) {
      console.error(
        `[POSITION_CHALLENGE] Error calculating team points since reset for control point ${controlPointId}:`,
        error,
      );

      // Fallback: check if control point has an owner and return 60 points
      try {
        const controlPoint = await this.controlPointsRepository.findOne({
          where: { id: controlPointId },
        });

        if (controlPoint && controlPoint.ownedByTeam) {
          console.error(
            `[POSITION_CHALLENGE] Error occurred, but control point ${controlPointId} is owned by team ${controlPoint.ownedByTeam}. Returning 60 points.`,
          );
          return { [controlPoint.ownedByTeam]: 60 };
        }
      } catch (fallbackError) {
        console.error(
          `[POSITION_CHALLENGE] Error in fallback logic for control point ${controlPointId}:`,
          fallbackError,
        );
      }

      return {};
    }
  }

  /**
   * Process position challenge with accumulated points logic
   */
  async processPositionChallengeWithAccumulation(
    gameId: number,
    playerPositions: Map<number, PlayerPosition>,
  ): Promise<{
    results: PositionChallengeResult[];
    teamPointsByControlPoint: Map<number, Record<string, number>>;
  }> {
    const results: PositionChallengeResult[] = [];
    const teamPointsByControlPoint = new Map<number, Record<string, number>>();

    // Get all control points for the game
    const controlPoints = await this.controlPointsRepository.find({
      where: { game: { id: gameId }, hasPositionChallenge: true },
      relations: ['game'],
    });

    for (const controlPoint of controlPoints) {
      const playersInControlPoint = await this.getPlayersInControlPoint(
        controlPoint,
        playerPositions,
      );

      if (playersInControlPoint.length > 0) {
        const result = this.calculatePointsForControlPoint(controlPoint, playersInControlPoint);
        results.push(result);

        // Create event for Timer Calculation Service
        await this.createPositionChallengeEvent(gameId, result);

        // Calculate accumulated points
        const accumulatedPoints = await this.calculateAccumulatedPoints(gameId, controlPoint.id);

        // Check if a team should take control
        const controllingTeam = await this.checkControlPointControl(
          gameId,
          controlPoint.id,
          accumulatedPoints,
        );

        // Get game instance for point calculation
        const game = await this.gamesRepository.findOne({ where: { id: gameId } });
        if (game && game.instanceId) {
          // Calculate team points since last reset for pie chart (same calculation as control logic)
          const teamPointsSinceReset = await this.calculateTeamPointsSinceReset(
            game.instanceId,
            controlPoint.id,
          );
          teamPointsByControlPoint.set(controlPoint.id, teamPointsSinceReset);
        } else {
          // Fallback to accumulated points if no instance
          const teamPoints: Record<string, number> = Object.fromEntries(
            accumulatedPoints.teamPoints,
          );
          teamPointsByControlPoint.set(controlPoint.id, teamPoints);
        }
      } else {
        // Get game instance for point calculation
        const game = await this.gamesRepository.findOne({ where: { id: gameId } });
        if (game && game.instanceId) {
          // Calculate team points since last reset for pie chart (same calculation as control logic)
          const teamPointsSinceReset = await this.calculateTeamPointsSinceReset(
            game.instanceId,
            controlPoint.id,
          );
          teamPointsByControlPoint.set(controlPoint.id, teamPointsSinceReset);
        } else {
          // Fallback to accumulated points if no instance
          const accumulatedPoints = await this.calculateAccumulatedPoints(gameId, controlPoint.id);
          const teamPoints: Record<string, number> = Object.fromEntries(
            accumulatedPoints.teamPoints,
          );
          teamPointsByControlPoint.set(controlPoint.id, teamPoints);
        }
      }
    }

    return { results, teamPointsByControlPoint };
  }
}
