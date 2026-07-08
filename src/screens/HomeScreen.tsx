import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { TripSearchCard } from '@/components/TripSearchCard';
import { AnnouncementsSheet } from '@/components/AnnouncementsSheet';
import { ComplaintDialog } from '@/components/ComplaintDialog';
import { FavouritesSheet } from '@/components/FavouritesSheet';
import { FavouriteTrip } from '@/types/firestore';
import { isSameRoute, isValidTrip } from '@/utils/tripStops';
import { fetchAvailableBusesForRoute } from '@/utils/busSearch';
import { Bus, LogOut, Star, Megaphone, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';

export const HomeScreen: React.FC = () => {
  const {
    routes,
    bookableStops,
    selectRoute,
    selectFromStop,
    selectToStop,
    fromStopId,
    toStopId,
    showBusResults,
    isLoggedIn,
    passenger,
    student,
    logout,
  } = useAuth();

  const profile = passenger ?? student;
  const [isSearching, setIsSearching] = useState(false);
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

  const handleSearch = async () => {
    if (!fromStopId || !toStopId || matchedRoutes.length === 0) return;

    const route = matchedRoutes[0];
    setIsSearching(true);

    try {
      selectRoute(route.id);
      const buses = await fetchAvailableBusesForRoute(route.id, route.name);
      if (buses.length === 0) {
        toast.info('No buses found on this route right now');
      }
      showBusResults(buses);
    } catch {
      toast.error('Could not load buses. Please try again.');
    } finally {
      setIsSearching(false);
    }
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
          onFromChange={selectFromStop}
          onToChange={selectToStop}
          onSearch={handleSearch}
          canSearch={!!fromStopId && !!toStopId && matchedRoutes.length > 0}
          isSearching={isSearching}
        />

        {tripError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-900 dark:text-amber-100">
            {tripError}
          </div>
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
              routeId={fromStop?.routeId}
              routeName={fromStop?.routeName}
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
