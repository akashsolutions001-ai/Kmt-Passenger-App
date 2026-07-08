import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BusResultCard } from '@/components/BusResultCard';
import { DepotArrivalCard } from '@/components/DepotArrivalCard';
import { NearestStopBanner } from '@/components/NearestStopBanner';
import { Button } from '@/components/ui/button';
import { useUserGeolocation } from '@/hooks/useUserGeolocation';
import { findNearestStopOnRoute, hasCoordinates } from '@/utils/geo';
import { availableBusToFirestoreBus } from '@/utils/busSearch';
import { ArrowLeft, ArrowRight, Bus, MapPin } from 'lucide-react';

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
  const { position } = useUserGeolocation(true);

  const fromStop = bookableStops.find((s) => s.id === fromStopId);
  const toStop = bookableStops.find((s) => s.id === toStopId);

  const route = useMemo(() => {
    if (selectedRoute) return selectedRoute;
    if (!fromStop) return null;
    return routes.find((r) => r.id === fromStop.routeId) ?? null;
  }, [selectedRoute, fromStop, routes]);

  const fromRouteStop = route?.stops.find((s) => s.id === fromStopId);
  const toRouteStop = route?.stops.find((s) => s.id === toStopId);

  const nearestStop = useMemo(() => {
    if (!route || !fromRouteStop || !toRouteStop) return null;

    if (position) {
      return findNearestStopOnRoute(
        route.stops,
        position.latitude,
        position.longitude,
        { maxOrder: toRouteStop.order }
      );
    }

    if (hasCoordinates(fromRouteStop)) {
      return findNearestStopOnRoute(
        route.stops,
        fromRouteStop.latitude!,
        fromRouteStop.longitude!,
        { maxOrder: toRouteStop.order }
      );
    }

    const firstWithCoords = route.stops.find((s) => hasCoordinates(s));
    if (firstWithCoords) {
      return {
        stop: firstWithCoords,
        distanceM: 0,
        distanceLabel: '0 m',
      };
    }

    return null;
  }, [route, fromRouteStop, toRouteStop, position]);

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

  return (
    <div className="min-h-screen-safe bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 pt-4 pb-6 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto w-full">
          <button
            type="button"
            onClick={closeBusResults}
            className="flex items-center gap-1.5 text-sm opacity-90 hover:opacity-100 mb-3 -ml-1 py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Modify search
          </button>

          <div className="rounded-xl bg-primary-foreground/10 backdrop-blur px-4 py-3 border border-primary-foreground/20">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wide opacity-75">From</p>
                <p className="font-bold truncate">{fromStop.name}</p>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-70" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] uppercase tracking-wide opacity-75">To</p>
                <p className="font-bold truncate">{toStop.name}</p>
              </div>
            </div>
            <p className="text-xs opacity-80 mt-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {route.name}
              <span className="mx-1">·</span>
              <Bus className="w-3 h-3" />
              {availableBuses.length} bus{availableBuses.length !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-5 pb-8">
        {nearestStop && (
          <NearestStopBanner
            nearest={nearestStop}
            selectedFromName={fromStop.name}
            usingGps={!!position}
          />
        )}

        {!nearestStop && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground text-center">
            Enable location or add coordinates to stops to see the nearest boarding point.
          </div>
        )}

        <DepotArrivalCard route={route} boardingStopId={fromStop.id} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Available Buses
            </h2>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {availableBuses.length} found
            </span>
          </div>

          {availableBuses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No buses on this route right now. Try again later.
            </div>
          ) : (
            availableBuses.map((bus) => (
              <BusResultCard
                key={`${bus.id}-${bus.busNumber}`}
                bus={bus}
                fromStopName={fromStop.name}
                toStopName={toStop.name}
                routeName={route.name}
                isSelecting={selectingBusId === bus.id}
                onSelect={() => handleSelectBus(bus.id)}
              />
            ))
          )}
        </section>
      </main>
    </div>
  );
};
