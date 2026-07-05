import { AvailableBus } from '@/utils/busSearch';
import { Bus, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BusResultCardProps {
  bus: AvailableBus;
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
  isSelecting,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSelecting}
      className={cn(
        'w-full text-left p-4 rounded-xl border bg-card border-border transition-all duration-200',
        'hover:shadow-card hover:border-primary/50 disabled:opacity-60'
      )}
    >
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
    </button>
  );
};
