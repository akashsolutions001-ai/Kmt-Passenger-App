import { AvailableBus } from '@/utils/busSearch';
import { Bus, ChevronRight, User, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BusResultCardProps {
  bus: AvailableBus;
  fromStopName?: string;
  toStopName?: string;
  routeName?: string;
  isSelecting?: boolean;
  onSelect: () => void;
}

const statusLabel: Record<AvailableBus['status'], string> = {
  idle: 'Idle',
  running: 'Running',
  stopped: 'Stopped',
  maintenance: 'Maintenance',
};

const statusClass: Record<AvailableBus['status'], string> = {
  idle: 'bg-muted text-muted-foreground',
  running: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  stopped: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  maintenance: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
};

export const BusResultCard: React.FC<BusResultCardProps> = ({
  bus,
  fromStopName,
  toStopName,
  routeName,
  isSelecting,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSelecting}
      className={cn(
        'w-full text-left rounded-xl border bg-card border-border transition-all duration-200 overflow-hidden',
        'hover:shadow-card hover:border-primary/50 disabled:opacity-60'
      )}
    >
      {fromStopName && toStopName && (
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium text-foreground">{fromStopName}</span>
          <span>→</span>
          <span className="truncate font-medium text-foreground">{toStopName}</span>
          {routeName && (
            <span className="ml-auto text-[10px] uppercase tracking-wide shrink-0 hidden sm:inline">
              {routeName}
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Bus className="w-5 h-5 text-primary" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{bus.busNumber}</h3>
              <span
                className={cn(
                  'text-[11px] font-medium px-2 py-0.5 rounded-full',
                  statusClass[bus.status]
                )}
              >
                {bus.isLive ? 'Live' : statusLabel[bus.status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
              <User className="w-3.5 h-3.5 shrink-0" />
              {bus.driverName ?? 'Driver not assigned'}
            </p>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </div>
      </div>
    </button>
  );
};
