import { Timestamp } from "firebase/firestore";

// Bus Collection Types
export interface Bus {
  id: string;
  assignedDriverId: string | null;
  assignedRouteId: string | null;
  busNumber: string;
  status: "idle" | "running" | "stopped" | "maintenance";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Driver Collection Types
export interface Driver {
  id: string;
  driverId: string;
  name: string;
  phone: string;
  password: string;
  assignedBusId: string | null;
  status: "active" | "inactive";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Route Collection Types
export interface RouteStop {
  id: string;
  name: string;
  order: number;
}

export interface Route {
  id: string;
  name: string;
  startingPoint: string;
  stops: RouteStop[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// LiveBus Collection Types
export type StopStatus = "reached" | "current" | "pending";

export interface LiveBusStop {
  id: string;
  name: string;
  order: number;
  status: StopStatus;
}

export interface LiveBus {
  id: string;
  busNumber: string;
  driverName: string;
  routeName: string;
  stops: LiveBusStop[];
  startedAt: Timestamp;
  updatedAt: Timestamp;
}

// Complaint Collection Types
export type ComplaintStatus = "pending" | "in_review" | "resolved" | "rejected";

export interface Complaint {
  id: string;
  passengerId: string;
  passengerName: string;
  message: string;
  routeId?: string;
  stopId?: string;
  busNumber?: string;
  status: ComplaintStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Passenger Collection Types
// Matches documents in the "passengers" collection
export interface Passenger {
  id: string;
  passengerId?: string;
  name: string;
  email?: string;
  phone?: string;
  status?: string;
  password?: string;
  favouriteRoutes?: string[];
  favouriteStops?: string[];
  routeId?: string;
  routeName?: string;
  stopId?: string;
  stopName?: string;
  selectedRouteId?: string;
  selectedStopId?: string;
  hasCompletedSetup?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
