import { useEffect, useMemo, useState } from 'react';
import { Route } from '@/types/student';
import { Depot } from '@/types/firestore';
import { getDepots } from '@/services/firestore';
import { subscribeToRealtimeBusByRouteId } from '@/services/realtimeDb';
import {
  estimateBoardingArrival,
  formatDistance,
  hasCoordinates,
  resolveDepotForBoarding,
} from '@/utils/geo';
import { DepotDirectionsSheet } from '@/components/DepotDirectionsSheet';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Navigation, Warehouse, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DepotArrivalCardProps {
  route: Route;
  boardingStopId: string;
  className?: string;
}

export const DepotArrivalCard: React.FC<DepotArrivalCardProps> = ({
  route,
  boardingStopId,
  className,
}) => {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [busLocation, setBusLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    getDepots().then(setDepots).catch(() => setDepots([]));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeBusByRouteId(
      route.id,
      (data) => {
        const lat = data?.location?.latitude;
        const lng = data?.location?.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          setBusLocation({ latitude: lat, longitude: lng });
        } else {
          setBusLocation(null);
        }
      },
      undefined,
      route.name
    );
    return unsubscribe;
  }, [route.id, route.name]);

  const boardingStop = route.stops.find((s) => s.id === boardingStopId);

  const depotLocation = useMemo(
    () => resolveDepotForBoarding(route, boardingStopId, depots),
    [route, boardingStopId, depots]
  );

  const estimate = useMemo(
    () => estimateBoardingArrival(route, boardingStopId, depots, busLocation),
    [route, boardingStopId, depots, busLocation]
  );

  if (!estimate) return null;

  const missingCoords = boardingStop && !hasCoordinates(boardingStop);
  const canShowDirections =
    depotLocation != null &&
    typeof depotLocation.latitude === 'number' &&
    typeof depotLocation.longitude === 'number';

  return (
    <>
      <div
        className={cn(
          'rounded-xl border border-border bg-card p-4 space-y-4 animate-fade-in min-w-0 overflow-hidden',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm text-foreground">Bus arrival at your stop</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 min-w-0">
          <div className="rounded-lg bg-secondary/50 px-3 py-2.5 min-w-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              Nearest depot
            </p>
            <p className="font-semibold text-foreground mt-0.5 truncate">{estimate.depotName}</p>
            {estimate.depotDistanceKm > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {formatDistance(estimate.depotDistanceKm)} from {estimate.boardingStopName}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-primary/10 px-3 py-2.5 border border-primary/20 min-w-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">Est. arrival at {estimate.boardingStopName}</span>
            </p>
            <p className="text-2xl font-bold text-primary mt-0.5">{estimate.etaLabel}</p>
            {estimate.routeDistanceKm > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                <Navigation className="h-3 w-3 shrink-0" />
                {formatDistance(estimate.routeDistanceKm)}
                {estimate.source === 'live' ? ' from live bus' : ' along route'}
              </p>
            )}
          </div>
        </div>

        {canShowDirections && (
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-xl"
            onClick={() => setDirectionsOpen(true)}
          >
            <Map className="h-4 w-4 mr-2" />
            Directions to depot
          </Button>
        )}

        {missingCoords && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Add map coordinates to stops for more accurate distance and arrival time.
          </p>
        )}

        {estimate.source === 'route' && !missingCoords && (
          <p className="text-xs text-muted-foreground">
            Estimate based on route distance (~28 km/h). Updates with live bus GPS when the bus is running.
          </p>
        )}
      </div>

      {canShowDirections && depotLocation && (
        <DepotDirectionsSheet
          open={directionsOpen}
          onOpenChange={setDirectionsOpen}
          depotName={depotLocation.name}
          depotLatitude={depotLocation.latitude}
          depotLongitude={depotLocation.longitude}
        />
      )}
    </>
  );
};
