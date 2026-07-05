import { Depot } from '@/types/firestore';
import { Route, Stop } from '@/types/student';

const EARTH_RADIUS_KM = 6371;
const AVG_BUS_SPEED_KMH = 28;
const MINUTES_PER_INTERMEDIATE_STOP = 2;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function estimateMinutesFromDistanceKm(km: number): number {
  if (km <= 0) return 1;
  return Math.max(1, Math.round((km / AVG_BUS_SPEED_KMH) * 60));
}

export function formatEta(minutes: number): string {
  if (minutes < 1) return 'Less than 1 min';
  if (minutes === 1) return '1 min';
  if (minutes < 60) return `${minutes} mins`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function hasCoordinates(stop: Pick<Stop, 'latitude' | 'longitude'>): boolean {
  return (
    typeof stop.latitude === 'number' &&
    typeof stop.longitude === 'number' &&
    !Number.isNaN(stop.latitude) &&
    !Number.isNaN(stop.longitude)
  );
}

/** Sum straight-line distances between consecutive stops on a route segment. */
export function routeSegmentDistanceKm(
  stops: Stop[],
  startIndex: number,
  endIndex: number
): number {
  if (startIndex >= endIndex || startIndex < 0 || endIndex >= stops.length) return 0;

  let total = 0;
  for (let i = startIndex; i < endIndex; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (!hasCoordinates(a) || !hasCoordinates(b)) continue;
    total += haversineKm(a.latitude!, a.longitude!, b.latitude!, b.longitude!);
  }
  return total;
}

export function formatArrivalClockTime(etaMinutesFromNow: number): string {
  return new Date(Date.now() + etaMinutesFromNow * 60_000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export interface StopArrivalEstimate {
  etaMinutes: number;
  arrivalTime: string;
  etaLabel: string;
}

/** Estimate when the bus will reach a stop (pending or current). */
export function estimateArrivalAtStop(
  stops: Stop[],
  stopIndex: number,
  currentStopIndex: number,
  busLocation?: { latitude: number; longitude: number } | null,
  busStarted = false
): StopArrivalEstimate | null {
  if (stopIndex < 0 || stopIndex >= stops.length) return null;

  const target = stops[stopIndex];
  let etaMinutes: number;

  if (!busStarted) {
    const segmentKm = routeSegmentDistanceKm(stops, 0, stopIndex);
    const dwell = stopIndex * MINUTES_PER_INTERMEDIATE_STOP;
    etaMinutes =
      segmentKm > 0
        ? estimateMinutesFromDistanceKm(segmentKm) + dwell
        : stopIndex * (MINUTES_PER_INTERMEDIATE_STOP + 4);
  } else if (
    busLocation &&
    hasCoordinates(target) &&
    typeof busLocation.latitude === 'number' &&
    typeof busLocation.longitude === 'number'
  ) {
    const km = haversineKm(
      busLocation.latitude,
      busLocation.longitude,
      target.latitude!,
      target.longitude!
    );
    etaMinutes = estimateMinutesFromDistanceKm(km);
  } else {
    const fromIndex = Math.max(0, currentStopIndex);
    const segmentKm = routeSegmentDistanceKm(stops, fromIndex, stopIndex);
    const stopsBetween = Math.max(0, stopIndex - fromIndex);
    etaMinutes =
      segmentKm > 0
        ? estimateMinutesFromDistanceKm(segmentKm) + stopsBetween * MINUTES_PER_INTERMEDIATE_STOP
        : stopsBetween * (MINUTES_PER_INTERMEDIATE_STOP + 4);
  }

  etaMinutes = Math.max(1, etaMinutes);

  return {
    etaMinutes,
    arrivalTime: formatArrivalClockTime(etaMinutes),
    etaLabel: formatEta(etaMinutes),
  };
}

export function findNearestDepot(
  depots: Depot[],
  targetLat: number,
  targetLng: number,
  routeId?: string
): Depot | null {
  const active = depots.filter((d) => d.active !== false);
  const forRoute = routeId
    ? active.filter(
        (d) =>
          d.routeId === routeId ||
          d.routeIds?.includes(routeId)
      )
    : active;
  const pool = forRoute.length > 0 ? forRoute : active;

  let nearest: Depot | null = null;
  let minKm = Infinity;

  for (const depot of pool) {
    const km = haversineKm(targetLat, targetLng, depot.latitude, depot.longitude);
    if (km < minKm) {
      minKm = km;
      nearest = depot;
    }
  }

  return nearest;
}

export interface BoardingArrivalEstimate {
  depotName: string;
  depotDistanceKm: number;
  routeDistanceKm: number;
  etaMinutes: number;
  etaLabel: string;
  source: 'live' | 'route';
  boardingStopName: string;
}

export function estimateBoardingArrival(
  route: Route,
  boardingStopId: string,
  depots: Depot[],
  busLocation?: { latitude: number; longitude: number } | null
): BoardingArrivalEstimate | null {
  const boardingIndex = route.stops.findIndex((s) => s.id === boardingStopId);
  if (boardingIndex < 0) return null;

  const boardingStop = route.stops[boardingIndex];
  const firstStop = route.stops[0];

  let depotName = route.description || route.name;
  let depotLat: number | undefined;
  let depotLng: number | undefined;
  let depotDistanceKm = 0;

  if (hasCoordinates(boardingStop)) {
    const nearestDepot = findNearestDepot(
      depots,
      boardingStop.latitude!,
      boardingStop.longitude!,
      route.id
    );
    if (nearestDepot) {
      depotName = nearestDepot.name;
      depotLat = nearestDepot.latitude;
      depotLng = nearestDepot.longitude;
      depotDistanceKm = haversineKm(
        boardingStop.latitude!,
        boardingStop.longitude!,
        depotLat,
        depotLng
      );
    } else if (hasCoordinates(firstStop)) {
      depotName = firstStop.name;
      depotLat = firstStop.latitude;
      depotLng = firstStop.longitude;
      depotDistanceKm = haversineKm(
        boardingStop.latitude!,
        boardingStop.longitude!,
        depotLat,
        depotLng
      );
    }
  } else if (hasCoordinates(firstStop)) {
    depotName = firstStop.name;
    depotLat = firstStop.latitude;
    depotLng = firstStop.longitude;
  }

  let routeDistanceKm = routeSegmentDistanceKm(route.stops, 0, boardingIndex);
  if (routeDistanceKm === 0 && hasCoordinates(boardingStop) && depotLat != null && depotLng != null) {
    routeDistanceKm = haversineKm(depotLat, depotLng, boardingStop.latitude!, boardingStop.longitude!);
  }

  const intermediateStops = Math.max(0, boardingIndex);
  const dwellMinutes = intermediateStops * MINUTES_PER_INTERMEDIATE_STOP;

  let etaMinutes: number;
  let source: 'live' | 'route' = 'route';

  if (
    busLocation &&
    hasCoordinates(boardingStop) &&
    typeof busLocation.latitude === 'number' &&
    typeof busLocation.longitude === 'number'
  ) {
    const liveKm = haversineKm(
      busLocation.latitude,
      busLocation.longitude,
      boardingStop.latitude!,
      boardingStop.longitude!
    );
    etaMinutes = estimateMinutesFromDistanceKm(liveKm);
    source = 'live';
    routeDistanceKm = liveKm;
  } else {
    etaMinutes = estimateMinutesFromDistanceKm(routeDistanceKm) + dwellMinutes;
  }

  return {
    depotName,
    depotDistanceKm,
    routeDistanceKm,
    etaMinutes,
    etaLabel: formatEta(etaMinutes),
    source,
    boardingStopName: boardingStop.name,
  };
}
