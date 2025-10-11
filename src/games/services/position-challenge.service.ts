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
  private playerPositions = new Map<number, Map<number, PlayerPosition>>(); // gameId -> Map<userId, position>

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
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
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

    // Get all players in the game
    const players = await this.playersRepository.find({
      where: { game: { id: controlPoint.gameId } },
      relations: ['user', 'game'],
    });

    console.log(`[POSITION_CHALLENGE] Checking control point ${controlPoint.name} (ID: ${controlPoint.id}) - MinDistance: ${controlPoint.minDistance}m, MinAccuracy: ${controlPoint.minAccuracy}m`);
    console.log(`[POSITION_CHALLENGE] Total players in game: ${players.length}, Total positions available: ${playerPositions.size}`);

    for (const player of players) {
      const position = playerPositions.get(player.user.id);
      if (!position) {
        console.log(`[POSITION_CHALLENGE] Player ${player.user.name} (${player.user.id}) - No position data available`);
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

      console.log(`[POSITION_CHALLENGE] Player ${player.user.name} (${player.user.id}) - Distance: ${distance.toFixed(1)}m, Accuracy: ${position.accuracy}m, InRadius: ${isInRadius}, ValidAccuracy: ${hasValidAccuracy}`);

      if (isInRadius && hasValidAccuracy) {
        console.log(`[POSITION_CHALLENGE] Player ${player.user.name} (${player.user.id}) - VALID for position challenge`);
        playersInControlPoint.push({ player, position });
      }
    }

    console.log(`[POSITION_CHALLENGE] Control point ${controlPoint.name} - Total valid players: ${playersInControlPoint.length}`);
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
      console.log(`[POSITION_CHALLENGE] No players in control point ${controlPoint.name}, returning empty result`);
      return result;
    }

    console.log(`[POSITION_CHALLENGE] Calculating points for control point ${controlPoint.name} (ID: ${controlPoint.id}) with ${playersInControlPoint.length} players`);

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

    console.log(`[POSITION_CHALLENGE] Calculated ${result.totalPoints} total points for control point ${controlPoint.name}`);
    console.log(`[POSITION_CHALLENGE] Team points:`, Object.fromEntries(teamPoints));
    return result;
  }

  /**
   * Process position challenge for all control points in a game
   */
  async processPositionChallenge(gameId: number, playerPositions: Map<number, PlayerPosition>): Promise<{
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

    console.log(`[POSITION_CHALLENGE] Found ${controlPoints.length} control points with position challenge enabled for game ${gameId}`);

    for (const controlPoint of controlPoints) {
      console.log(`[POSITION_CHALLENGE] Processing control point: ${controlPoint.name} (ID: ${controlPoint.id})`);
      const playersInControlPoint = await this.getPlayersInControlPoint(controlPoint, playerPositions);
      
      if (playersInControlPoint.length > 0) {
        console.log(`[POSITION_CHALLENGE] Control point ${controlPoint.name} has ${playersInControlPoint.length} valid players`);
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

    console.log(`[POSITION_CHALLENGE] Completed processing for game ${gameId} - ${results.length} control points with players`);
    return { results, teamPointsByControlPoint };
  }

  /**
   * Update player position for position challenge calculations
   */
  updatePlayerPosition(gameId: number, userId: number, lat: number, lng: number, accuracy: number): void {
    console.log(`[POSITION_CHALLENGE] Updating position for player ${userId} in game ${gameId}: Lat=${lat}, Lng=${lng}, Accuracy=${accuracy}m`);
    
    if (!this.playerPositions.has(gameId)) {
      this.playerPositions.set(gameId, new Map<number, PlayerPosition>());
      console.log(`[POSITION_CHALLENGE] Created new position map for game ${gameId}`);
    }

    const gamePositions = this.playerPositions.get(gameId)!;
    gamePositions.set(userId, {
      userId,
      lat,
      lng,
      accuracy,
      socketId: '', // Not needed for position challenge calculations
    });

    console.log(`[POSITION_CHALLENGE] Position stored for player ${userId}. Total players in game ${gameId}: ${gamePositions.size}`);
  }

  /**
   * Get player positions for a game
   */
  private getPlayerPositionsForGame(gameId: number): Map<number, PlayerPosition> {
    return this.playerPositions.get(gameId) || new Map<number, PlayerPosition>();
  }

  /**
   * Start position challenge processing for a game
   * This should be called when the game starts and player positions are available
   */
  startPositionChallengeProcessing(gameId: number, playerPositions: Map<number, PlayerPosition>): void {
    console.log(`[POSITION_CHALLENGE] Starting position challenge processing for game ${gameId} with ${playerPositions.size} initial player positions`);
    
    // Initialize player positions for this game
    if (!this.playerPositions.has(gameId)) {
      this.playerPositions.set(gameId, new Map<number, PlayerPosition>());
    }

    // Copy initial positions from gateway
    const gamePositions = this.playerPositions.get(gameId)!;
    playerPositions.forEach((position, userId) => {
      gamePositions.set(userId, position);
    });

    console.log(`[POSITION_CHALLENGE] Game ${gameId} now has ${gamePositions.size} player positions stored`);
  }

  /**
   * Stop position challenge processing for a game
   */
  stopPositionChallengeProcessing(gameId: number): void {
    // Clear player positions for this game
    this.playerPositions.delete(gameId);
    console.log(`[POSITION_CHALLENGE] Stopped position challenge processing for game ${gameId}`);
  }

  /**
   * Process position challenge for a game
   * This should be called periodically (e.g., every 20 seconds) by the timer management service
   */
  async processPositionChallengeForGame(gameId: number): Promise<void> {
    try {
      const currentPlayerPositions = this.getPlayerPositionsForGame(gameId);
      console.log(`[POSITION_CHALLENGE] Processing position challenge for game ${gameId} - ${currentPlayerPositions.size} player positions`);
      
      if (currentPlayerPositions.size === 0) {
        console.log(`[POSITION_CHALLENGE] No player positions available for game ${gameId}, skipping processing`);
        return;
      }
      
          const { results, teamPointsByControlPoint } = await this.processPositionChallengeWithAccumulation(gameId, currentPlayerPositions);
          
          console.log(`[POSITION_CHALLENGE] Processing position challenge for game ${gameId} - Found ${results.length} control points with players`);
          
          // Create events for Timer Calculation Service
          console.log(`[POSITION_CHALLENGE] Creating events for ${results.length} control points with players`);
          for (const result of results) {
            if (result.players.length > 0) {
              console.log(`[POSITION_CHALLENGE] Control point ${result.controlPointName} (${result.controlPointId}) - ${result.players.length} players, total points: ${result.totalPoints}`);
              for (const player of result.players) {
                console.log(`[POSITION_CHALLENGE]   Player ${player.userName} (${player.team}): ${player.points.toFixed(1)} points`);
              }
              await this.createPositionChallengeEvent(gameId, result);
            } else {
              console.log(`[POSITION_CHALLENGE] Control point ${result.controlPointName} has no players in result, skipping event creation`);
            }
          }

          // Broadcast position challenge updates to frontend
          console.log(`[POSITION_CHALLENGE] Broadcasting updates for ${teamPointsByControlPoint.size} control points`);
          for (const [controlPointId, teamPoints] of teamPointsByControlPoint.entries()) {
            console.log(`[POSITION_CHALLENGE] Broadcasting update for control point ${controlPointId}:`, teamPoints);
            this.gamesGateway.broadcastPositionChallengeUpdate(gameId, controlPointId, teamPoints);
            console.log(`[POSITION_CHALLENGE] Broadcast sent for control point ${controlPointId}`);
          }
        } catch (error) {
          console.error(`[POSITION_CHALLENGE] Error processing position challenge for game ${gameId}:`, error);
        }
  }

  /**
   * Create position challenge event for Timer Calculation Service
   */
  private async createPositionChallengeEvent(gameId: number, result: PositionChallengeResult): Promise<void> {
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
    });

    if (!game || !game.instanceId) {
      console.log(`[POSITION_CHALLENGE] Cannot create event - Game ${gameId} has no instance ID`);
      return;
    }

    console.log(`[POSITION_CHALLENGE] Creating position challenge event for game instance ${game.instanceId}, control point ${result.controlPointName}`);
    
    await this.timerCalculationService.addGameHistory(game.instanceId, 'position_challenge_scored', {
      controlPointId: result.controlPointId,
      controlPointName: result.controlPointName,
      players: result.players,
      totalPoints: result.totalPoints,
      timestamp: new Date(),
    });

    console.log(`[POSITION_CHALLENGE] Position challenge event created successfully for game instance ${game.instanceId}`);
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
  async getCurrentPositionChallengeData(gameId: number): Promise<Map<number, Record<string, number>>> {
    const teamPointsByControlPoint = new Map<number, Record<string, number>>();
    
    try {
      // Get all control points with position challenge enabled for this game
      const controlPoints = await this.controlPointsRepository.find({
        where: { game: { id: gameId }, hasPositionChallenge: true },
        relations: ['game'],
      });

      console.log(`[POSITION_CHALLENGE] Getting current data for game ${gameId} - Found ${controlPoints.length} control points with position challenge`);

      // Get current player positions for this game
      const currentPlayerPositions = this.getPlayerPositionsForGame(gameId);
      console.log(`[POSITION_CHALLENGE] Current player positions for game ${gameId}: ${currentPlayerPositions.size}`);

      // Process position challenge to get accumulated team points
      const { teamPointsByControlPoint: currentTeamPoints } = await this.processPositionChallengeWithAccumulation(
        gameId,
        currentPlayerPositions,
      );

      console.log(`[POSITION_CHALLENGE] Current team points for game ${gameId}:`,
        Array.from(currentTeamPoints.entries()).map(([cpId, points]) => `${cpId}: ${JSON.stringify(points)}`));

      return currentTeamPoints;
    } catch (error) {
      console.error(`[POSITION_CHALLENGE] Error getting current position challenge data for game ${gameId}:`, error);
      return teamPointsByControlPoint;
    }
  
  }

  /**
   * Calculate accumulated points from Timer Calculation Service history
   */
  private async calculateAccumulatedPoints(gameId: number, controlPointId: number): Promise<ControlPointAccumulatedPoints> {
    try {
      // Get game to access history
      const game = await this.gamesRepository.findOne({
        where: { id: gameId },
      });

      if (!game || !game.instanceId) {
        console.log(`[POSITION_CHALLENGE] Cannot calculate accumulated points - Game ${gameId} has no instance ID`);
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

      console.log(`[POSITION_CHALLENGE] Found ${relevantEvents.length} position challenge events for control point ${controlPointId}`);

      // Calculate accumulated points from all events
      const teamPoints = new Map<string, number>();
      for (const event of relevantEvents) {
        const { players } = event.data;
        
        for (const player of players) {
          const currentPoints = teamPoints.get(player.team) || 0;
          teamPoints.set(player.team, currentPoints + player.points);
        }
      }

      console.log(`[POSITION_CHALLENGE] Accumulated points for control point ${controlPointId}:`,
        Object.fromEntries(teamPoints));

      return {
        controlPointId,
        controlPointName: controlPoint?.name || `Control Point ${controlPointId}`,
        teamPoints,
        lastControlChange: null, // Control changes are now handled by the timer-calculation service
      };
    } catch (error) {
      console.error(`[POSITION_CHALLENGE] Error calculating accumulated points for control point ${controlPointId}:`, error);
      return {
        controlPointId,
        controlPointName: `Control Point ${controlPointId}`,
        teamPoints: new Map<string, number>(),
        lastControlChange: null,
      };
    }
  }

  /**
   * Check if a team should take control based on accumulated points
   * Note: This logic is now handled by the timer-calculation service based on game history
   * This method is kept for backward compatibility but control changes are now event-driven
   */
  private async checkControlPointControl(gameId: number, controlPointId: number, accumulatedPoints: ControlPointAccumulatedPoints): Promise<string | null> {
    const THRESHOLD = 60; // Points threshold to take control
    
    // Find team with highest points
    let maxPoints = 0;
    let controllingTeam: string | null = null;
    let isTie = false;

    for (const [team, points] of accumulatedPoints.teamPoints.entries()) {
      if (points > maxPoints) {
        maxPoints = points;
        controllingTeam = team;
        isTie = false;
      } else if (points === maxPoints && maxPoints > 0) {
        isTie = true;
      }
    }

    // Check if a team meets the threshold and there's no tie
    if (maxPoints >= THRESHOLD && controllingTeam && !isTie) {
      console.log(`[POSITION_CHALLENGE] Team ${controllingTeam} reached ${maxPoints} points and takes control of control point ${controlPointId}`);
      
      // Update control point ownership
      await this.controlPointsRepository.update(controlPointId, {
        ownedByTeam: controllingTeam,
      });

      // Create control change event
      const game = await this.gamesRepository.findOne({
        where: { id: gameId },
      });

      if (game && game.instanceId) {
        await this.timerCalculationService.addGameHistory(game.instanceId, 'position_challenge_control_change', {
          controlPointId,
          controlPointName: accumulatedPoints.controlPointName,
          controllingTeam,
          points: maxPoints,
          timestamp: new Date(),
        });
      }

      return controllingTeam;
    } else if (isTie) {
      console.log(`[POSITION_CHALLENGE] Tie detected for control point ${controlPointId} - max points: ${maxPoints}, teams tied`);
    } else if (maxPoints > 0) {
      console.log(`[POSITION_CHALLENGE] No team reached threshold for control point ${controlPointId} - max points: ${maxPoints}`);
    }

    return null;
  }

  /**
   * Process position challenge with accumulated points logic
   */
  async processPositionChallengeWithAccumulation(gameId: number, playerPositions: Map<number, PlayerPosition>): Promise<{
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

    console.log(`[POSITION_CHALLENGE] Found ${controlPoints.length} control points with position challenge enabled for game ${gameId}`);

    for (const controlPoint of controlPoints) {
      console.log(`[POSITION_CHALLENGE] Processing control point: ${controlPoint.name} (ID: ${controlPoint.id})`);
      const playersInControlPoint = await this.getPlayersInControlPoint(controlPoint, playerPositions);
      
      if (playersInControlPoint.length > 0) {
        console.log(`[POSITION_CHALLENGE] Control point ${controlPoint.name} has ${playersInControlPoint.length} valid players`);
        const result = this.calculatePointsForControlPoint(controlPoint, playersInControlPoint);
        results.push(result);

        // Create event for Timer Calculation Service
        await this.createPositionChallengeEvent(gameId, result);

        // Calculate accumulated points
        const accumulatedPoints = await this.calculateAccumulatedPoints(gameId, controlPoint.id);
        
        // Check if a team should take control
        const controllingTeam = await this.checkControlPointControl(gameId, controlPoint.id, accumulatedPoints);

        // Broadcast current accumulated points for pie chart
        const teamPoints: Record<string, number> = Object.fromEntries(accumulatedPoints.teamPoints);
        teamPointsByControlPoint.set(controlPoint.id, teamPoints);

        console.log(`[POSITION_CHALLENGE] Broadcasting accumulated points for control point ${controlPoint.id}:`, teamPoints);
      } else {
        console.log(`[POSITION_CHALLENGE] Control point ${controlPoint.name} has no valid players`);
        
        // Still broadcast accumulated points even if no current players
        const accumulatedPoints = await this.calculateAccumulatedPoints(gameId, controlPoint.id);
        const teamPoints: Record<string, number> = Object.fromEntries(accumulatedPoints.teamPoints);
        teamPointsByControlPoint.set(controlPoint.id, teamPoints);
        
        console.log(`[POSITION_CHALLENGE] Broadcasting accumulated points (no current players) for control point ${controlPoint.id}:`, teamPoints);
      }
    }

    console.log(`[POSITION_CHALLENGE] Completed processing for game ${gameId} - ${results.length} control points with players`);
    return { results, teamPointsByControlPoint };
  }
}