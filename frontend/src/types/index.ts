// User types
export interface User {
  id: number;
  name: string;
  email: string;
  team?: TeamColor;
}

export type TeamColor = 'blue' | 'red' | 'green' | 'yellow' | 'none';

// Player types
export interface Player {
  id: number;
  user: User;
  team: TeamColor;
}

// Game types
export type GameStatus = 'stopped' | 'running' | 'paused' | 'finished';

export interface Game {
  id: number;
  name: string;
  description?: string;
  status: GameStatus;
  owner: User;
  players: Player[];
  activeConnections: number;
  totalTime: number | null;
  remainingTime?: number;
  playedTime?: number;
  teamCount: number;
  controlPoints: ControlPoint[];
  createdAt: string;
  updatedAt: string;
}

// Control Point types
export interface ControlPoint {
  id: number;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  type: 'site' | 'control';
  ownedByTeam?: TeamColor;
  hasBombChallenge: boolean;
  hasPositionChallenge: boolean;
  bombTimer?: BombTimer;
  currentTeam?: TeamColor;
  currentHoldTime?: number;
  displayTime?: string;
  lastTimeUpdate?: number;
}

export interface BombTimer {
  isActive: boolean;
  remainingTime: number;
  activatedBy?: User;
  activatedAt?: string;
}

// Position Challenge types
export interface PositionChallengeData {
  controlPointId: number;
  teamPoints: Record<TeamColor, number>;
}

// WebSocket event types
export interface GameActionData {
  action: string;
  data: any;
}

export interface PositionUpdateData {
  userId: number;
  userName: string;
  lat: number;
  lng: number;
  accuracy: number;
}

export interface ControlPointUpdateData {
  controlPointId: number;
  currentHoldTime: number;
  currentTeam: TeamColor;
  displayTime: string;
}

export interface BombTimeUpdateData {
  controlPointId: number;
  bombTimer: BombTimer;
}

// Game results types
export interface GameResults {
  gameDuration: number;
  teams: TeamColor[];
  controlPoints: ControlPointResult[];
  teamTotals: Record<TeamColor, number>;
  playerCaptureStats: PlayerCaptureStat[];
  positionChallengeStats?: PositionChallengeStats;
}

export interface ControlPointResult {
  id: number;
  name: string;
  teamTimes: Record<TeamColor, number>;
}

export interface PlayerCaptureStat {
  userId: number;
  userName: string;
  team: TeamColor;
  captureCount: number;
  bombDeactivationCount: number;
  bombExplosionCount: number;
}

export interface PositionChallengeStats {
  controlPoints: PositionChallengeControlPoint[];
  teamTotals: Record<TeamColor, number>;
}

export interface PositionChallengeControlPoint {
  id: number;
  name: string;
  teamPoints: Record<TeamColor, number>;
}

// Toast notification types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
}