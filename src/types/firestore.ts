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

// Stop Collection Types (admin-managed stops)
export interface AdminStop {
  id: string;
  name: string;
  routeId: string;
  routeName?: string;
  order: number;
  addedBy?: string;
  createdBy?: string;
  status?: "active" | "inactive";
  latitude?: number;
  longitude?: number;
  mapLink?: string;
  estimatedTime?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Route Collection Types
export interface RouteStop {
  id: string;
  name: string;
  order: number;
  latitude?: number;
  longitude?: number;
  catalogStopId?: string;
  mapLink?: string;
}

export interface Depot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routeId?: string;
  routeIds?: string[];
  active?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Route {
  id: string;
  name: string;
  startingPoint: string;
  /** Legacy embedded stops; prefer admin stops from `stops` collection */
  stops?: RouteStop[];
  /** References to documents in the `stops` collection */
  stopIds?: string[];
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

// Announcement Collection Types
export interface Announcement {
  id: string;
  title: string;
  message: string;
  active?: boolean;
  priority?: "low" | "normal" | "high";
  createdAt: Timestamp;
  updatedAt?: Timestamp;
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

export interface FavouriteTrip {
  routeId: string;
  routeName: string;
  fromStopId: string;
  fromStopName: string;
  toStopId: string;
  toStopName: string;
  savedAt: number;
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
  favouriteTrips?: FavouriteTrip[];
  routeId?: string;
  routeName?: string;
  stopId?: string;
  stopName?: string;
  selectedRouteId?: string;
  selectedStopId?: string;
  selectedFromStopId?: string;
  selectedToStopId?: string;
  fromStopName?: string;
  toStopName?: string;
  hasCompletedSetup?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
