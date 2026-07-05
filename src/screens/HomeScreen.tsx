import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { DepotArrivalCard } from '@/components/DepotArrivalCard';
import { BusResultCard } from '@/components/BusResultCard';
import { TripSearchCard } from '@/components/TripSearchCard';
import { AnnouncementsSheet } from '@/components/AnnouncementsSheet';
import { ComplaintDialog } from '@/components/ComplaintDialog';
import { FavouritesSheet } from '@/components/FavouritesSheet';
import { FavouriteTrip } from '@/types/firestore';
import { isSameRoute, isValidTrip } from '@/utils/tripStops';
import {
  AvailableBus,
  availableBusToFirestoreBus,
  fetchAvailableBusesForRoute,
} from '@/utils/busSearch';
import { Bus, LogOut, Star, Megaphone, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';

export const HomeScreen: React.FC = () => {
  const {
    routes,
    bookableStops,
    selectedRoute,
    selectRoute,
    selectBus,
    selectFromStop,
    selectToStop,
    fromStopId,
    toStopId,
    confirmSelection,
    isLoggedIn,
    passenger,
    student,
    logout,
  } = useAuth();

  const profile = passenger ?? student;
  const [isSearching, setIsSearching] = useState(false);
  const [selectingBusId, setSelectingBusId] = useState<string | null>(null);
  const [availableBuses, setAvailableBuses] = useState<AvailableBus[] | null>(null);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [favouritesOpen, setFavouritesOpen] = useState(false);

  const fromStop = bookableStops.find((s) => s.id === fromStopId);
  const toStop = bookableStops.find((s) => s.id === toStopId);

  const matchedRoutes = useMemo(() => {
    if (!fromStop || !toStop) return [];
    const route = routes.find((r) => r.id === fromStop.routeId);
    if (!route || !isValidTrip(fromStop, toStop, route.stops)) return [];
    return [route];
  }, [routes, fromStop, toStop]);

  const tripError = useMemo(() => {
    if (!fromStop || !toStop) return null;
    if (!isSameRoute(fromStop, toStop)) {
      return 'These stops are on different routes. Pick From and To on the same route.';
    }
    const route = routes.find((r) => r.id === fromStop.routeId);
    if (route && !isValidTrip(fromStop, toStop, route.stops)) {
      return 'Destination must be after your boarding stop on the route (e.g. ROOM → Mug Dukkan, not the reverse).';
    }
    return null;
  }, [routes, fromStop, toStop]);

  const activeRoute = useMemo(() => {
    if (!fromStop || matchedRoutes.length === 0) return null;
    if (selectedRoute?.id === fromStop.routeId) return selectedRoute;
    return matchedRoutes[0];
  }, [fromStop, matchedRoutes, selectedRoute]);

  const handleSearch = async () => {
    if (!fromStopId || !toStopId || matchedRoutes.length === 0) return;

    const route = matchedRoutes[0];
    setIsSearching(true);
    setAvailableBuses(null);

    try {
      selectRoute(route.id);
      const buses = await fetchAvailableBusesForRoute(route.id, route.name);
      setAvailableBuses(buses);
      if (buses.length === 0) {
        toast.info('No buses found on this route right now');
      }
    } catch {
      toast.error('Could not load buses. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectBus = async (bus: AvailableBus) => {
    setSelectingBusId(bus.id);
    try {
      selectBus(availableBusToFirestoreBus(bus));
      await confirmSelection();
    } finally {
      setSelectingBusId(null);
    }
  };

  const handleFromChange = (stopId: string) => {
    setAvailableBuses(null);
    selectFromStop(stopId);
  };

  const handleToChange = (stopId: string) => {
    setAvailableBuses(null);
    selectToStop(stopId);
  };

  const firstName = profile?.name?.split(' ')[0] ?? 'Traveller';

  const currentTrip =
    fromStop && toStop && matchedRoutes.length > 0
      ? {
          routeId: fromStop.routeId,
          routeName: fromStop.routeName,
          fromStopId: fromStop.id,
          fromStopName: fromStop.name,
          toStopId: toStop.id,
          toStopName: toStop.name,
        }
      : undefined;

  const handleApplyFavourite = (trip: FavouriteTrip) => {
    setAvailableBuses(null);
    selectRoute(trip.routeId);
    selectFromStop(trip.fromStopId);
    selectToStop(trip.toStopId);
  };

  return (
    <div className="min-h-screen-safe bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 pt-5 pb-16">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div>
            <h1 className="text-xl font-bold">KMT Bus Tracker</h1>
            <p className="text-sm opacity-90">
              {isLoggedIn ? `Hi ${firstName}, where are you going?` : 'Kolhapur Municipal Transport'}
            </p>
          </div>
          {isLoggedIn && (
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full shrink-0"
              onClick={logout}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 -mt-10 pb-8 max-w-lg mx-auto w-full space-y-6">
        <TripSearchCard
          stops={bookableStops}
          fromStopId={fromStopId}
          toStopId={toStopId}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          onSearch={handleSearch}
          canSearch={!!fromStopId && !!toStopId && matchedRoutes.length > 0}
          isSearching={isSearching}
        />

        {tripError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-900 dark:text-amber-100">
            {tripError}
          </div>
        )}

        {fromStop && toStop && matchedRoutes.length > 0 && (
          <div className="rounded-xl bg-secondary/60 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Your trip</p>
            <p className="font-semibold text-foreground mt-0.5">
              {fromStop.name} → {toStop.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{fromStop.routeName}</p>
          </div>
        )}

        {fromStop && toStop && activeRoute && availableBuses !== null && (
          <DepotArrivalCard route={activeRoute} boardingStopId={fromStop.id} />
        )}

        {availableBuses !== null && (
          <section className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Available Buses ({availableBuses.length})
            </h2>
            {availableBuses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No buses are assigned to this route yet. Try again later or pick a different trip.
              </div>
            ) : (
              availableBuses.map((bus) => (
                <BusResultCard
                  key={`${bus.id}-${bus.busNumber}`}
                  bus={bus}
                  isSelecting={selectingBusId === bus.id}
                  onSelect={() => handleSelectBus(bus)}
                />
              ))
            )}
          </section>
        )}

        {isLoggedIn && profile && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              size="sm"
              onClick={() => setFavouritesOpen(true)}
            >
              <Star className="h-4 w-4 mr-1" /> Favourites
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              size="sm"
              onClick={() => setAnnouncementsOpen(true)}
            >
              <Megaphone className="h-4 w-4 mr-1" /> Alerts
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              size="sm"
              onClick={() => setComplaintOpen(true)}
            >
              <MessageSquareWarning className="h-4 w-4 mr-1" /> Complaint
            </Button>
          </div>
        )}

        <AnnouncementsSheet open={announcementsOpen} onOpenChange={setAnnouncementsOpen} />

        {profile && (
          <>
            <FavouritesSheet
              open={favouritesOpen}
              onOpenChange={setFavouritesOpen}
              passengerDocId={profile.id}
              currentTrip={currentTrip}
              onApplyTrip={handleApplyFavourite}
            />
            <ComplaintDialog
              open={complaintOpen}
              onOpenChange={setComplaintOpen}
              passengerId={profile.id}
              passengerName={profile.name}
              routeId={fromStop?.routeId ?? selectedRoute?.id}
              routeName={fromStop?.routeName ?? selectedRoute?.name}
              stopId={fromStopId}
              stopName={fromStop?.name}
            />
          </>
        )}

        {bookableStops.length > 0 && (
          <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Bus className="h-3.5 w-3.5" />
            {bookableStops.length} stops across {routes.length} routes
          </p>
        )}
      </main>
    </div>
  );
};
