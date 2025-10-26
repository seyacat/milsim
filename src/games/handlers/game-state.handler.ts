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

        // Broadcast the team update to all clients using specific event
        this.broadcastUtilities.broadcastPlayerTeamUpdated(
          gameId,
          playerId,
          updatedPlayer.user.id,
          data.team,
          updatedPlayer.user.name,
          server,
          client.id,
        );

        // Recalculate position challenge data internally when teams change
        // This ensures the internal state is updated but doesn't force frontend notifications
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
        this.broadcastUtilities.broadcastGameStateChange(
          gameId,
          startedGame,
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
        
        console.log(`[PAUSE_GAME] Game ${gameId} paused by user ${user.id}, broadcasting to all players`);
        
        this.broadcastUtilities.broadcastGameStateChange(
          gameId,
          pausedGame,
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
        this.broadcastUtilities.broadcastGameStateChange(
          gameId,
          resumedGame,
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
        this.broadcastUtilities.broadcastGameStateChange(
          gameId,
          endedGame,
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
        this.broadcastUtilities.broadcastGameStateChange(
          gameId,
          restartedGame,
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
        this.broadcastUtilities.broadcastTeamCountUpdated(
          gameId,
          updatedGame,
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
          this.broadcastUtilities.broadcastTimeAdded(
            gameId,
            updatedGame,
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
          this.broadcastUtilities.broadcastGameTimeUpdated(
            gameId,
            updatedGame,
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
      // Recalculate position challenge data internally without broadcasting to frontend
      // This ensures internal state is updated but doesn't force unnecessary frontend notifications
      await this.positionChallengeService.getCurrentPositionChallengeData(gameId);
      
    } catch (positionChallengeError) {
      console.error(
        `[GAME_STATE_HANDLER] Error recalculating position challenge data for game ${gameId}:`,
        positionChallengeError,
      );
    }
  }
}