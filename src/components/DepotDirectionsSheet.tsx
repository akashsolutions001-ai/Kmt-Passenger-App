import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { DepotDirectionsMap } from '@/components/DepotDirectionsMap';

interface DepotDirectionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depotName: string;
  depotLatitude: number;
  depotLongitude: number;
}

export const DepotDirectionsSheet: React.FC<DepotDirectionsSheetProps> = ({
  open,
  onOpenChange,
  depotName,
  depotLatitude,
  depotLongitude,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl px-4 pb-6 overflow-y-auto">
        <SheetHeader className="text-left pb-2">
          <SheetTitle>Directions to depot</SheetTitle>
          <SheetDescription>
            Walk to <strong>{depotName}</strong>. The blue line follows roads. You will be notified
            when you arrive within 50 metres.
          </SheetDescription>
        </SheetHeader>

        <DepotDirectionsMap
          depotName={depotName}
          depotLatitude={depotLatitude}
          depotLongitude={depotLongitude}
          active={open}
          height="calc(92vh - 140px)"
        />
      </SheetContent>
    </Sheet>
  );
};
