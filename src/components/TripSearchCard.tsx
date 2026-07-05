import { useMemo, useState } from 'react';
import { BookableStop } from '@/types/student';
import { getDestinationStops } from '@/utils/tripStops';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ArrowDownUp, Bus, Check, ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TripSearchCardProps {
  stops: BookableStop[];
  fromStopId?: string;
  toStopId?: string;
  onFromChange: (stopId: string) => void;
  onToChange: (stopId: string) => void;
  onSearch: () => void;
  canSearch: boolean;
  isSearching?: boolean;
}

function StopField({
  label,
  placeholder,
  value,
  options,
  allStops,
  onSelect,
  disabled,
  dotClass,
}: {
  label: string;
  placeholder: string;
  value?: string;
  options: BookableStop[];
  allStops: BookableStop[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  dotClass: string;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    options.find((s) => s.id === value) ?? allStops.find((s) => s.id === value);

  return (
    <div className="flex gap-3 items-start py-3">
      <div className={cn('mt-2 h-3 w-3 rounded-full shrink-0', dotClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          {label}
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              className="w-full justify-between h-auto py-1 px-0 hover:bg-transparent font-normal"
            >
              <span className={cn('text-left truncate text-base', !selected && 'text-muted-foreground')}>
                {selected ? selected.name : placeholder}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-2rem,360px)] p-0" align="start">
            <Command shouldFilter={true}>
              <CommandInput placeholder={`Search ${label.toLowerCase()} stop...`} />
              <CommandList>
                <CommandEmpty>No stops found.</CommandEmpty>
                <CommandGroup>
                  {options.map((stop) => (
                    <CommandItem
                      key={stop.id}
                      value={stop.id}
                      keywords={[stop.name, stop.routeName]}
                      onSelect={() => {
                        onSelect(stop.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === stop.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{stop.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{stop.routeName}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selected && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{selected.routeName}</p>
        )}
      </div>
    </div>
  );
}

export const TripSearchCard: React.FC<TripSearchCardProps> = ({
  stops,
  fromStopId,
  toStopId,
  onFromChange,
  onToChange,
  onSearch,
  canSearch,
  isSearching = false,
}) => {
  const fromStop = stops.find((s) => s.id === fromStopId);

  const toOptions = useMemo(() => {
    if (!fromStop) return [];
    return getDestinationStops(fromStop, stops);
  }, [stops, fromStop]);

  const handleSwap = () => {
    if (!fromStopId || !toStopId) return;
    const from = stops.find((s) => s.id === fromStopId);
    const to = stops.find((s) => s.id === toStopId);
    if (!from || !to || from.routeId !== to.routeId) return;
    if (from.order >= to.order) return;
    onFromChange(toStopId);
    onToChange(fromStopId);
  };

  if (stops.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-elevated border border-border p-6 text-center">
        <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium text-foreground">No stops available yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Admin needs to add stops in the Firestore <code className="text-xs">stops</code> collection.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-elevated border border-border overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <StopField
          label="From"
          placeholder="Boarding point"
          value={fromStopId}
          options={stops}
          allStops={stops}
          onSelect={onFromChange}
          dotClass="bg-emerald-500"
        />

        <div className="relative flex items-center justify-center py-1">
          <div className="absolute inset-x-0 border-t border-dashed border-border" />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="relative z-10 h-9 w-9 rounded-full bg-card shadow-sm"
            onClick={handleSwap}
            disabled={!fromStopId || !toStopId}
            aria-label="Swap from and to"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        <StopField
          label="To"
          placeholder={fromStopId ? 'Destination' : 'Select From first'}
          value={toStopId}
          options={toOptions}
          allStops={stops}
          onSelect={onToChange}
          disabled={!fromStopId}
          dotClass="bg-rose-500"
        />
      </div>

      <div className="p-4 pt-2 bg-muted/30 border-t border-border">
        <Button
          className="w-full h-12 rounded-xl text-base font-semibold"
          onClick={onSearch}
          disabled={!canSearch || isSearching}
        >
          <Bus className="h-5 w-5 mr-2" />
          {isSearching ? 'Finding bus...' : 'Search Buses'}
        </Button>
      </div>
    </div>
  );
};
