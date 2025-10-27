export interface BaseWebSocketEvent {
  from: string;
  timestamp: string;
}

export interface GameStateChangedEvent extends BaseWebSocketEvent {
  game: any;
}

export interface TeamCountUpdatedEvent extends BaseWebSocketEvent {
  game: any;
}

export interface TimeAddedEvent extends BaseWebSocketEvent {
  game: any;
}

export interface GameTimeUpdatedEvent extends BaseWebSocketEvent {
  game: any;
}

export interface ControlPointCreatedEvent extends BaseWebSocketEvent {
  controlPoint: {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    status: string;
    type: string;
    challengeType: string | null;
    code: string | null;
    armedCode: string | null;
    disarmedCode: string | null;
    minDistance: number | null;
    minAccuracy: number | null;
    hasPositionChallenge: boolean;
    hasCodeChallenge: boolean;
    hasBombChallenge: boolean;
    bombTime: number | null;
    ownedByTeam: string | null;
    gameId: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ControlPointUpdatedEvent extends BaseWebSocketEvent {
  controlPoint: {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    status: string;
    type: string;
    challengeType: string | null;
    code: string | null;
    armedCode: string | null;
    disarmedCode: string | null;
    minDistance: number | null;
    minAccuracy: number | null;
    hasPositionChallenge: boolean;
    hasCodeChallenge: boolean;
    hasBombChallenge: boolean;
    bombTime: number | null;
    ownedByTeam: string | null;
    gameId: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ControlPointDeletedEvent extends BaseWebSocketEvent {
  controlPointId: number;
}

export interface ControlPointTeamAssignedEvent extends BaseWebSocketEvent {
  controlPoint: {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    status: string;
    type: string;
    challengeType: string | null;
    code: string | null;
    armedCode: string | null;
    disarmedCode: string | null;
    minDistance: number | null;
    minAccuracy: number | null;
    hasPositionChallenge: boolean;
    hasCodeChallenge: boolean;
    hasBombChallenge: boolean;
    bombTime: number | null;
    ownedByTeam: string | null;
    gameId: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ControlPointTakenEvent extends BaseWebSocketEvent {
  controlPointId: number;
  userId: number;
  userName: string;
  team: string;
  controlPoint: {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    status: string;
    type: string;
    challengeType: string | null;
    code: string | null;
    armedCode: string | null;
    disarmedCode: string | null;
    minDistance: number | null;
    minAccuracy: number | null;
    hasPositionChallenge: boolean;
    hasCodeChallenge: boolean;
    hasBombChallenge: boolean;
    bombTime: number | null;
    ownedByTeam: string | null;
    gameId: number;
    createdAt: string;
    updatedAt: string;
    bombStatus?: {
      isActive: boolean;
      remainingTime?: number;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
    };
  };
}

export interface PlayerTeamUpdatedEvent extends BaseWebSocketEvent {
  playerId: number;
  userId: number;
  team: string;
  userName?: string;
}

export interface PositionUpdateEvent extends BaseWebSocketEvent {
  userId: number;
  userName: string;
  lat: number;
  lng: number;
  accuracy: number;
}

export interface PlayerPositionsResponseEvent extends BaseWebSocketEvent {
  positions: Array<{
    userId: number;
    userName: string;
    lat: number;
    lng: number;
    accuracy: number;
  }>;
}

export interface PlayerInactiveEvent extends BaseWebSocketEvent {
  userId: number;
}

export interface GameTimeEvent extends BaseWebSocketEvent {
  remainingTime: number | null;
  totalTime: number | null;
  playedTime: number;
  controlPointTimes: Array<{
    controlPointId: number;
    currentHoldTime: number;
    currentTeam: string | null;
    displayTime: string;
  }>;
}

export interface TimeUpdateEvent extends BaseWebSocketEvent {
  remainingTime: number | null;
  totalTime: number | null;
  playedTime: number;
  controlPointTimes: Array<{
    controlPointId: number;
    currentHoldTime: number;
    currentTeam: string | null;
    displayTime: string;
  }>;
}

export interface ControlPointTimeUpdateEvent extends BaseWebSocketEvent {
  controlPointId: number;
  currentHoldTime: number;
  currentTeam: string | null;
  displayTime: string;
}

export interface BombTimeUpdateEvent extends BaseWebSocketEvent {
  controlPointId: number;
  remainingTime: number;
  totalTime: number;
  isActive: boolean;
  activatedByUserId?: number;
  activatedByUserName?: string;
  activatedByTeam?: string;
  exploded?: boolean;
}

export interface ActiveBombTimersEvent extends BaseWebSocketEvent {
  timers: Array<{
    controlPointId: number;
    remainingTime: number;
    totalTime: number;
    isActive: boolean;
    activatedByUserId?: number;
    activatedByUserName?: string;
    activatedByTeam?: string;
  }>;
}

export interface PositionChallengeUpdateEvent extends BaseWebSocketEvent {
  controlPointId: number;
  teamPoints: Record<string, number>;
}

export interface JoinSuccessEvent extends BaseWebSocketEvent {
  user: {
    id: number;
    name: string;
  };
}

export interface GameActionErrorEvent extends BaseWebSocketEvent {
  action: string;
  error: string;
}

export interface JoinErrorEvent extends BaseWebSocketEvent {
  message: string;
}

export interface LeaveSuccessEvent extends BaseWebSocketEvent {
  user: {
    id: number;
    name: string;
  };
}

export interface LeaveErrorEvent extends BaseWebSocketEvent {
  message: string;
}

export interface BombActivatedEvent extends BaseWebSocketEvent {
  controlPointId: number;
  userId: number;
  userName: string;
  controlPoint?: {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    status: string;
    type: string;
    challengeType: string | null;
    code: string | null;
    armedCode: string | null;
    disarmedCode: string | null;
    minDistance: number | null;
    minAccuracy: number | null;
    hasPositionChallenge: boolean;
    hasCodeChallenge: boolean;
    hasBombChallenge: boolean;
    bombTime: number | null;
    ownedByTeam: string | null;
    gameId: number;
    createdAt: string;
    updatedAt: string;
    bombStatus?: {
      isActive: boolean;
      remainingTime?: number;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
    };
  };
}

export interface BombDeactivatedEvent extends BaseWebSocketEvent {
  controlPointId: number;
  userId: number;
  userName: string;
  controlPoint?: {
    id: number;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    status: string;
    type: string;
    challengeType: string | null;
    code: string | null;
    armedCode: string | null;
    disarmedCode: string | null;
    minDistance: number | null;
    minAccuracy: number | null;
    hasPositionChallenge: boolean;
    hasCodeChallenge: boolean;
    hasBombChallenge: boolean;
    bombTime: number | null;
    ownedByTeam: string | null;
    gameId: number;
    createdAt: string;
    updatedAt: string;
    bombStatus?: {
      isActive: boolean;
      remainingTime?: number;
      activatedByUserId?: number;
      activatedByUserName?: string;
      activatedByTeam?: string;
    };
  };
}

export interface ForceDisconnectEvent extends BaseWebSocketEvent {
  message: string;
}