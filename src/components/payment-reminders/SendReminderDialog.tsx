import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSendPaymentReminder, type PaymentReminderRow } from "@/hooks/usePaymentReminders";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Eye } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder: PaymentReminderRow | null;
}

export function SendReminderDialog({ open, onOpenChange, reminder }: Props) {
  const { toast } = useToast();
  const send = useSendPaymentReminder();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");

  useEffect(() => {
    if (open && reminder) {
      setSubject("");
      setMessage("");
      setPreviewHtml(null);
      setPreviewSubject("");
      // auto-load preview
      send.mutate(
        { trip_payment_id: reminder.id, preview: true },
        {
          onSuccess: (data) => {
            setPreviewHtml(data.html || "");
            setPreviewSubject(data.subject);
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reminder?.id]);

  const refreshPreview = () => {
    if (!reminder) return;
    send.mutate(
      {
        trip_payment_id: reminder.id,
        preview: true,
        custom_subject: subject || undefined,
        custom_message: message || undefined,
      },
      {
        onSuccess: (data) => {
          setPreviewHtml(data.html || "");
          setPreviewSubject(data.subject);
        },
      }
    );
  };

  const handleSend = () => {
    if (!reminder) return;
    send.mutate(
      {
        trip_payment_id: reminder.id,
        custom_subject: subject || undefined,
        custom_message: message || undefined,
      },
      {
        onSuccess: (data) => {
          toast({
            title: "Reminder sent",
            description: `Email delivered to ${data.recipient}`,
          });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({
            title: "Send failed",
            description: err?.message || "Could not send reminder.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const recipient = reminder?.trips?.clients?.email || "—";
  const clientName = reminder?.trips?.clients?.name || "Client";
  const isPreviewing = send.isPending && !previewHtml;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Send Payment Reminder
          </DialogTitle>
          <DialogDescription>
            Sending to <strong>{clientName}</strong> &lt;{recipient}&gt;
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="reminder-subject">Subject</Label>
              <Input
                id="reminder-subject"
                value={subject}
                placeholder={previewSubject || "(default branded subject)"}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reminder-message">Custom message (optional)</Label>
              <Textarea
                id="reminder-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Leave blank to use the default friendly reminder text."
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The branded header, amount card, and pay button are always included.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refreshPreview} disabled={send.isPending}>
              <Eye className="h-4 w-4 mr-2" /> Refresh preview
            </Button>
          </div>

          <div className="border rounded-md p-2 bg-muted/30 max-h-[60vh] overflow-y-auto">
            <div className="text-xs uppercase tracking-wide text-muted-foreground px-2 pb-2">
              Email preview
            </div>
            {isPreviewing ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : previewHtml ? (
              <div
                className="bg-white rounded"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="text-sm text-muted-foreground p-4">No preview available.</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={send.isPending || !reminder}>
            <Send className="h-4 w-4 mr-2" />
            {send.isPending ? "Sending..." : reminder?.last_sent_at ? "Resend Reminder" : "Send Reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}