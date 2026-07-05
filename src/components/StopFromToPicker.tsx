import { Stop } from '@/types/student';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, ArrowRight } from 'lucide-react';

interface StopFromToPickerProps {
  stops: Stop[];
  fromStopId?: string;
  toStopId?: string;
  onFromChange: (stopId: string) => void;
  onToChange: (stopId: string) => void;
  disabled?: boolean;
}

export const StopFromToPicker: React.FC<StopFromToPickerProps> = ({
  stops,
  fromStopId,
  toStopId,
  onFromChange,
  onToChange,
  disabled = false,
}) => {
  const fromStop = stops.find((s) => s.id === fromStopId);
  const toOptions = fromStop
    ? stops.filter((s) => s.order > fromStop.order)
    : stops;

  if (stops.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-4 text-center">
        No stops available for this route yet. Admin must add stops in the stops collection.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="from-stop" className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="h-4 w-4 text-primary" />
          From
        </Label>
        <Select value={fromStopId} onValueChange={onFromChange} disabled={disabled}>
          <SelectTrigger id="from-stop" className="h-12 rounded-xl">
            <SelectValue placeholder="Select boarding stop" />
          </SelectTrigger>
          <SelectContent>
            {stops.map((stop) => (
              <SelectItem key={stop.id} value={stop.id}>
                {stop.order}. {stop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-center">
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="to-stop" className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="h-4 w-4 text-accent" />
          To
        </Label>
        <Select
          value={toStopId}
          onValueChange={onToChange}
          disabled={disabled || !fromStopId}
        >
          <SelectTrigger id="to-stop" className="h-12 rounded-xl">
            <SelectValue placeholder={fromStopId ? 'Select destination stop' : 'Select From first'} />
          </SelectTrigger>
          <SelectContent>
            {toOptions.map((stop) => (
              <SelectItem key={stop.id} value={stop.id}>
                {stop.order}. {stop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
