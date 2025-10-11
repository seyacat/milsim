import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { GameHistory } from '../entities/game-history.entity';
import { TimerCalculationService } from './timer-calculation.service';
import { PositionChallengeService } from './position-challenge.service';

@Injectable()
export class GameResultsService {
  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    @InjectRepository(GameHistory)
    private gameHistoryRepository: Repository<GameHistory>,
    private timerCalculationService: TimerCalculationService,
    private positionChallengeService: PositionChallengeService,
  ) {}

  // Get game results report with team times per control point and player capture stats
  async getGameResultsReport(gameId: number): Promise<{
    controlPoints: Array<{
      id: number;
      name: string;
      teamTimes: { [team: string]: number };
    }>;
    teamTotals: { [team: string]: number };
    teams: string[];
    gameDuration: number; // Total game duration in seconds
    playerCaptureStats: Array<{
      userId: number;
      userName: string;
      team: string;
      captureCount: number;
      bombDeactivationCount: number;
      bombExplosionCount: number;
    }>;
    positionChallengeStats: {
      controlPoints: Array<{
        id: number;
        name: string;
        teamPoints: { [team: string]: number };
      }>;
      teamTotals: { [team: string]: number };
    };
  }> {
    console.log(`[GAME_RESULTS] Generating results report for game ${gameId}`);

    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints'],
    });

    if (!game || !game.instanceId) {
      console.log(`[GAME_RESULTS] Game ${gameId} not found or no instance ID`);
      return {
        controlPoints: [],
        teamTotals: {},
        teams: [],
        gameDuration: 0,
        playerCaptureStats: [],
        positionChallengeStats: {
          controlPoints: [],
          teamTotals: {},
        },
      };
    }

    // Get all teams in the game
    const players = await this.playersRepository.find({
      where: { game: { id: gameId } },
      relations: ['user'],
    });

    console.log(
      `[GAME_RESULTS] All players:`,
      players.map(p => ({
        id: p.id,
        userId: p.user?.id,
        team: p.team,
        name: p.user?.name,
      })),
    );

    // Get teams from players that have been assigned to teams
    const teamsFromPlayers = [
      ...new Set(players.map(p => p.team).filter(team => team && team !== 'none')),
    ];

    console.log(`[GAME_RESULTS] Teams from players: ${teamsFromPlayers.join(', ')}`);
    console.log(`[GAME_RESULTS] Game team count: ${game.teamCount}`);

    // Always use the configured team count to generate teams, even if some teams have no players
    const defaultTeams = ['blue', 'red', 'green', 'yellow'].slice(0, game.teamCount || 2);
    const teams = defaultTeams;

    console.log(`[GAME_RESULTS] Using teams: ${teams.join(', ')}`);
    console.log(`[GAME_RESULTS] Found ${game.controlPoints?.length || 0} control points`);

    const controlPointsReport: Array<{
      id: number;
      name: string;
      teamTimes: { [team: string]: number };
    }> = [];

    // Calculate team times for each control point
    if (game.controlPoints) {
      for (const controlPoint of game.controlPoints) {
        console.log(`[GAME_RESULTS] Calculating times for control point: ${controlPoint.name}`);

        const teamTimes: { [team: string]: number } = {};
        // Initialize all teams with 0 time
        for (const team of teams) {
          teamTimes[team] = 0;
        }

        // Calculate time for each team from game history
        for (const team of teams) {
          const teamTime = await this.timerCalculationService.calculateTeamHoldTime(controlPoint.id, game.instanceId, team);
          teamTimes[team] = teamTime;
        }

        controlPointsReport.push({
          id: controlPoint.id,
          name: controlPoint.name,
          teamTimes,
        });

        console.log(`[GAME_RESULTS] Control point ${controlPoint.name} times:`, teamTimes);
      }
    }

    // Calculate team totals
    const teamTotals: { [team: string]: number } = {};
    for (const team of teams) {
      teamTotals[team] = controlPointsReport.reduce(
        (total, cp) => total + (cp.teamTimes[team] || 0),
        0,
      );
    }

    console.log(`[GAME_RESULTS] Team totals:`, teamTotals);
    console.log(
      `[GAME_RESULTS] Final report generated with ${controlPointsReport.length} control points`,
    );

    // Calculate total game duration from game history
    const gameDuration = await this.timerCalculationService.calculateElapsedTimeFromEvents(
      game.instanceId,
    );
    console.log(`[GAME_RESULTS] Game duration: ${gameDuration}s`);

    // Get player capture statistics
    const playerCaptureStats = await this.getPlayerCaptureStats(game.instanceId);
    console.log(`[GAME_RESULTS] Player capture stats:`, playerCaptureStats.players);

    // Get position challenge statistics
    const positionChallengeStats = await this.positionChallengeService.getPositionChallengeStats(game.instanceId);
    console.log(`[GAME_RESULTS] Position challenge stats:`, positionChallengeStats);

    return {
      controlPoints: controlPointsReport,
      teamTotals,
      teams,
      gameDuration,
      playerCaptureStats: playerCaptureStats.players,
      positionChallengeStats,
    };
  }

  // Get player capture statistics for game results
  async getPlayerCaptureStats(gameInstanceId: number): Promise<{
    players: Array<{
      userId: number;
      userName: string;
      team: string;
      captureCount: number;
      bombDeactivationCount: number;
      bombExplosionCount: number;
    }>;
  }> {
    console.log(`[PLAYER_CAPTURE_STATS] Getting capture stats for game instance ${gameInstanceId}`);

    // Get all game history events
    const history = await this.gameHistoryRepository.find({
      where: {
        gameInstance: { id: gameInstanceId },
      },
      order: { timestamp: 'ASC' },
    });

    console.log(`[PLAYER_CAPTURE_STATS] Found ${history.length} history events`);

    // Filter for control point capture events by players (not owners)
    const captureEvents = history.filter(
      event =>
        event.eventType === 'control_point_taken' &&
        event.data &&
        event.data.userId && // Has a userId (player action)
        !event.data.assignedByOwner, // Not assigned by owner
    );

    console.log(`[PLAYER_CAPTURE_STATS] Found ${captureEvents.length} player capture events`);

    // Get all players in the game
    const game = await this.gamesRepository.findOne({
      where: { instanceId: gameInstanceId },
      relations: ['players', 'players.user'],
    });

    if (!game) {
      console.log(`[PLAYER_CAPTURE_STATS] Game not found for instance ${gameInstanceId}`);
      return { players: [] };
    }

    console.log(`[PLAYER_CAPTURE_STATS] Found ${game.players?.length || 0} players in game`);

    // Initialize player stats
    const playerStats = new Map<
      number,
      {
        userId: number;
        userName: string;
        team: string;
        captureCount: number;
        bombDeactivationCount: number;
        bombExplosionCount: number;
      }
    >();

    // Initialize all players with 0 captures, 0 bomb deactivations, and 0 bomb explosions
    if (game.players) {
      for (const player of game.players) {
        if (player.user && player.team && player.team !== 'none') {
          playerStats.set(player.user.id, {
            userId: player.user.id,
            userName: player.user.name,
            team: player.team,
            captureCount: 0,
            bombDeactivationCount: 0,
            bombExplosionCount: 0,
          });
        }
      }
    }

    console.log(`[PLAYER_CAPTURE_STATS] Initialized ${playerStats.size} player stats`);

    // Count captures per player - count ALL captures regardless of team change
    for (const event of captureEvents) {
      const { userId, team, controlPointId } = event.data;

      if (!userId || !team) {
        console.log(
          `[PLAYER_CAPTURE_STATS] Skipping event with missing userId or team:`,
          event.data,
        );
        continue;
      }

      // Count ALL captures by players, regardless of team change
      const player = playerStats.get(userId);
      if (player) {
        player.captureCount++;
        console.log(
          `[PLAYER_CAPTURE_STATS] Player ${player.userName} captured control point ${controlPointId}, count: ${player.captureCount}`,
        );
      } else {
        console.log(`[PLAYER_CAPTURE_STATS] Player ${userId} not found in player stats`);
      }
    }

    // Count bomb deactivations per player - only count deactivations by opposing teams
    const bombDeactivationEvents = history.filter(
      event =>
        event.eventType === 'bomb_deactivated' &&
        event.data &&
        event.data.deactivatedByUserId &&
        event.data.isOpposingTeamDeactivation === true,
    );

    console.log(
      `[PLAYER_CAPTURE_STATS] Found ${bombDeactivationEvents.length} bomb deactivation events by opposing teams`,
    );

    for (const event of bombDeactivationEvents) {
      const {
        deactivatedByUserId,
        deactivatedByUserName,
        deactivatedByTeam,
        controlPointId,
        activatedByTeam,
      } = event.data;

      if (!deactivatedByUserId || !deactivatedByTeam) {
        console.log(
          `[PLAYER_CAPTURE_STATS] Skipping bomb deactivation event with missing userId or team:`,
          event.data,
        );
        continue;
      }

      const player = playerStats.get(deactivatedByUserId);
      if (player) {
        player.bombDeactivationCount++;
        console.log(
          `[PLAYER_CAPTURE_STATS] Player ${player.userName} deactivated bomb at control point ${controlPointId} (activated by ${activatedByTeam}), count: ${player.bombDeactivationCount}`,
        );
      } else {
        console.log(
          `[PLAYER_CAPTURE_STATS] Player ${deactivatedByUserId} not found in player stats for bomb deactivation`,
        );
      }
    }

    // Count bomb explosions per player - count explosions for the player who activated the bomb
    const bombExplosionEvents = history.filter(
      event =>
        event.eventType === 'bomb_exploded' &&
        event.data &&
        event.data.activatedByUserId,
    );

    console.log(
      `[PLAYER_CAPTURE_STATS] Found ${bombExplosionEvents.length} bomb explosion events`,
    );

    for (const event of bombExplosionEvents) {
      const {
        activatedByUserId,
        activatedByUserName,
        activatedByTeam,
        controlPointId,
      } = event.data;

      if (!activatedByUserId || !activatedByTeam) {
        console.log(
          `[PLAYER_CAPTURE_STATS] Skipping bomb explosion event with missing userId or team:`,
          event.data,
        );
        continue;
      }

      const player = playerStats.get(activatedByUserId);
      if (player) {
        player.bombExplosionCount++;
        console.log(
          `[PLAYER_CAPTURE_STATS] Player ${player.userName} had bomb explode at control point ${controlPointId}, count: ${player.bombExplosionCount}`,
        );
      } else {
        console.log(
          `[PLAYER_CAPTURE_STATS] Player ${activatedByUserId} not found in player stats for bomb explosion`,
        );
      }
    }

    const players = Array.from(playerStats.values());
    console.log(`[PLAYER_CAPTURE_STATS] Final player stats:`, players);

    return { players };
  }
}