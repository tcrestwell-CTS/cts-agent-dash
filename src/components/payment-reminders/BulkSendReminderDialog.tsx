import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useSendPaymentReminder, type PaymentReminderRow } from "@/hooks/usePaymentReminders";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Eye, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminders: PaymentReminderRow[];
}

type Result = { id: string; ok: boolean; error?: string; recipient?: string };

export function BulkSendReminderDialog({ open, onOpenChange, reminders }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const send = useSendPaymentReminder();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const eligible = reminders.filter((r) => !!r.trips?.clients?.email);
  const skipped = reminders.length - eligible.length;
  const sample = eligible[0];

  useEffect(() => {
    if (open && sample) {
      setSubject("");
      setMessage("");
      setResults([]);
      setProgress(0);
      setPreviewHtml(null);
      setPreviewLoading(true);
      send.mutate(
        { trip_payment_id: sample.id, preview: true },
        {
          onSuccess: (data) => {
            setPreviewHtml(data.html || "");
            setPreviewSubject(data.subject);
            setPreviewLoading(false);
          },
          onError: () => setPreviewLoading(false),
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sample?.id]);

  const refreshPreview = () => {
    if (!sample) return;
    setPreviewLoading(true);
    send.mutate(
      {
        trip_payment_id: sample.id,
        preview: true,
        custom_subject: subject || undefined,
        custom_message: message || undefined,
      },
      {
        onSuccess: (data) => {
          setPreviewHtml(data.html || "");
          setPreviewSubject(data.subject);
          setPreviewLoading(false);
        },
        onError: () => setPreviewLoading(false),
      }
    );
  };

  const handleBulkSend = async () => {
    if (eligible.length === 0) return;
    setSending(true);
    setResults([]);
    setProgress(0);
    const out: Result[] = [];
    for (let i = 0; i < eligible.length; i++) {
      const r = eligible[i];
      try {
        const data = await send.mutateAsync({
          trip_payment_id: r.id,
          custom_subject: subject || undefined,
          custom_message: message || undefined,
        });
        out.push({ id: r.id, ok: !!data?.sent, recipient: data?.recipient });
      } catch (err: any) {
        out.push({ id: r.id, ok: false, error: err?.message || "Send failed" });
      }
      setResults([...out]);
      setProgress(Math.round(((i + 1) / eligible.length) * 100));
    }
    setSending(false);
    const okCount = out.filter((r) => r.ok).length;
    const failCount = out.length - okCount;
    toast({
      title: "Bulk send complete",
      description: `${okCount} sent${failCount ? `, ${failCount} failed` : ""}.`,
      variant: failCount ? "destructive" : "default",
    });
    qc.invalidateQueries({ queryKey: ["payment-reminders"] });
  };

  const close = () => {
    if (sending) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Bulk Send Payment Reminders
          </DialogTitle>
          <DialogDescription>
            Sending to <strong>{eligible.length}</strong> client{eligible.length === 1 ? "" : "s"}
            {skipped > 0 && (
              <> · <span className="text-warning">{skipped} skipped (no email)</span></>
            )}
            . Each client receives the same branded template with their own amount, due date, and pay link.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="bulk-subject">Subject (applies to all)</Label>
              <Input
                id="bulk-subject"
                value={subject}
                placeholder={previewSubject || "(default branded subject)"}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
              />
            </div>
            <div>
              <Label htmlFor="bulk-message">Custom message (optional)</Label>
              <Textarea
                id="bulk-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Leave blank to use the default friendly reminder text."
                rows={5}
                disabled={sending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The branded header, per-client amount card, and pay button are always included.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refreshPreview} disabled={sending || previewLoading}>
              <Eye className="h-4 w-4 mr-2" /> Refresh preview
            </Button>

            <div className="border rounded-md p-3 bg-muted/20 max-h-72 overflow-y-auto">
              <div className="text-xs uppercase tracking-wide text-muted-foreground pb-2">
                Recipients ({eligible.length})
              </div>
              <ul className="space-y-1 text-sm">
                {eligible.map((r) => {
                  const result = results.find((x) => x.id === r.id);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {r.trips?.clients?.name} <span className="text-muted-foreground">&lt;{r.trips?.clients?.email}&gt;</span>
                      </span>
                      {result ? (
                        result.ok ? (
                          <Badge className="bg-success text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
                        )
                      ) : sending ? (
                        <Badge variant="outline">Queued</Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            {sending && (
              <div className="space-y-1">
                <Progress value={progress} />
                <div className="text-xs text-muted-foreground">{progress}% — {results.length}/{eligible.length}</div>
              </div>
            )}
          </div>

          <div className="border rounded-md p-2 bg-muted/30 max-h-[60vh] overflow-y-auto">
            <div className="text-xs uppercase tracking-wide text-muted-foreground px-2 pb-2">
              Email preview (sample: {sample?.trips?.clients?.name || "—"})
            </div>
            {previewLoading ? (
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
          <Button variant="ghost" onClick={close} disabled={sending}>
            {results.length > 0 && !sending ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={handleBulkSend}
            disabled={sending || eligible.length === 0 || (results.length > 0 && results.every((r) => r.ok))}
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? `Sending... (${results.length}/${eligible.length})` : `Send ${eligible.length} Reminder${eligible.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}