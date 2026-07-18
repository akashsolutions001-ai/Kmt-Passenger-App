import { AvailableBus } from '@/utils/busSearch';
import { Bus, ChevronRight, User, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BusResultCardProps {
  bus: AvailableBus;
  fromStopName?: string;
  toStopName?: string;
  routeName?: string;
  boardingHint?: string;
  etaLabel?: string;
  isSelecting?: boolean;
  onSelect: () => void;
}

const statusMeta: Record<
  AvailableBus['status'],
  { label: string; className: string }
> = {
  idle: {
    label: 'Scheduled',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  running: {
    label: 'On road',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  },
  stopped: {
    label: 'Stopped',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
  maintenance: {
    label: 'Unavailable',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  },
};

export const BusResultCard: React.FC<BusResultCardProps> = ({
  bus,
  fromStopName,
  toStopName,
  routeName,
  boardingHint,
  etaLabel,
  isSelecting,
  onSelect,
}) => {
  const meta = statusMeta[bus.status];
  const statusLabel = bus.isLive ? 'Live now' : meta.label;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSelecting || bus.status === 'maintenance'}
      className={cn(
        'w-full text-left rounded-2xl border bg-card border-border shadow-sm overflow-hidden',
        'transition-all duration-200 hover:border-primary/40 hover:shadow-md',
        'disabled:opacity-55 disabled:pointer-events-none'
      )}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                {bus.busNumber}
              </h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                  bus.isLive
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : meta.className
                )}
              >
                {bus.isLive && <Radio className="w-3 h-3" />}
                {statusLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {routeName ?? 'City bus'}
              {bus.driverName ? ` · ${bus.driverName}` : ''}
            </p>
          </div>

          <div className="text-right shrink-0">
            {etaLabel ? (
              <>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Est. arrival
                </p>
                <p className="text-xl font-bold text-primary leading-tight">{etaLabel}</p>
              </>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bus className="w-5 h-5 text-primary" />
              </div>
            )}
          </div>
        </div>

        {(fromStopName || toStopName) && (
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="w-px h-5 bg-border" />
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-foreground truncate">
                  {fromStopName ?? 'Boarding'}
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {toStopName ?? 'Destination'}
                </p>
              </div>
            </div>
            {boardingHint && (
              <p className="text-[11px] text-muted-foreground mt-2 pl-4">
                Board near: {boardingHint}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0 truncate">
            <User className="w-3.5 h-3.5 shrink-0" />
            {bus.driverName ? `Driver: ${bus.driverName}` : 'Tap to track this bus'}
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary shrink-0">
            {isSelecting ? 'Opening…' : 'Track'}
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
};
