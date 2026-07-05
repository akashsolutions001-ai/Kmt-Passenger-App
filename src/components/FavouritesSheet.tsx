import { useCallback, useEffect, useState } from 'react';
import { FavouriteTrip } from '@/types/firestore';
import { getPassengerByDocId, updatePassengerByDocId } from '@/services/firestore';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface FavouritesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passengerDocId: string;
  currentTrip?: {
    routeId: string;
    routeName: string;
    fromStopId: string;
    fromStopName: string;
    toStopId: string;
    toStopName: string;
  };
  onApplyTrip: (trip: FavouriteTrip) => void;
}

export const FavouritesSheet: React.FC<FavouritesSheetProps> = ({
  open,
  onOpenChange,
  passengerDocId,
  currentTrip,
  onApplyTrip,
}) => {
  const [trips, setTrips] = useState<FavouriteTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!passengerDocId) return;
    setLoading(true);
    try {
      const passenger = await getPassengerByDocId(passengerDocId);
      setTrips(passenger?.favouriteTrips ?? []);
    } catch (err) {
      console.error('Load favourites error:', err);
      toast.error('Could not load favourites');
    } finally {
      setLoading(false);
    }
  }, [passengerDocId]);

  useEffect(() => {
    if (open) loadTrips();
  }, [open, loadTrips]);

  const persistTrips = async (next: FavouriteTrip[]) => {
    await updatePassengerByDocId(passengerDocId, { favouriteTrips: next });
    setTrips(next);
  };

  const handleSaveCurrent = async () => {
    if (!currentTrip) {
      toast.error('Select From and To stops first');
      return;
    }

    const exists = trips.some(
      (t) =>
        t.routeId === currentTrip.routeId &&
        t.fromStopId === currentTrip.fromStopId &&
        t.toStopId === currentTrip.toStopId
    );
    if (exists) {
      toast.info('This trip is already in favourites');
      return;
    }

    const newTrip: FavouriteTrip = {
      ...currentTrip,
      savedAt: Date.now(),
    };

    setSaving(true);
    try {
      await persistTrips([newTrip, ...trips]);
      toast.success('Trip saved to favourites');
    } catch (err) {
      console.error('Save favourite error:', err);
      toast.error('Failed to save favourite');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (trip: FavouriteTrip) => {
    try {
      const next = trips.filter(
        (t) =>
          !(
            t.routeId === trip.routeId &&
            t.fromStopId === trip.fromStopId &&
            t.toStopId === trip.toStopId
          )
      );
      await persistTrips(next);
      toast.success('Removed from favourites');
    } catch {
      toast.error('Failed to remove favourite');
    }
  };

  const handleApply = (trip: FavouriteTrip) => {
    onApplyTrip(trip);
    onOpenChange(false);
    toast.success('Trip applied');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Favourite Trips
          </SheetTitle>
          <SheetDescription>Save and quickly reuse your frequent routes</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <Button
            className="w-full rounded-xl"
            variant="secondary"
            onClick={handleSaveCurrent}
            disabled={saving || !currentTrip}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Star className="h-4 w-4 mr-2" />
            )}
            Save current trip
          </Button>
        </div>

        <div className="mt-6 space-y-3 overflow-y-auto max-h-[calc(85vh-12rem)] pr-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : trips.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No saved trips yet. Select From & To, then tap &quot;Save current trip&quot;.
            </p>
          ) : (
            trips.map((trip) => (
              <div
                key={`${trip.routeId}-${trip.fromStopId}-${trip.toStopId}`}
                className="rounded-xl border border-border bg-card p-4 flex gap-3"
              >
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => handleApply(trip)}
                >
                  <p className="font-semibold text-foreground truncate">{trip.routeName}</p>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {trip.fromStopName} → {trip.toStopName}
                    </span>
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(trip)}
                  aria-label="Remove favourite"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
