import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { TripSearchCard } from '@/components/TripSearchCard';
import { isSameRoute, isValidTrip } from '@/utils/tripStops';
import { RouteCard } from '@/components/RouteCard';
import { ArrowLeft, ArrowRight, Check, MapPin, Bus } from 'lucide-react';

type SetupStep = 'trip' | 'confirm';

export const SetupScreen: React.FC = () => {
  const {
    routes,
    bookableStops,
    selectedRoute,
    selectRoute,
    selectFromStop,
    selectToStop,
    fromStopId,
    toStopId,
    confirmSelection,
  } = useAuth();
  const [step, setStep] = useState<SetupStep>('trip');
  const [isSearching, setIsSearching] = useState(false);

  const fromStop = bookableStops.find((s) => s.id === fromStopId);
  const toStop = bookableStops.find((s) => s.id === toStopId);

  const matchedRoutes = useMemo(() => {
    if (!fromStop || !toStop) return [];
    const route = routes.find((r) => r.id === fromStop.routeId);
    if (!route || !isValidTrip(fromStop, toStop, route.stops)) return [];
    return [route];
  }, [routes, fromStop, toStop]);

  const handleSearch = async () => {
    if (!fromStopId || !toStopId || matchedRoutes.length === 0) return;
    setIsSearching(true);
    try {
      selectRoute(matchedRoutes[0].id);
      setStep('confirm');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    confirmSelection();
  };

  return (
    <div className="min-h-screen-safe bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {step === 'confirm' && (
            <button
              onClick={() => setStep('trip')}
              className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {step === 'trip' ? 'Plan Your Trip' : 'Confirm Selection'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === 'trip' ? 'Select from and to stops' : 'Review before tracking'}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto">
        {step === 'trip' && (
          <div className="space-y-4 animate-fade-in">
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
            {matchedRoutes.length > 1 && (
              <div className="space-y-2">
                {matchedRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isSelected={selectedRoute?.id === route.id}
                    onSelect={() => selectRoute(route.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && selectedRoute && fromStop && toStop && (
          <div className="animate-slide-up space-y-4">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 mx-auto mb-4">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-semibold text-center text-foreground mb-6">Ready to go!</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                  <Bus className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Route</p>
                    <p className="font-semibold">{selectedRoute.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">From</p>
                    <p className="font-semibold">{fromStop.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                  <MapPin className="w-5 h-5 text-rose-500" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">To</p>
                    <p className="font-semibold">{toStop.name}</p>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={handleConfirm}
              className="w-full h-12 rounded-xl font-semibold bg-success hover:bg-success/90"
            >
              <Check className="w-5 h-5 mr-2" />
              Start Tracking
            </Button>
          </div>
        )}
      </main>

      {step === 'trip' && (
        <footer className="bg-card border-t border-border p-4 sticky bottom-0">
          <Button
            onClick={handleSearch}
            disabled={!fromStopId || !toStopId || matchedRoutes.length === 0 || isSearching}
            className="w-full h-12 rounded-xl text-base font-semibold"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </footer>
      )}
    </div>
  );
};
