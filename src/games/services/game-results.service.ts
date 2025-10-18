import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { GameHistory } from '../entities/game-history.entity';
import { GameInstance } from '../entities/game-instance.entity';
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
    @InjectRepository(GameInstance)
    private gameInstanceRepository: Repository<GameInstance>,
    private timerCalculationService: TimerCalculationService,
    private positionChallengeService: PositionChallengeService,
  ) {}

  // Get game results report with team times per control point and player capture stats
  async getGameResultsReport(gameId: number): Promise<{
    controlPoints: Array<{
      id: number;
      name: string;
      teamTimes: { [team: string]: number };
      teamCaptures: { [team: string]: number };
    }>;
    teamTotals: { [team: string]: number };
    teamCaptureTotals: { [team: string]: number };
    teams: string[];
    gameDuration: number; // Total game duration in seconds
    playerCaptureStats: Array<{
      userId: number;
      userName: string;
      team: string;
      codeCaptureCount: number;
      positionCaptureCount: number;
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
    const game = await this.gamesRepository.findOne({
      where: { id: gameId },
      relations: ['controlPoints'],
    });

    if (!game || !game.instanceId) {
      return {
        controlPoints: [],
        teamTotals: {},
        teamCaptureTotals: {},
        teams: [],
        gameDuration: 0,
        playerCaptureStats: [],
        positionChallengeStats: {
          controlPoints: [],
          teamTotals: {},
        },
      };
    }

    // Get all teams in the game instance
    const players = await this.playersRepository.find({
      where: { gameInstance: { id: game.instanceId } },
      relations: ['user'],
    });

    // Get teams from players that have been assigned to teams
    const teamsFromPlayers = [
      ...new Set(players.map(p => p.team).filter(team => team && team !== 'none')),
    ];

    // Always use the configured team count to generate teams, even if some teams have no players
    const defaultTeams = ['blue', 'red', 'green', 'yellow'].slice(0, game.teamCount || 2);
    const teams = defaultTeams;

    const controlPointsReport: Array<{
      id: number;
      name: string;
      teamTimes: { [team: string]: number };
      teamCaptures: { [team: string]: number };
    }> = [];

    // Get all game history events for capture counting
    const history = await this.gameHistoryRepository.find({
      where: {
        gameInstance: { id: game.instanceId },
      },
      order: { timestamp: 'ASC' },
    });

    // Calculate team times and captures for each control point
    if (game.controlPoints) {
      for (const controlPoint of game.controlPoints) {
        const teamTimes: { [team: string]: number } = {};
        const teamCaptures: { [team: string]: number } = {};
        
        // Initialize all teams with 0 time and 0 captures
        for (const team of teams) {
          teamTimes[team] = 0;
          teamCaptures[team] = 0;
        }

        // Calculate time for each team from game history
        for (const team of teams) {
          const teamTime = await this.timerCalculationService.calculateTeamHoldTime(
            controlPoint.id,
            game.instanceId,
            team,
          );
          teamTimes[team] = teamTime;
        }

        // Calculate captures for each team
        const controlPointEvents = history.filter(
          event => event.eventType === 'control_point_taken' &&
                   event.data?.controlPointId === controlPoint.id
        );

        // Track previous team for each control point
        let previousTeam: string | null = null;
        
        for (const event of controlPointEvents) {
          const currentTeam = event.data?.team;
          if (!currentTeam) continue;

          // Count as capture if:
          // 1. Previous team was different, OR
          // 2. It's the first event after game start (initialState: true)
          if (previousTeam !== currentTeam || event.data?.initialState) {
            teamCaptures[currentTeam] = (teamCaptures[currentTeam] || 0) + 1;
          }
          
          previousTeam = currentTeam;
        }

        controlPointsReport.push({
          id: controlPoint.id,
          name: controlPoint.name,
          teamTimes,
          teamCaptures,
        });
      }
    }

    // Calculate team totals
    const teamTotals: { [team: string]: number } = {};
    const teamCaptureTotals: { [team: string]: number } = {};
    for (const team of teams) {
      teamTotals[team] = controlPointsReport.reduce(
        (total, cp) => total + (cp.teamTimes[team] || 0),
        0,
      );
      teamCaptureTotals[team] = controlPointsReport.reduce(
        (total, cp) => total + (cp.teamCaptures[team] || 0),
        0,
      );
    }

    // Calculate total game duration from game history
    const gameDuration = await this.timerCalculationService.calculateElapsedTimeFromEvents(
      game.instanceId,
    );

    // Get player capture statistics
    const playerCaptureStats = await this.getPlayerCaptureStats(game.instanceId);

    // Get position challenge statistics
    const positionChallengeStats = await this.positionChallengeService.getPositionChallengeStats(
      game.instanceId,
    );

    return {
      controlPoints: controlPointsReport,
      teamTotals,
      teamCaptureTotals,
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
      codeCaptureCount: number;
      positionCaptureCount: number;
      bombDeactivationCount: number;
      bombExplosionCount: number;
    }>;
  }> {
    // Get all game history events
    const history = await this.gameHistoryRepository.find({
      where: {
        gameInstance: { id: gameInstanceId },
      },
      order: { timestamp: 'ASC' },
    });

    // Filter for control point capture events by players (not owners)
    const captureEvents = history.filter(
      event =>
        event.eventType === 'control_point_taken' &&
        event.data &&
        !event.data.assignedByOwner && // Not assigned by owner
        (event.data.userId || event.data.positionChallenge || event.data.userName || event.data.team), // Has userId, userName, positionChallenge, or team
    );

    // Get all players in the game instance
    const gameInstance = await this.gameInstanceRepository.findOne({
      where: { id: gameInstanceId },
      relations: ['players', 'players.user'],
    });

    if (!gameInstance) {
      return { players: [] };
    }

    const gamePlayers = gameInstance.players || [];

    // Initialize player stats
    const playerStats = new Map<
      number,
      {
        userId: number;
        userName: string;
        team: string;
        codeCaptureCount: number;
        positionCaptureCount: number;
        bombDeactivationCount: number;
        bombExplosionCount: number;
      }
    >();

    // Initialize all players with 0 captures, 0 bomb deactivations, and 0 bomb explosions
    for (const player of gamePlayers) {
      if (player.user && player.team && player.team !== 'none') {
        playerStats.set(player.user.id, {
          userId: player.user.id,
          userName: player.user.name,
          team: player.team,
          codeCaptureCount: 0,
          positionCaptureCount: 0,
          bombDeactivationCount: 0,
          bombExplosionCount: 0,
        });
      }
    }

    // Count captures per player - separate code and position challenge captures
    for (const event of captureEvents) {
      const { userId, team, controlPointId, positionChallenge, playerIds, userName } = event.data;

      if (!team) {
        continue;
      }

      // For position challenge captures, use the playerIds array from the event
      if (positionChallenge && playerIds && Array.isArray(playerIds)) {
        // Count each player in the position challenge as capturing the point
        for (const playerId of playerIds) {
          const player = playerStats.get(playerId);
          if (player && player.team === team) {
            player.positionCaptureCount++;
          }
        }
      } else if (userId) {
        // Regular code challenge capture with userId
        const player = playerStats.get(userId);
        if (player) {
          player.codeCaptureCount++;
        }
      } else if (userName) {
        // Code challenge capture with userName but no userId - try to find player by name
        const player = Array.from(playerStats.values()).find(p => p.userName === userName);
        if (player) {
          player.codeCaptureCount++;
        }
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

    for (const event of bombDeactivationEvents) {
      const {
        deactivatedByUserId,
        deactivatedByUserName,
        deactivatedByTeam,
        controlPointId,
        activatedByTeam,
      } = event.data;

      if (!deactivatedByUserId || !deactivatedByTeam) {
        continue;
      }

      const player = playerStats.get(deactivatedByUserId);
      if (player) {
        player.bombDeactivationCount++;
      } else {
        // Player not found in stats, skip
      }
    }

    // Count bomb explosions per player - count explosions for the player who activated the bomb
    const bombExplosionEvents = history.filter(
      event => event.eventType === 'bomb_exploded' && event.data && event.data.activatedByUserId,
    );

    for (const event of bombExplosionEvents) {
      const { activatedByUserId, activatedByUserName, activatedByTeam, controlPointId } =
        event.data;

      if (!activatedByUserId || !activatedByTeam) {
        continue;
      }

      const player = playerStats.get(activatedByUserId);
      if (player) {
        player.bombExplosionCount++;
      } else {
        // Player not found in stats, skip
      }
    }

    const playerStatsArray = Array.from(playerStats.values());

    return { players: playerStatsArray };
  }
}
