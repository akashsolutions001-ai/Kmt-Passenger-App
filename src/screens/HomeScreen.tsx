import { useState } from 'react';
import { useStudent } from '@/context/StudentContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RouteCard } from '@/components/RouteCard';
import { StopSelectCard } from '@/components/StopSelectCard';
import { Search, Bus, MapPin, Star, Megaphone, MessageSquareWarning, LogIn } from 'lucide-react';

interface HomeScreenProps {
  onOpenLogin?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenLogin }) => {
  const {
    routes,
    selectedRoute,
    selectRoute,
    selectStop,
    confirmSelection,
    isLoggedIn,
    passenger,
    student,
  } = useStudent();

  const profile = passenger ?? student;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'route' | 'stop' | 'bus'>('route');
  const [selectedStopId, setSelectedStopId] = useState<string | undefined>();

  const filteredRoutes = routes.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStopPick = (stopId: string) => {
    setSelectedStopId(stopId);
    selectStop(stopId);
  };

  const handleTrack = () => {
    if (selectedRoute && selectedStopId) {
      confirmSelection();
    } else if (selectedRoute) {
      selectRoute(selectedRoute.id);
      confirmSelection();
    }
  };

  return (
    <div className="min-h-screen-safe bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">KMT Bus Tracker</h1>
            <p className="text-sm opacity-90">Kolhapur Municipal Transport</p>
          </div>
          {!isLoggedIn && onOpenLogin && (
            <Button variant="secondary" size="sm" onClick={onOpenLogin}>
              <LogIn className="h-4 w-4 mr-1" /> Login
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 max-w-lg mx-auto w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 h-12 rounded-xl"
            placeholder="Search route, stop, or bus number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          {(['route', 'stop', 'bus'] as const).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={searchMode === mode ? 'default' : 'outline'}
              onClick={() => setSearchMode(mode)}
              className="flex-1 capitalize"
            >
              {mode === 'route' && <MapPin className="h-3 w-3 mr-1" />}
              {mode === 'stop' && <MapPin className="h-3 w-3 mr-1" />}
              {mode === 'bus' && <Bus className="h-3 w-3 mr-1" />}
              {mode}
            </Button>
          ))}
        </div>

        {searchMode === 'route' && (
          <section className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Select Route</h2>
            {filteredRoutes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={selectedRoute?.id === route.id}
                onSelect={() => selectRoute(route.id)}
              />
            ))}
          </section>
        )}

        {searchMode === 'stop' && selectedRoute && (
          <section className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Select Bus Stop</h2>
            {selectedRoute.stops.map((stop) => (
              <StopSelectCard
                key={stop.id}
                stop={stop}
                isSelected={selectedStopId === stop.id}
                onSelect={() => handleStopPick(stop.id)}
              />
            ))}
          </section>
        )}

        {searchMode === 'bus' && (
          <section className="glass-card p-4 text-sm text-muted-foreground">
            Enter a bus number in the search box (e.g. KMT-001) and select a matching route to track live.
          </section>
        )}

        {selectedRoute && (
          <Button className="w-full h-12 rounded-xl text-base font-semibold" onClick={handleTrack}>
            Track Live Bus
          </Button>
        )}

        {isLoggedIn && profile && (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" size="sm">
              <Star className="h-4 w-4 mr-1" /> Favourites
            </Button>
            <Button variant="outline" className="flex-1" size="sm">
              <Megaphone className="h-4 w-4 mr-1" /> Announcements
            </Button>
            <Button variant="outline" className="flex-1" size="sm">
              <MessageSquareWarning className="h-4 w-4 mr-1" /> Complaint
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};
