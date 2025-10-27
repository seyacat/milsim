import { Game, GameResults, Player } from '../types/index.js';
import { AuthService } from './auth.js';

const API_BASE_URL = '/api';

export class GameService {
  static async getGames(): Promise<Game[]> {
    const response = await fetch(`${API_BASE_URL}/games`, {
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch games');
    }

    return response.json();
  }

  static async getGame(gameId: number): Promise<Game> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch game');
    }

    return response.json();
  }

  static async createGame(gameData: { name: string; description?: string; totalTime?: number; ownerId?: number }): Promise<Game> {
    const response = await fetch(`${API_BASE_URL}/games`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
      body: JSON.stringify(gameData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create game');
    }

    return response.json();
  }

  static async updateGame(gameId: number, updates: Partial<Game>): Promise<Game> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
      method: 'PATCH',
      headers: AuthService.getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update game');
    }

    return response.json();
  }

  static async deleteGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}`, {
      method: 'DELETE',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete game');
    }
  }

  static async joinGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/join`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to join game');
    }
  }

  static async leaveGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/leave`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to leave game');
    }
  }

  static async getGameResults(gameId: number): Promise<GameResults> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/results`, {
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch game results');
    }

    return response.json();
  }

  static async getGamePlayers(gameId: number): Promise<Player[]> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/players`, {
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch game players');
    }

    return response.json();
  }
  static async startGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/start`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start game');
    }
  }

  static async pauseGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/pause`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to pause game');
    }
  }

  static async resumeGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/resume`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resume game');
    }
  }

  static async endGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/end`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to end game');
    }
  }

  static async restartGame(gameId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/restart`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to restart game');
    }
  }

  static async addTime(gameId: number, seconds: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/add-time`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
      body: JSON.stringify({ seconds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add time');
    }
  }

  static async updateGameTime(gameId: number, timeInSeconds: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/update-time`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders(),
      body: JSON.stringify({ timeInSeconds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update game time');
    }
  }
  static async getGameHistory(): Promise<Game[]> {
    const response = await fetch(`${API_BASE_URL}/games/history`, {
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch game history');
    }

    return response.json();
  }

  static async getGameInstances(gameId?: number): Promise<GameInstance[]> {
    const url = gameId
      ? `${API_BASE_URL}/games/${gameId}/instances`
      : `${API_BASE_URL}/games/instances`;
    
    const response = await fetch(url, {
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch game instances');
    }

    return response.json();
  }
}