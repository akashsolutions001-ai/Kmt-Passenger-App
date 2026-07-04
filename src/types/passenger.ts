export interface Passenger {
  id: string;
  passengerId?: string;
  name: string;
  email?: string;
  phone?: string;
  selectedRouteId?: string;
  selectedStopId?: string;
  routeName?: string;
  favouriteRoutes?: string[];
  favouriteStops?: string[];
  hasCompletedSetup?: boolean;
  routeId?: string;
  stopId?: string;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  stops: Stop[];
}

export interface Stop {
  id: string;
  name: string;
  order: number;
  estimatedTime?: string;
}

export type StopStatus = 'reached' | 'current' | 'pending';

export type BusStatus = 'not-started' | 'running' | 'completed' | 'delayed';

export interface BusState {
  status: BusStatus;
  currentStopIndex: number;
  lastUpdated: Date;
}

export interface AppNotification {
  id: string;
  type: 'bus-started' | 'stop-approaching' | 'stop-reached' | 'bus-delayed' | 'route-changed' | 'emergency' | 'alert' | 'info';
  message: string;
  timestamp: Date;
  read: boolean;
}

/** @deprecated Use Passenger */
export type Student = Passenger;
