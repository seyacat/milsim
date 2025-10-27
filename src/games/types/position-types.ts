export interface PlayerPositionData {
  lat: number;
  lng: number;
  accuracy: number;
  socketId: string;
  lastUpdate: Date;
}

export interface PositionUpdateData {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface PositionBroadcastData {
  userId: number;
  userName: string;
  lat: number;
  lng: number;
  accuracy: number;
}

export interface PositionChallengeUpdateData {
  lat: number;
  lng: number;
  accuracy: number;
}