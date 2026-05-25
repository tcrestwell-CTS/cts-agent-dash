import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SUBJECTS = {
  A: "An invitation reserved for 20 clients",
  B: "Tim Crestwell here — something new for our best clients",
  C: "You've been chosen as a Crestwell Founding Member",
};

const LANDING_URL = "https://crestwellgetaways.com/the-circle";

export function CircleFoundingInviteComposer({ open, onClose }: Props) {
  const [variant, setVariant] = useState<"A" | "B" | "C">("A");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["circle-founding-eligible-clients"],
    enabled: open,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 36);
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, email, created_at, status")
        .gte("created_at", since.toISOString())
        .not("email", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []).filter((c: any) => c.email);
    },
  });

  const allSelected =
    clients.length > 0 && clients.every((c: any) => selected[c.id]);

  const toggleAll = () => {
    if (allSelected) setSelected({});
    else
      setSelected(
        Object.fromEntries(clients.map((c: any) => [c.id, true])),
      );
  };

  const previewName = useMemo(() => "Friend", []);
  const previewBody = bodyForVariant(variant, previewName);

  const onSend = async () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (!ids.length) {
      toast({ title: "Pick at least one recipient", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const recipients = clients
        .filter((c: any) => selected[c.id])
        .map((c: any) => ({ client_id: c.id, email: c.email, name: c.name }));

      const { data, error } = await supabase.functions.invoke(
        "send-circle-email",
        {
          body: {
            kind: "founding_invitation",
            subject_variant: variant,
            subject: SUBJECTS[variant],
            landing_url: LANDING_URL,
            recipients,
          },
        },
      );
      if (error) throw error;
      toast({
        title: "Invitations sent",
        description: `Sent to ${(data as any)?.sent_count ?? ids.length} clients`,
      });
      onClose();
    } catch (e: any) {
      toast({
        title: "Failed to send",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Founding Member Invitation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Subject line</Label>
            <Select value={variant} onValueChange={(v) => setVariant(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A — {SUBJECTS.A}</SelectItem>
                <SelectItem value="B">B — {SUBJECTS.B}</SelectItem>
                <SelectItem value="C">C — {SUBJECTS.C}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground mb-1">Preview</p>
            <pre className="whitespace-pre-wrap text-xs font-sans">{previewBody}</pre>
            <p className="text-xs text-primary mt-2">{LANDING_URL}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>
                Recipients ({Object.values(selected).filter(Boolean).length}/
                {clients.length})
              </Label>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
              {isLoading && (
                <p className="p-3 text-sm text-muted-foreground">Loading…</p>
              )}
              {!isLoading && clients.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No eligible clients in the last 36 months.
                </p>
              )}
              {clients.map((c: any) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 p-2 text-sm hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={!!selected[c.id]}
                    onCheckedChange={(v) =>
                      setSelected((s) => ({ ...s, [c.id]: !!v }))
                    }
                  />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.email}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onSend} disabled={sending}>
              Send invitations
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function bodyForVariant(v: "A" | "B" | "C", firstName: string) {
  const intro = `Hi ${firstName},\n\n`;
  const common = `\n\nWe're inviting 20 of our best clients to be founding members of The Crestwell Circle — an inner circle for travelers we adore. Founding members lock in lifetime perks at no cost during the trial year.\n\n— Tim Crestwell`;
  if (v === "A")
    return (
      intro +
      "This isn't a newsletter blast — it's a small, deliberate invitation reserved for 20 clients. We want you in." +
      common
    );
  if (v === "B")
    return (
      intro +
      "Tim Crestwell here. We're testing something new with a handful of our most loyal travelers, and I'd like you to be part of it." +
      common
    );
  return (
    intro +
    "You've been chosen as one of 20 founding members of The Crestwell Circle — a small experiment in serving our very best clients." +
    common
  );
}