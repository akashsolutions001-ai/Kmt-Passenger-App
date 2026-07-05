function isValidLatitude(n: number): boolean {
  return !Number.isNaN(n) && n >= -90 && n <= 90;
}

function isValidLongitude(n: number): boolean {
  return !Number.isNaN(n) && n >= -180 && n <= 180;
}

export function toCoordinateNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseFloat(value.trim());
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** Read latitude from Firestore fields (latitude / lat). */
export function readLatitude(stop: Record<string, unknown>): number | undefined {
  return toCoordinateNumber(stop.latitude ?? stop.lat);
}

/** Read longitude from Firestore fields (longitude / lng / lang). */
export function readLongitude(stop: Record<string, unknown>): number | undefined {
  return toCoordinateNumber(stop.longitude ?? stop.lng ?? stop.lang);
}

export function hasResolvedCoordinates(stop: {
  latitude?: number;
  longitude?: number;
}): boolean {
  const lat = toCoordinateNumber(stop.latitude);
  const lng = toCoordinateNumber(stop.longitude);
  return lat !== undefined && lng !== undefined && isValidLatitude(lat) && isValidLongitude(lng);
}

/** Resolve stop position using latitude & longitude only. */
export function resolveStopCoordinates(stop: {
  latitude?: number;
  longitude?: number;
}): { latitude: number; longitude: number } | null {
  const lat = toCoordinateNumber(stop.latitude);
  const lng = toCoordinateNumber(stop.longitude);

  if (lat !== undefined && lng !== undefined && isValidLatitude(lat) && isValidLongitude(lng)) {
    return { latitude: lat, longitude: lng };
  }

  return null;
}
