import { Socket } from 'socket.io';
import { GamesService } from '../games.service';
import { PositionChallengeService } from '../services/position-challenge.service';
import { BroadcastUtilitiesHandler } from './broadcast-utilities.handler';

export class GameStateHandler {
  constructor(
    private readonly gamesService: GamesService,
    private readonly positionChallengeService: PositionChallengeService,
    private readonly broadcastUtilities: BroadcastUtilitiesHandler,
  ) {}

  async handleUpdatePlayerTeam(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        let playerId = data.playerId;
        const targetUserId = data.userId || user.id;

        // If playerId is not provided, find or create the player by userId
        if (!playerId) {
          const players = await this.gamesService.getPlayersByGame(gameId);
          const player = players.find(p => p.user.id === targetUserId);
          if (player) {
            playerId = player.id;
          } else {
            // Player not found in current game instance, create a new player entry
            const newPlayer = await this.gamesService.joinGame(gameId, targetUserId);
            playerId = newPlayer.id;
          }
        }

        const updatedPlayer = await this.gamesService.updatePlayerTeam(playerId, data.team);

        // Broadcast the team update to all clients using normalized function
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'playerTeamUpdated',
          {
            playerId: playerId,
            userId: updatedPlayer.user.id,
            userName: updatedPlayer.user.name,
            team: data.team,
          },
          server,
          client.id,
        );

        // Recalculate and broadcast position challenge data for all control points
        // This ensures the pie charts and scores update immediately when teams change
        await this.recalculatePositionChallengeData(gameId, user.id, server);
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'updatePlayerTeam',
          error: error.message,
        });
      }
    }
  }

  async handleStartGame(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
    startInactivePlayerCheck: (gameId: number) => void,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const startedGame = await this.gamesService.startGame(gameId, user.id);
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'gameStateChanged',
          { game: startedGame },
          server,
          client.id,
        );
        
        // Start inactive player checking when game starts
        startInactivePlayerCheck(gameId);
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'startGame',
          error: error.message,
        });
      }
    }
  }

  async handlePauseGame(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
    stopInactivePlayerCheck: (gameId: number) => void,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const pausedGame = await this.gamesService.pauseGame(gameId, user.id);
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'gameStateChanged',
          { game: pausedGame },
          server,
          client.id,
        );
        
        // Stop inactive player checking when game is paused
        stopInactivePlayerCheck(gameId);
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'pauseGame',
          error: error.message,
        });
      }
    }
  }

  async handleResumeGame(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
    startInactivePlayerCheck: (gameId: number) => void,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const resumedGame = await this.gamesService.resumeGame(gameId, user.id);
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'gameStateChanged',
          { game: resumedGame },
          server,
          client.id,
        );
        
        // Resume inactive player checking when game resumes
        startInactivePlayerCheck(gameId);
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'resumeGame',
          error: error.message,
        });
      }
    }
  }

  async handleEndGame(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
    stopInactivePlayerCheck: (gameId: number) => void,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const endedGame = await this.gamesService.endGame(gameId, user.id);
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'gameStateChanged',
          { game: endedGame },
          server,
          client.id,
        );
        
        // Stop inactive player checking when game ends
        stopInactivePlayerCheck(gameId);
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'endGame',
          error: error.message,
        });
      }
    }
  }

  async handleRestartGame(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const restartedGame = await this.gamesService.restartGame(gameId, user.id);
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'gameStateChanged',
          { game: restartedGame },
          server,
          client.id,
        );
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'restartGame',
          error: error.message,
        });
      }
    }
  }

  async handleUpdateTeamCount(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const updatedGame = await this.gamesService.updateTeamCount(
          gameId,
          data.teamCount,
          user.id,
        );
        this.broadcastUtilities.broadcastGameAction(
          gameId,
          'teamCountUpdated',
          { game: updatedGame },
          server,
          client.id,
        );
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'updateTeamCount',
          error: error.message,
        });
      }
    }
  }

  async handleAddTime(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          const updatedGame = await this.gamesService.addTime(gameId, data.seconds);
          this.broadcastUtilities.broadcastGameAction(
            gameId,
            'timeAdded',
            { game: updatedGame },
            server,
            client.id,
          );
        }
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'addTime',
          error: error.message,
        });
      }
    }
  }

  async handleUpdateGameTime(
    client: Socket,
    gameId: number,
    data: any,
    connectedUsers: Map<string, any>,
    server: any,
  ) {
    const user = connectedUsers.get(client.id);
    if (user) {
      try {
        const game = await this.gamesService.findOne(gameId, user.id);
        if (game.owner && game.owner.id === user.id) {
          const updatedGame = await this.gamesService.updateGameTime(
            gameId,
            data.timeInSeconds,
            user.id,
          );
          this.broadcastUtilities.broadcastGameAction(
            gameId,
            'gameTimeUpdated',
            { game: updatedGame },
            server,
            client.id,
          );
        }
      } catch (error: any) {
        client.emit('gameActionError', {
          action: 'updateGameTime',
          error: error.message,
        });
      }
    }
  }

  private async recalculatePositionChallengeData(gameId: number, userId: number, server: any) {
    try {
      const currentPositionChallengeData =
        await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
      
      // Get the current game to check which control points have position challenge
      const currentGame = await this.gamesService.findOne(gameId, userId);
      
      // Broadcast updated position challenge data ONLY for control points with position challenge
      // This prevents unnecessary updates to all control points
      for (const [controlPointId, teamPoints] of currentPositionChallengeData.entries()) {
        // Only send update if this control point has position challenge
        const controlPoint = currentGame.controlPoints?.find(cp => cp.id === controlPointId);
        if (controlPoint && controlPoint.hasPositionChallenge) {
          this.broadcastUtilities.broadcastPositionChallengeUpdate(
            gameId,
            controlPointId,
            teamPoints,
            server,
          );
        }
      }
    } catch (positionChallengeError) {
      console.error(
        `[GAME_STATE_HANDLER] Error recalculating position challenge data for game ${gameId}:`,
        positionChallengeError,
      );
    }
  }
}