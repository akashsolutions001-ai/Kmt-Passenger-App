import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BusResultCard } from '@/components/BusResultCard';
import { DepotDirectionsSheet } from '@/components/DepotDirectionsSheet';
import { Button } from '@/components/ui/button';
import { useUserGeolocation } from '@/hooks/useUserGeolocation';
import { getDepots } from '@/services/firestore';
import { Depot } from '@/types/firestore';
import {
  estimateBoardingArrival,
  findNearestStopOnRoute,
  formatDistance,
  hasCoordinates,
  distanceMeters,
  resolveDepotForBoarding,
} from '@/utils/geo';
import { availableBusToFirestoreBus } from '@/utils/busSearch';
import { ArrowLeft, ArrowRight, Bus, MapPinned } from 'lucide-react';

export const BusResultsScreen: React.FC = () => {
  const {
    routes,
    bookableStops,
    selectedRoute,
    fromStopId,
    toStopId,
    availableBuses,
    selectBus,
    confirmSelection,
    closeBusResults,
  } = useAuth();

  const [selectingBusId, setSelectingBusId] = useState<string | null>(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [depots, setDepots] = useState<Depot[]>([]);
  const { position } = useUserGeolocation(true);

  useEffect(() => {
    getDepots().then(setDepots).catch(() => setDepots([]));
  }, []);

  const fromStop = bookableStops.find((s) => s.id === fromStopId);
  const toStop = bookableStops.find((s) => s.id === toStopId);

  const route = useMemo(() => {
    if (selectedRoute) return selectedRoute;
    if (!fromStop) return null;
    return routes.find((r) => r.id === fromStop.routeId) ?? null;
  }, [selectedRoute, fromStop, routes]);

  const fromRouteStop = route?.stops.find((s) => s.id === fromStopId);

  const nearestStop = useMemo(() => {
    if (!route || !fromRouteStop) return null;

    if (position) {
      const nearest = findNearestStopOnRoute(
        route.stops,
        position.latitude,
        position.longitude,
        { maxOrder: fromRouteStop.order }
      );
      if (nearest) return nearest;
    }

    if (position && hasCoordinates(fromRouteStop)) {
      const distanceM = distanceMeters(
        position.latitude,
        position.longitude,
        fromRouteStop.latitude!,
        fromRouteStop.longitude!
      );
      return {
        stop: fromRouteStop,
        distanceM,
        distanceLabel: formatDistance(distanceM / 1000),
      };
    }

    return {
      stop: fromRouteStop,
      distanceM: 0,
      distanceLabel: hasCoordinates(fromRouteStop) ? 'Selected stop' : '—',
    };
  }, [route, fromRouteStop, position]);

  const directionsTarget = useMemo(() => {
    if (nearestStop && hasCoordinates(nearestStop.stop)) {
      return {
        name: nearestStop.stop.name,
        latitude: nearestStop.stop.latitude!,
        longitude: nearestStop.stop.longitude!,
      };
    }
    if (route && fromStopId) {
      return resolveDepotForBoarding(route, fromStopId, depots);
    }
    return null;
  }, [nearestStop, route, fromStopId, depots]);

  const boardingEta = useMemo(() => {
    if (!route || !fromStopId) return null;
    return estimateBoardingArrival(route, fromStopId, depots, null);
  }, [route, fromStopId, depots]);

  const liveBuses = useMemo(
    () => availableBuses.filter((b) => b.isLive || b.status === 'running'),
    [availableBuses]
  );
  const otherBuses = useMemo(
    () => availableBuses.filter((b) => !b.isLive && b.status !== 'running'),
    [availableBuses]
  );
  const sortedBuses = useMemo(() => [...liveBuses, ...otherBuses], [liveBuses, otherBuses]);

  const handleSelectBus = async (busId: string) => {
    const bus = availableBuses.find((b) => b.id === busId);
    if (!bus) return;

    setSelectingBusId(bus.id);
    try {
      selectBus(availableBusToFirestoreBus(bus));
      await confirmSelection();
    } finally {
      setSelectingBusId(null);
    }
  };

  if (!fromStop || !toStop || !route) {
    return (
      <div className="min-h-screen-safe flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground text-sm mb-4">Trip details missing</p>
        <Button onClick={closeBusResults}>Back to search</Button>
      </div>
    );
  }

  const boardingHint =
    nearestStop && nearestStop.stop.name !== fromStop.name
      ? `${nearestStop.stop.name} (${nearestStop.distanceLabel})`
      : nearestStop?.distanceLabel && nearestStop.distanceLabel !== 'Selected stop'
        ? `${nearestStop.distanceLabel} away`
        : undefined;

  const canGetDirections = !!directionsTarget;

  return (
    <div className="min-h-screen-safe bg-muted/40 flex flex-col overflow-x-hidden">
      <header className="bg-primary text-primary-foreground sticky top-0 z-20 shadow-md shrink-0">
        <div className="mx-auto w-full max-w-lg px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={closeBusResults}
              className="p-2 -ml-1 rounded-full hover:bg-primary-foreground/10 transition-colors shrink-0"
              aria-label="Modify search"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold min-w-0">
                <span className="truncate">{fromStop.name}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-80" />
                <span className="truncate">{toStop.name}</span>
              </div>
              <p className="text-[11px] opacity-85 truncate mt-0.5">
                {route.name} · {availableBuses.length} bus
                {availableBuses.length !== 1 ? 'es' : ''}
                {liveBuses.length > 0 ? ` · ${liveBuses.length} live` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={closeBusResults}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-primary-foreground/15 hover:bg-primary-foreground/25 shrink-0"
            >
              Edit
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-3">
          {nearestStop && (
            <div className="rounded-xl bg-card border border-border shadow-sm min-w-0 overflow-hidden">
              <div className="flex items-stretch min-w-0">
                {/* Get direction — left corner */}
                <button
                  type="button"
                  onClick={() => canGetDirections && setDirectionsOpen(true)}
                  disabled={!canGetDirections}
                  className="shrink-0 w-[4.75rem] flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground px-1.5 py-3 disabled:opacity-45 disabled:pointer-events-none hover:bg-primary/90 transition-colors"
                  aria-label="Get directions to boarding stop"
                >
                  <MapPinned className="w-5 h-5" />
                  <span className="text-[10px] font-bold leading-tight text-center">
                    Get
                    <br />
                    direction
                  </span>
                </button>

                <div className="min-w-0 flex-1 px-3 py-2.5 flex flex-col justify-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    {position ? 'Nearest boarding stop' : 'Your boarding stop'}
                  </p>
                  <p className="text-sm font-bold text-foreground truncate mt-0.5">
                    {nearestStop.stop.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {nearestStop.distanceLabel !== 'Selected stop' &&
                    nearestStop.distanceLabel !== '—'
                      ? `${nearestStop.distanceLabel}${position ? ' from you' : ''}`
                      : 'Your selected From stop'}
                    {boardingEta ? ` · Bus ETA ${boardingEta.etaLabel}` : ''}
                  </p>
                  {!canGetDirections && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                      Add stop coordinates to enable directions
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">
              {availableBuses.length > 0
                ? `${availableBuses.length} bus${availableBuses.length !== 1 ? 'es' : ''} found`
                : 'No buses found'}
            </h2>
            {liveBuses.length > 0 && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                {liveBuses.length} live
              </span>
            )}
          </div>

          {sortedBuses.length === 0 ? (
            <div className="rounded-2xl bg-card border border-border px-4 py-8 text-center shadow-sm">
              <div className="w-14 h-14 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                <Bus className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No buses on this route yet</p>
              <p className="text-sm text-muted-foreground mt-1.5">
                Buses appear when assigned to this route. Try again or pick another trip.
              </p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={closeBusResults}>
                Modify search
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBuses.map((bus) => (
                <BusResultCard
                  key={`${bus.id}-${bus.busNumber}`}
                  bus={bus}
                  fromStopName={fromStop.name}
                  toStopName={toStop.name}
                  routeName={route.name}
                  boardingHint={boardingHint}
                  etaLabel={boardingEta?.etaLabel}
                  isSelecting={selectingBusId === bus.id}
                  onSelect={() => handleSelectBus(bus.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {directionsTarget && (
        <DepotDirectionsSheet
          open={directionsOpen}
          onOpenChange={setDirectionsOpen}
          depotName={directionsTarget.name}
          depotLatitude={directionsTarget.latitude}
          depotLongitude={directionsTarget.longitude}
        />
      )}
    </div>
  );
};
