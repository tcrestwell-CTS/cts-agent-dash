import { useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

type Audience = "all_active" | "founding_only";

export function CircleBriefingComposer({ open, onClose }: Props) {
  const now = new Date();
  const monthYear = format(now, "MMMM yyyy");
  const [subject, setSubject] = useState(`Port Intel Briefing — ${monthYear}`);
  const [issueNumber, setIssueNumber] = useState<number>(1);
  const [thePort, setThePort] = useState("");
  const [bookingWindow, setBookingWindow] = useState("");
  const [fromCircle, setFromCircle] = useState("");
  const [comingUp, setComingUp] = useState("");
  const [audience, setAudience] = useState<Audience>("all_active");
  const [schedule, setSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const html = `
    <div style="font-family:Georgia,serif;background:#0a1f44;color:#f5f0e1;padding:32px;">
      <h1 style="color:#c9a84c;margin:0 0 24px;">${subject}</h1>
      ${section("The Port", thePort)}
      ${section("The Booking Window", bookingWindow)}
      ${section("From the Circle", fromCircle)}
      ${section("Coming Up", comingUp)}
      <p style="margin-top:32px;color:#c9a84c;">— Tim Crestwell</p>
      <p style="font-size:11px;color:#999;margin-top:24px;">
        Crestwell Travel Services · Florida Seller of Travel #ST46414
      </p>
    </div>`;

  const onSend = async () => {
    setSending(true);
    try {
      const { data: row, error: insErr } = await (supabase as any)
        .from("circle_briefings")
        .insert({
          issue_number: issueNumber,
          subject,
          the_port: thePort,
          booking_window: bookingWindow,
          from_the_circle: fromCircle,
          coming_up: comingUp,
          scheduled_for: schedule && scheduledFor ? scheduledFor : null,
          status: schedule ? "scheduled" : "draft",
        })
        .select("*")
        .single();
      if (insErr) throw insErr;

      if (!schedule) {
        const { data, error } = await supabase.functions.invoke(
          "send-circle-email",
          {
            body: {
              kind: "briefing",
              briefing_id: row.id,
              audience,
              subject,
              html,
            },
          },
        );
        if (error) throw error;
        toast({
          title: "Briefing sent",
          description: `Delivered to ${(data as any)?.sent_to_count ?? 0} members`,
        });
      } else {
        toast({ title: "Briefing scheduled" });
      }
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
          <DialogTitle>Port Intel Briefing Composer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr] gap-3">
            <div>
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <Label>Issue #</Label>
              <Input
                type="number"
                value={issueNumber}
                onChange={(e) => setIssueNumber(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          <FieldArea label="The Port" value={thePort} onChange={setThePort} />
          <FieldArea
            label="The Booking Window"
            value={bookingWindow}
            onChange={setBookingWindow}
          />
          <FieldArea
            label="From the Circle"
            value={fromCircle}
            onChange={setFromCircle}
          />
          <FieldArea label="Coming Up" value={comingUp} onChange={setComingUp} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Send to</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_active">All active members</SelectItem>
                  <SelectItem value="founding_only">Founding only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-2">
                <Switch checked={schedule} onCheckedChange={setSchedule} />
                <Label className="cursor-pointer">Schedule</Label>
              </div>
              {schedule && (
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
              )}
            </div>
          </div>

          {showPreview && (
            <div className="border rounded-md overflow-hidden">
              <iframe
                title="preview"
                srcDoc={html}
                className="w-full h-80 bg-white"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPreview((p) => !p)}>
              {showPreview ? "Hide" : "Preview"}
            </Button>
            <Button onClick={onSend} disabled={sending}>
              {schedule ? "Schedule" : "Send now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function section(title: string, body: string) {
  if (!body) return "";
  return `<div style="margin-bottom:24px;">
    <h2 style="color:#c9a84c;font-size:18px;border-bottom:1px solid #c9a84c;padding-bottom:4px;">${title}</h2>
    <div style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(body)}</div>
  </div>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}