import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Announcement } from '@/types/firestore';
import { subscribeToAnnouncements } from '@/services/firestore';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Megaphone, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnnouncementsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDate = (ts: Timestamp | undefined): string => {
  if (!ts) return '';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date();
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const priorityStyles = {
  high: 'border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/20',
  normal: 'border-l-primary bg-card',
  low: 'border-l-muted-foreground bg-muted/30',
};

export const AnnouncementsSheet: React.FC<AnnouncementsSheetProps> = ({
  open,
  onOpenChange,
}) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    const unsub = subscribeToAnnouncements((items) => {
      setAnnouncements(items);
      setLoading(false);
    });

    return unsub;
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Announcements
          </SheetTitle>
          <SheetDescription>Latest updates from KMT administration</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3 overflow-y-auto max-h-[calc(85vh-8rem)] pr-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : announcements.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No announcements at the moment.
            </p>
          ) : (
            announcements.map((item) => (
              <article
                key={item.id}
                className={cn(
                  'rounded-xl border border-border border-l-4 p-4 shadow-sm',
                  priorityStyles[item.priority ?? 'normal']
                )}
              >
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                  {item.message}
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  {formatDate(item.createdAt)}
                </p>
              </article>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
