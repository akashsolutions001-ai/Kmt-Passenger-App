import { useState } from 'react';
import { createComplaint } from '@/services/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';

interface ComplaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passengerId: string;
  passengerName: string;
  routeId?: string;
  routeName?: string;
  stopId?: string;
  stopName?: string;
}

export const ComplaintDialog: React.FC<ComplaintDialogProps> = ({
  open,
  onOpenChange,
  passengerId,
  passengerName,
  routeId,
  routeName,
  stopId,
  stopName,
}) => {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error('Please describe your complaint');
      return;
    }

    setSubmitting(true);
    try {
      await createComplaint({
        passengerId,
        passengerName,
        message: trimmed,
        routeId,
        stopId,
        status: 'pending',
      });
      toast.success('Complaint submitted', {
        description: 'KMT will review your feedback shortly.',
      });
      setMessage('');
      onOpenChange(false);
    } catch (err) {
      console.error('Complaint submit error:', err);
      toast.error('Failed to submit complaint', {
        description: 'Please try again in a moment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-primary" />
            Submit Complaint
          </DialogTitle>
          <DialogDescription>
            Report an issue with your bus service. Your trip details are attached automatically.
          </DialogDescription>
        </DialogHeader>

        {(routeName || stopName) && (
          <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
            {routeName && <p>Route: <span className="text-foreground font-medium">{routeName}</span></p>}
            {stopName && <p>Stop: <span className="text-foreground font-medium">{stopName}</span></p>}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="complaint-message">Your complaint</Label>
          <Textarea
            id="complaint-message"
            placeholder="Describe the issue (delay, behaviour, bus condition, etc.)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-none rounded-xl"
            disabled={submitting}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Complaint'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
