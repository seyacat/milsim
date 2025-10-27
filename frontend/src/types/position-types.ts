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

export interface PlayerPositionMarkerData {
  userId: number;
  userName: string;
  lat: number;
  lng: number;
  accuracy: number;
}