import {
  Route as FirestoreRoute,
  LiveBus,
  RouteStop,
  LiveBusStop,
  AdminStop,
} from "@/types/firestore";
import { Route, Stop, BusState, StopStatus, BusStatus } from "@/types/student";
import { parseStopOrder } from "@/utils/tripStops";
import { toCoordinateNumber } from "@/utils/mapCoordinates";

const readLat = (stop: Record<string, unknown>): number | undefined =>
  toCoordinateNumber(stop.latitude ?? stop.lat);

const readLng = (stop: Record<string, unknown>): number | undefined =>
  toCoordinateNumber(stop.longitude ?? stop.lng ?? stop.lang);

const mapAdminStopToAppStop = (stop: AdminStop): Stop => ({
  id: String(stop.id),
  name: String(stop.name),
  order: parseStopOrder(stop.order),
  estimatedTime: stop.estimatedTime,
  latitude: readLat(stop as AdminStop & Record<string, unknown>),
  longitude: readLng(stop as AdminStop & Record<string, unknown>),
});

const mapEmbeddedStopToAppStop = (
  embedded: RouteStop,
  catalogById: Map<string, AdminStop>
): Stop => {
  const raw = embedded as RouteStop & Record<string, unknown>;
  const catalog = embedded.catalogStopId
    ? catalogById.get(embedded.catalogStopId)
    : undefined;

  const latitude =
    readLat(raw) ??
    (catalog ? readLat(catalog as AdminStop & Record<string, unknown>) : undefined);
  const longitude =
    readLng(raw) ??
    (catalog ? readLng(catalog as AdminStop & Record<string, unknown>) : undefined);

  return {
    id: String(embedded.id),
    name: String(embedded.name),
    order: parseStopOrder(embedded.order),
    latitude,
    longitude,
  };
};

const routeMatchesStop = (route: FirestoreRoute, stop: AdminStop): boolean =>
  stop.routeId === route.id ||
  stop.routeId === route.name ||
  stop.routeName === route.id ||
  stop.routeName === route.name;

const getEmbeddedRouteStops = (firestoreRoute: FirestoreRoute): RouteStop[] => {
  if (!Array.isArray(firestoreRoute.stops)) return [];
  return firestoreRoute.stops.filter(
    (stop: RouteStop) => stop && stop.id && stop.name
  );
};

const resolveRouteStops = (
  firestoreRoute: FirestoreRoute,
  adminStops: AdminStop[] = []
): Stop[] => {
  const catalogById = new Map(adminStops.map((stop) => [stop.id, stop]));
  const embeddedList = getEmbeddedRouteStops(firestoreRoute);

  // Route embedded stops are the source of truth (order, names, ids).
  // Coordinates come from embedded lat/lng OR admin catalog via catalogStopId.
  if (embeddedList.length > 0) {
    return embeddedList
      .map((embedded) => mapEmbeddedStopToAppStop(embedded, catalogById))
      .sort((a, b) => a.order - b.order);
  }

  const byRoute = adminStops
    .filter((stop) => routeMatchesStop(firestoreRoute, stop))
    .map(mapAdminStopToAppStop);

  if (byRoute.length > 0) {
    return byRoute.sort((a, b) => a.order - b.order);
  }

  if (Array.isArray(firestoreRoute.stopIds) && firestoreRoute.stopIds.length > 0) {
    const byIds = adminStops
      .filter((stop) => firestoreRoute.stopIds!.includes(stop.id))
      .map(mapAdminStopToAppStop);
    if (byIds.length > 0) {
      return byIds.sort((a, b) => a.order - b.order);
    }
  }

  return [];
};

/**
 * Convert Firestore Route to app Route format.
 * Stops: embedded route array first, coordinates from lat/lng or catalogStopId.
 */
export const convertFirestoreRouteToAppRoute = (
  firestoreRoute: FirestoreRoute,
  adminStops: AdminStop[] = []
): Route => {
  return {
    id: firestoreRoute.id,
    name: firestoreRoute.name || "",
    description: firestoreRoute.startingPoint || "",
    stops: resolveRouteStops(firestoreRoute, adminStops),
  };
};

/**
 * Convert LiveBus to BusState
 */
export const convertLiveBusToBusState = (liveBus: LiveBus | null): BusState => {
  if (!liveBus) {
    return {
      status: "not-started",
      currentStopIndex: -1,
      lastUpdated: new Date(),
    };
  }

  const stops = Array.isArray(liveBus.stops) ? liveBus.stops : [];

  const currentStopIndex = stops.length > 0
    ? stops.findIndex((stop: LiveBusStop) => stop.status === "current")
    : -1;

  let status: BusStatus = "not-started";

  if (stops.length > 0) {
    const allReached = stops.every((stop) => stop.status === "reached");
    const hasCurrent = stops.some((stop) => stop.status === "current");

    if (allReached) {
      status = "completed";
    } else if (hasCurrent || currentStopIndex >= 0) {
      status = "running";
    }
  } else {
    const routeState = (liveBus as { routeState?: string; status?: string }).routeState
      || (liveBus as { routeState?: string; status?: string }).status;
    if (routeState === "in_progress" || routeState === "running") {
      status = "running";
    } else if (routeState === "completed" || routeState === "finished") {
      status = "completed";
    }
  }

  let lastUpdated: Date;
  try {
    if (liveBus.updatedAt && typeof (liveBus.updatedAt as { toDate?: () => Date }).toDate === "function") {
      lastUpdated = (liveBus.updatedAt as { toDate: () => Date }).toDate();
    } else if (liveBus.updatedAt instanceof Date) {
      lastUpdated = liveBus.updatedAt;
    } else {
      const legacyTimestamp = (liveBus as unknown as { timestamp?: number }).timestamp;
      if (typeof legacyTimestamp === "number") {
        lastUpdated = new Date(legacyTimestamp);
      } else {
        lastUpdated = new Date();
      }
    }
  } catch {
    lastUpdated = new Date();
  }

  return {
    status,
    currentStopIndex: currentStopIndex >= 0 ? currentStopIndex : -1,
    lastUpdated,
  };
};

export const getStopStatusFromLiveBus = (
  liveBus: LiveBus | null,
  stopId: string
): StopStatus => {
  if (!liveBus) return "pending";

  const stops = Array.isArray(liveBus.stops) ? liveBus.stops : [];
  const stop = stops.find((s: LiveBusStop) => s.id === stopId);
  if (!stop) return "pending";

  return stop.status;
};

export const getStopStatusByIndex = (
  liveBus: LiveBus | null,
  index: number
): StopStatus => {
  const stops = liveBus && Array.isArray(liveBus.stops) ? liveBus.stops : [];
  if (index < 0 || index >= stops.length) {
    return "pending";
  }

  return stops[index].status;
};
