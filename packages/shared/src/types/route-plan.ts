import type { Timestamp } from "./common";

export interface LightingWindow {
  ideal: string; // "09:00-11:00"
  reason: string; // "East-facing front, morning light"
}

export interface RouteStop {
  bookingId: string;
  address: string;
  lat: number;
  lng: number;
  sortOrder: number;
  estimatedArrival: string; // "09:30" (24h)
  estimatedDuration: number; // minutes
  lightingWindow: LightingWindow;
  driveFromPrevious: number; // minutes
}

export interface RoutePlan {
  photographerId: string;
  date: string; // ISO YYYY-MM-DD
  stops: RouteStop[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  isOptimized: boolean;
  optimizedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
