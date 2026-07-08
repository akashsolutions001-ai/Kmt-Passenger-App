import { NearestStopResult } from '@/utils/geo';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NearestStopBannerProps {
  nearest: NearestStopResult;
  selectedFromName: string;
  usingGps: boolean;
  className?: string;
}

export const NearestStopBanner: React.FC<NearestStopBannerProps> = ({
  nearest,
  selectedFromName,
  usingGps,
  className,
}) => {
  const isSameAsSelected =
    nearest.stop.name.toLowerCase().trim() === selectedFromName.toLowerCase().trim();

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-md">
          <MapPin className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
            {usingGps ? 'Nearest stop to you' : 'Nearest stop on route'}
          </p>
          <p className="text-xl font-bold text-foreground mt-0.5 truncate">{nearest.stop.name}</p>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            {nearest.distanceLabel} away
            {usingGps ? ' from your location' : ` from ${selectedFromName}`}
          </p>
          {!isSameAsSelected && (
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-2 bg-amber-100/80 dark:bg-amber-950/40 rounded-lg px-2.5 py-1.5">
              You selected <strong>{selectedFromName}</strong> — this stop is closer to you.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
