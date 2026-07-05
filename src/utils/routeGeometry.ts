type LatLng = [number, number];
type RouteProfile = 'driving' | 'walking';

/** Fetch a road-following route through waypoints using OSRM (OpenStreetMap). */
export async function fetchRoadRoute(
  waypoints: LatLng[],
  profile: RouteProfile = 'driving'
): Promise<LatLng[] | null> {
  if (waypoints.length < 2) return null;

  const coordStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };

    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (data.code !== 'Ok' || !coords?.length) return null;

    return coords.map(([lng, lat]) => [lat, lng] as LatLng);
  } catch {
    return null;
  }
}

export function waypointsKey(waypoints: LatLng[]): string {
  return waypoints.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join('|');
}
