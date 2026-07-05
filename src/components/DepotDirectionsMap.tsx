import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoadRoute, waypointsKey } from '@/utils/routeGeometry';
import {
  DEPOT_ARRIVAL_RADIUS_M,
  distanceMeters,
  formatDistance,
} from '@/utils/geo';
import { useUserGeolocation } from '@/hooks/useUserGeolocation';
import { Loader2, MapPin, Navigation, Warehouse } from 'lucide-react';

const DEFAULT_ZOOM = 15;

const createUserIcon = () =>
  L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="user-location-dot"></div>
      <div class="user-location-pulse"></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const createDepotIcon = () =>
  L.divIcon({
    className: 'depot-location-marker',
    html: `
      <div class="depot-location-pin">
        <svg viewBox="0 0 32 44" width="32" height="44" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 1 C9 1 4 6 4 12 C4 22 16 42 16 42 C16 42 28 22 28 12 C28 6 23 1 16 1 Z"
            fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
          <circle cx="16" cy="13" r="7" fill="#f59e0b"/>
        </svg>
      </div>
    `,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -40],
  });

function MapFitBounds({
  userLat,
  userLng,
  depotLat,
  depotLng,
}: {
  userLat?: number;
  userLng?: number;
  depotLat: number;
  depotLng: number;
}) {
  const map = useMap();

  useEffect(() => {
    const points: L.LatLngExpression[] = [[depotLat, depotLng]];
    if (userLat != null && userLng != null) {
      points.push([userLat, userLng]);
    }

    if (points.length === 1) {
      map.setView(points[0], DEFAULT_ZOOM, { animate: true });
      return;
    }

    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 17, animate: true });
  }, [map, userLat, userLng, depotLat, depotLng]);

  return null;
}

function WalkingRouteLine({
  userLat,
  userLng,
  depotLat,
  depotLng,
}: {
  userLat: number;
  userLng: number;
  depotLat: number;
  depotLng: number;
}) {
  const waypoints = useMemo(
    () =>
      [
        [userLat, userLng],
        [depotLat, depotLng],
      ] as [number, number][],
    [userLat, userLng, depotLat, depotLng]
  );
  const wpKey = waypointsKey(waypoints);
  const [positions, setPositions] = useState<[number, number][]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchRoadRoute(waypoints, 'walking').then((line) => {
      if (cancelled) return;
      setPositions(line ?? waypoints);
    });
    return () => {
      cancelled = true;
    };
  }, [wpKey, waypoints]);

  if (positions.length < 2) return null;

  return [
    <Polyline
      key="walk-shadow"
      positions={positions}
      pathOptions={{ color: '#1e3a8a', weight: 8, opacity: 0.2, lineCap: 'round', lineJoin: 'round' }}
    />,
    <Polyline
      key="walk-main"
      positions={positions}
      pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }}
    />,
  ];
}

interface DepotDirectionsMapProps {
  depotName: string;
  depotLatitude: number;
  depotLongitude: number;
  active: boolean;
  height?: number | string;
}

export const DepotDirectionsMap: React.FC<DepotDirectionsMapProps> = ({
  depotName,
  depotLatitude,
  depotLongitude,
  active,
  height = 360,
}) => {
  const { position, error, isWatching } = useUserGeolocation(active);

  const distanceToDepotM = position
    ? distanceMeters(position.latitude, position.longitude, depotLatitude, depotLongitude)
    : null;

  const hasArrived =
    distanceToDepotM != null && distanceToDepotM <= DEPOT_ARRIVAL_RADIUS_M;

  const center: [number, number] = position
    ? [position.latitude, position.longitude]
    : [depotLatitude, depotLongitude];

  return (
    <div className="space-y-3">
      {hasArrived ? (
        <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-4 py-3 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">Arrived at depot</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              You are within {DEPOT_ARRIVAL_RADIUS_M}m of {depotName}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Walking to {depotName}</p>
              {distanceToDepotM != null ? (
                <p className="text-sm font-semibold text-foreground">
                  {formatDistance(distanceToDepotM / 1000)} away
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Getting your location…</p>
              )}
            </div>
          </div>
          {isWatching && (
            <span className="text-[11px] font-medium text-primary whitespace-nowrap flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Live
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-amber-700 dark:text-amber-300 px-1">
          {error}. Allow location access to see live directions.
        </p>
      )}

      <div
        className="depot-directions-map-container rounded-xl overflow-hidden border border-border relative"
        style={{ height }}
      >
        {!position && !error && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/80 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Locating you…</p>
            </div>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          className="depot-directions-map"
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapFitBounds
            userLat={position?.latitude}
            userLng={position?.longitude}
            depotLat={depotLatitude}
            depotLng={depotLongitude}
          />

          {position && !hasArrived && (
            <WalkingRouteLine
              userLat={position.latitude}
              userLng={position.longitude}
              depotLat={depotLatitude}
              depotLng={depotLongitude}
            />
          )}

          <Marker
            position={[depotLatitude, depotLongitude]}
            icon={createDepotIcon()}
          >
            <Popup>
              <div className="text-sm font-semibold flex items-center gap-1">
                <Warehouse className="h-4 w-4" />
                {depotName}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Depot / boarding point</p>
            </Popup>
          </Marker>

          {position && (
            <Marker
              position={[position.latitude, position.longitude]}
              icon={createUserIcon()}
            >
              <Popup>
                <p className="text-sm font-semibold">You are here</p>
                {distanceToDepotM != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasArrived
                      ? 'Arrived at depot'
                      : `${Math.round(distanceToDepotM)} m to depot`}
                  </p>
                )}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
};
