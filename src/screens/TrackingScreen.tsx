import { useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { BusStatusCard } from '@/components/BusStatusCard';
import { StopCard } from '@/components/StopCard';
import { LiveBusMap, BusPosition, StopMarker } from '@/components/LiveBusMap';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { StopStatus } from '@/types/student';
import { estimateArrivalAtStop } from '@/utils/geo';
import { resolveStopCoordinates } from '@/utils/mapCoordinates';
import { MapPin, Bus, User, BadgeCheck, ArrowLeft, Search } from 'lucide-react';

export const TrackingScreen: React.FC = () => {
  const {
    student,
    selectedRoute,
    fromStopId,
    toStopId,
    liveBus,
    realtimeLocation,
    realtimeRouteState,
    realtimeCurrentStop,
    realtimeStops,
    busState,
    refreshTracking,
    backToSearch,
  } = useAuth();

  if (!selectedRoute) return null;

  const profile = student;

  // Check if route completion was more than 30 minutes ago - if so, reset to pending
  const isCompletedButExpired = (): boolean => {
    if (busState.status !== 'completed') return false;
    const now = new Date();
    const lastUpdated = busState.lastUpdated;
    const timeDiffMs = now.getTime() - lastUpdated.getTime();
    const thirtyMinutesMs = 30 * 60 * 1000; // 30 minutes in milliseconds
    return timeDiffMs > thirtyMinutesMs;
  };

  const getStopStatus = (index: number): StopStatus => {
    const stop = selectedRoute.stops[index];
    if (!stop) return 'pending';

    // If route was completed more than 30 minutes ago, reset all stops to pending
    if (isCompletedButExpired()) {
      return 'pending';
    }

    // Prefer RTDB stops for per-stop status.
    // Try multiple matching strategies since RTDB keys may differ from route stop IDs.
    if (realtimeStops) {
      let rtdbStatus: string | undefined;

      // 1. Direct key match (e.g., key "1-1" matches stop.id "1-1")
      if (typeof realtimeStops[stop.id]?.status === 'string') {
        rtdbStatus = realtimeStops[stop.id].status;
      }

      // 2. Search by stopId field or name match
      if (!rtdbStatus) {
        const lowerName = stop.name.toLowerCase().trim();
        for (const entry of Object.values(realtimeStops)) {
          if (!entry) continue;
          // Match by stopId field
          if (entry.stopId === stop.id && typeof entry.status === 'string') {
            rtdbStatus = entry.status;
            break;
          }
          // Match by name (case-insensitive)
          if (entry.name && entry.name.toLowerCase().trim() === lowerName && typeof entry.status === 'string') {
            rtdbStatus = entry.status;
            break;
          }
          // Match by order
          if (typeof entry.order === 'number' && entry.order === stop.order && typeof entry.status === 'string') {
            rtdbStatus = entry.status;
            break;
          }
        }
      }

      if (rtdbStatus === 'reached' || rtdbStatus === 'current' || rtdbStatus === 'pending') {
        return rtdbStatus as StopStatus;
      }
    }

    if (busState.status === 'not-started') return 'pending';
    if (busState.status === 'completed') return 'reached';
    if (index < busState.currentStopIndex) return 'reached';
    if (index === busState.currentStopIndex) return 'current';
    return 'pending';
  };

  // Get effective bus status - reset to not-started if completion expired
  const effectiveStatus = isCompletedButExpired() ? 'not-started' : busState.status;

  const boardingStopId = fromStopId ?? profile?.selectedFromStopId ?? profile?.selectedStopId;
  const destinationStopId = toStopId ?? profile?.selectedToStopId;

  const fromStop = boardingStopId
    ? selectedRoute.stops.find((s) => s.id === boardingStopId)
    : undefined;
  const toStop = destinationStopId
    ? selectedRoute.stops.find((s) => s.id === destinationStopId)
    : undefined;

  const visibleStops = useMemo(() => {
    if (!fromStop || !toStop) return selectedRoute.stops;
    return selectedRoute.stops.filter(
      (s) => s.order >= fromStop.order && s.order <= toStop.order
    );
  }, [selectedRoute.stops, fromStop, toStop]);

  const busLocation = useMemo(() => {
    if (realtimeLocation?.latitude == null || realtimeLocation?.longitude == null) return null;
    return {
      latitude: realtimeLocation.latitude,
      longitude: realtimeLocation.longitude,
    };
  }, [realtimeLocation?.latitude, realtimeLocation?.longitude]);

  const currentStopIndex = useMemo(() => {
    for (let i = 0; i < selectedRoute.stops.length; i++) {
      if (getStopStatus(i) === 'current') return i;
    }
    if (effectiveStatus === 'not-started') return -1;
    for (let i = selectedRoute.stops.length - 1; i >= 0; i--) {
      if (getStopStatus(i) === 'reached') return i;
    }
    return busState.currentStopIndex;
  }, [
    selectedRoute.stops,
    realtimeStops,
    busState.status,
    busState.currentStopIndex,
    busState.lastUpdated,
    effectiveStatus,
  ]);

  const busStarted = effectiveStatus !== 'not-started';
  const busNumber = realtimeLocation?.busNumber ?? liveBus?.busNumber;
  const driverName = realtimeLocation?.driverName ?? liveBus?.driverName;
  const gpsText =
    realtimeLocation?.latitude != null && realtimeLocation?.longitude != null
      ? `${realtimeLocation.latitude.toFixed(6)}, ${realtimeLocation.longitude.toFixed(6)}`
      : null;
  const currentStopText = realtimeCurrentStop?.name ?? null;

  // Transform realtime location to BusPosition for map
  const busPosition: BusPosition | null = useMemo(() => {
    if (!realtimeLocation?.latitude || !realtimeLocation?.longitude) return null;

    // Don't show on map if completed and expired
    if (isCompletedButExpired()) return null;

    // Don't show bus position if bus hasn't started yet (prevents showing old RTDB data)
    const currentRouteState = realtimeRouteState ?? realtimeLocation.routeState;
    if (currentRouteState === 'not_started' || currentRouteState === undefined) {
      return null;
    }

    return {
      latitude: realtimeLocation.latitude,
      longitude: realtimeLocation.longitude,
      accuracy: realtimeLocation.accuracy,
      timestamp: realtimeLocation.updatedAt ?? realtimeLocation.timestamp ?? Date.now(),
    };
  }, [realtimeLocation, realtimeRouteState, busState.status, busState.lastUpdated]);

  // Transform route stops to map markers (with static coordinates for demo)
  // In production, these would come from Firestore route data with actual coordinates
  const stopMarkers: StopMarker[] = useMemo(() => {
    return visibleStops
      .map((stop) => {
        const coords = resolveStopCoordinates(stop);
        if (!coords) return null;

        const index = selectedRoute.stops.findIndex((s) => s.id === stop.id);
        const status = getStopStatus(index);

        return {
          id: stop.id,
          name: stop.name,
          latitude: coords.latitude,
          longitude: coords.longitude,
          order: stop.order,
          status,
          isStudentStop: stop.id === boardingStopId,
        };
      })
      .filter((marker): marker is StopMarker => marker !== null);
  }, [
    visibleStops,
    selectedRoute.stops,
    boardingStopId,
    realtimeStops,
    busState.status,
    busState.currentStopIndex,
    busState.lastUpdated,
    effectiveStatus,
  ]);

  // Get route state for map
  const routeStateForMap = useMemo(() => {
    if (isCompletedButExpired()) return 'not_started';
    if (realtimeRouteState === 'in_progress') return 'in_progress';
    if (realtimeRouteState === 'completed') return 'completed';
    if (effectiveStatus === 'running') return 'in_progress';
    if (effectiveStatus === 'completed') return 'completed';
    return 'not_started';
  }, [realtimeRouteState, effectiveStatus, busState.status, busState.lastUpdated]);

  // Reached time (ms) for a stop when status is 'reached' – from RTDB, shown until next trip
  const getReachedAt = (stopId: string, order: number, stopName?: string): number | undefined => {
    if (isCompletedButExpired()) return undefined;
    if (!realtimeStops) return undefined;
    // Try direct key, then key without "stop-" prefix, then find by stopId/order/name
    let entry = realtimeStops[stopId];
    if (!entry && stopId.startsWith('stop-')) {
      entry = realtimeStops[stopId.replace(/^stop-/, '')];
    }
    if (!entry) {
      const lowerName = stopName?.toLowerCase().trim();
      const byMatch = Object.entries(realtimeStops).find(
        ([_, e]) =>
          e?.stopId === stopId ||
          e?.order === order ||
          (lowerName && e?.name && e.name.toLowerCase().trim() === lowerName)
      );
      entry = byMatch?.[1];
    }
    if (!entry || entry.status !== 'reached') return undefined;
    const t = entry.reachedAt ?? entry.updatedAt;
    if (t == null) return undefined;
    return t > 1e12 ? t : t * 1000; // treat as seconds if small
  };

  // Fallback reached time when RTDB has no updatedAt (use last bus state update so something shows)
  const fallbackReachedAt = busState.lastUpdated.getTime();

  // Refresh bus location every 2 seconds so the map marker updates
  useEffect(() => {
    const interval = setInterval(refreshTracking, 2000);
    return () => clearInterval(interval);
  }, [refreshTracking]);

  return (
    <div className="min-h-screen-safe bg-background flex flex-col overflow-hidden">
      {/* Header - do not shrink */}
      <header className="flex-shrink-0 bg-card border-b border-border px-4 py-4 sticky top-0 z-10 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={backToSearch}
              className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors shrink-0"
              aria-label="Back to search"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-foreground truncate">{profile?.name ?? 'KMT Passenger'}</h1>
              <p className="text-xs text-muted-foreground">Passenger</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </div>

        {/* Route, From/To & Bus info */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 [contain:layout]">
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg min-w-0">
            <Bus className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Route</p>
              <p className="text-sm font-medium text-foreground truncate">
                {selectedRoute.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 min-w-0">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-primary/80">From</p>
              <p className="text-sm font-medium text-primary truncate">
                {fromStop?.name ?? 'Boarding stop'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20 min-w-0">
            <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-accent/80">To</p>
              <p className="text-sm font-medium text-foreground truncate">
                {toStop?.name ?? 'Destination'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg min-w-0">
            <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bus & Driver</p>
              <p className="text-xs font-medium text-foreground truncate">
                {busNumber ?? 'Bus not assigned'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {driverName ?? 'Driver not assigned'}
              </p>
              {gpsText && (
                <p className="text-[11px] text-muted-foreground truncate">
                  GPS: {gpsText}
                </p>
              )}
              {realtimeRouteState && (
                <p className="text-[11px] text-muted-foreground truncate">
                  State: {realtimeRouteState}
                </p>
              )}
              {currentStopText && (
                <p className="text-[11px] text-muted-foreground truncate">
                  Current stop: {currentStopText}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content - min-h-0 needed for flex + overflow scroll */}
      <main className="flex-1 min-h-0 px-4 py-6 overflow-y-auto overflow-x-hidden">
        {/* Bus Status */}
        <BusStatusCard status={effectiveStatus} lastUpdated={busState.lastUpdated} />

        {/* Route Progress (stops name) */}
        <div className="mt-6 [contain:layout]">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
            Route Progress
          </h2>

          <div className="space-y-2">
            {visibleStops.map((stop) => {
              const index = selectedRoute.stops.findIndex((s) => s.id === stop.id);
              const status = getStopStatus(index);
              const arrivalEstimate =
                status === 'reached'
                  ? null
                  : estimateArrivalAtStop(
                      selectedRoute.stops,
                      index,
                      currentStopIndex,
                      busLocation,
                      busStarted
                    );
              return (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  status={status}
                  isStudentStop={stop.id === boardingStopId}
                  isLast={stop.id === visibleStops[visibleStops.length - 1]?.id}
                  busStatus={effectiveStatus}
                  reachedAt={
                    status === 'reached'
                      ? getReachedAt(stop.id, stop.order, stop.name) ?? fallbackReachedAt
                      : undefined
                  }
                  estimatedArrivalTime={arrivalEstimate?.arrivalTime}
                  estimatedArrivalEta={arrivalEstimate?.etaLabel}
                  showReachBy={status === 'current'}
                />
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl sm:flex-1"
              onClick={backToSearch}
            >
              <Search className="w-4 h-4 mr-2" />
              Search other buses
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full h-11 rounded-xl sm:flex-1"
              onClick={refreshTracking}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Live Bus Map - below stops */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
            Live Bus Location
          </h2>
          <LiveBusMap
            busPosition={busPosition}
            busNumber={busNumber}
            driverName={driverName}
            routeState={routeStateForMap}
            stops={stopMarkers}
            studentStopId={boardingStopId}
            height={320}
            autoCenter={false}
            showPath={true}
            showRouteLine={true}
            maxPathPoints={100}
          />
          {stopMarkers.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Add latitude and longitude on route stops (or in the stops catalog via catalogStopId) to show them on the map.
            </p>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};
