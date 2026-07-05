import { BookableStop } from '@/types/student';

export const parseStopOrder = (order: unknown): number => {
  if (typeof order === 'number' && !Number.isNaN(order)) return order;
  const parsed = parseInt(String(order ?? ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const isSameRoute = (a: BookableStop, b: BookableStop): boolean =>
  a.routeId === b.routeId ||
  a.routeName.toLowerCase().trim() === b.routeName.toLowerCase().trim();

/** Stops on the same route that come after the boarding stop. */
export const getDestinationStops = (
  fromStop: BookableStop,
  allStops: BookableStop[]
): BookableStop[] => {
  const routeStops = allStops
    .filter((s) => isSameRoute(s, fromStop) && s.id !== fromStop.id)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  if (routeStops.length === 0) return [];

  const fromOrder = fromStop.order;
  const byOrder = routeStops.filter((s) => s.order > fromOrder);

  if (byOrder.length > 0) {
    return byOrder;
  }

  // Fallback when order is missing or duplicated: use sorted list position
  const sorted = [...allStops]
    .filter((s) => isSameRoute(s, fromStop))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const fromIndex = sorted.findIndex((s) => s.id === fromStop.id);
  if (fromIndex < 0) return routeStops;

  return sorted.slice(fromIndex + 1);
};

/** True when destination comes after boarding on the same route. */
export const isValidTrip = (
  fromStop: BookableStop,
  toStop: BookableStop,
  routeStops?: { id: string; order: number }[]
): boolean => {
  if (!isSameRoute(fromStop, toStop)) return false;

  if (routeStops && routeStops.length > 0) {
    const fromIdx = routeStops.findIndex((s) => s.id === fromStop.id);
    const toIdx = routeStops.findIndex((s) => s.id === toStop.id);
    if (fromIdx >= 0 && toIdx >= 0) {
      return fromIdx < toIdx;
    }
  }

  if (fromStop.order > 0 && toStop.order > 0) {
    return fromStop.order < toStop.order;
  }

  return fromStop.id !== toStop.id;
};

export const buildBookableStopsFromRoutes = (
  routes: {
    id: string;
    name: string;
    stops: {
      id: string;
      name: string;
      order: number;
      estimatedTime?: string;
      latitude?: number;
      longitude?: number;
      mapLink?: string;
    }[];
  }[]
): BookableStop[] => {
  const raw = routes.flatMap((route) =>
    route.stops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      order: parseStopOrder(stop.order),
      estimatedTime: stop.estimatedTime,
      latitude: stop.latitude,
      longitude: stop.longitude,
      mapLink: stop.mapLink,
      routeId: route.id,
      routeName: route.name,
    }))
  );
  return normalizeBookableStops(raw);
};

export const normalizeBookableStops = (
  stops: BookableStop[]
): BookableStop[] => {
  const canonicalRouteId = new Map<string, string>();
  for (const stop of stops) {
    const key = stop.routeName.toLowerCase().trim();
    if (!canonicalRouteId.has(key)) {
      canonicalRouteId.set(key, stop.routeId);
    }
  }

  return stops
    .map((stop) => ({
      ...stop,
      order: parseStopOrder(stop.order),
      routeId: canonicalRouteId.get(stop.routeName.toLowerCase().trim()) ?? stop.routeId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
