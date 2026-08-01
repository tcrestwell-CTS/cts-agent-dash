import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAgentMeetings,
  useAvailability,
  useBookingSettings,
  useDeleteAvailability,
  useSaveAvailability,
  useUpdateBookingSettings,
  useUpdateMeetingStatus,
} from "@/hooks/useScheduling";
import { DAY_NAMES, slugify } from "@/lib/scheduling";

const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90];
const TZ_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Pacific/Honolulu",
];

export default function Scheduling() {
  const { user } = useAuth();
  const { data: settings, isLoading } = useBookingSettings();
  const updateSettings = useUpdateBookingSettings();
  const { data: windows = [] } = useAvailability(user?.id);
  const saveWindow = useSaveAvailability();
  const deleteWindow = useDeleteAvailability();
  const { data: meetings = [] } = useAgentMeetings(user?.id);
  const updateStatus = useUpdateMeetingStatus();

  const [slug, setSlug] = useState("");
  const [instructions, setInstructions] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!settings) return;
    setSlug(settings.booking_slug ?? slugify(settings.full_name ?? ""));
    setInstructions(settings.booking_instructions ?? "");
    setPhone(settings.booking_contact_phone ?? "");
  }, [settings]);

  const [newDay, setNewDay] = useState("1");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [newSlot, setNewSlot] = useState("30");
  const [newBuffer, setNewBuffer] = useState("0");

  const bookingUrl = settings?.booking_slug
    ? `${window.location.origin}/book/${settings.booking_slug}`
    : null;

  const upcoming = useMemo(
    () =>
      meetings.filter(
        (m) => m.status === "scheduled" && new Date(m.ends_at).getTime() > Date.now(),
      ),
    [meetings],
  );
  const past = useMemo(
    () =>
      meetings.filter(
        (m) => m.status !== "scheduled" || new Date(m.ends_at).getTime() <= Date.now(),
      ),
    [meetings],
  );

  const tz = settings?.booking_timezone ?? "America/New_York";

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const saveLink = async () => {
    const clean = slugify(slug);
    if (!clean) {
      toast.error("Choose a booking link name");
      return;
    }
    try {
      await updateSettings.mutateAsync({
        booking_slug: clean,
        booking_instructions: instructions || null,
        booking_contact_phone: phone || null,
      });
      toast.success("Booking page saved");
    } catch (err: any) {
      toast.error(
        err?.code === "23505" ? "That link name is taken — try another" : "Could not save",
      );
    }
  };

  const addWindow = async () => {
    if (newEnd <= newStart) {
      toast.error("End time must be after start time");
      return;
    }
    await saveWindow.mutateAsync({
      user_id: user!.id,
      day_of_week: Number(newDay),
      start_time: newStart,
      end_time: newEnd,
      slot_minutes: Number(newSlot),
      buffer_minutes: Number(newBuffer),
    });
    toast.success("Availability added");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduling</h1>
          <p className="text-sm text-muted-foreground">
            Publish a booking page so clients can pick a time from your real availability.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your booking page</CardTitle>
            <CardDescription>
              Meetings are phone or agent-provided — the details you enter below are shown to the
              client after they book.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Accept bookings</p>
                    <p className="text-xs text-muted-foreground">
                      When off, the public link shows an inactive message.
                    </p>
                  </div>
                  <Switch
                    checked={!!settings?.booking_enabled}
                    onCheckedChange={(v) =>
                      updateSettings.mutate({ booking_enabled: v })
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="slug">Link name</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="tim-crestwell"
                    />
                    {bookingUrl && (
                      <div className="flex items-center gap-2">
                        <code className="truncate rounded bg-muted px-2 py-1 text-xs">
                          {bookingUrl}
                        </code>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(bookingUrl);
                            toast.success("Link copied");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Time zone</Label>
                    <Select
                      value={tz}
                      onValueChange={(v) => updateSettings.mutate({ booking_timezone: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TZ_OPTIONS.map((z) => (
                          <SelectItem key={z} value={z}>
                            {z.replace("America/", "").replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Call-in phone / meeting details</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instructions">Notes shown to the client</Label>
                    <Textarea
                      id="instructions"
                      rows={3}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="I'll call you at the number you provide."
                    />
                  </div>
                </div>

                <Button onClick={saveLink} disabled={updateSettings.isPending}>
                  {updateSettings.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save booking page
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly availability</CardTitle>
            <CardDescription>Times are in {tz.replace("America/", "")}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {windows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No availability set yet — clients cannot book until you add a window.
              </p>
            ) : (
              <div className="space-y-2">
                {windows.map((w) => (
                  <div
                    key={w.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{DAY_NAMES[w.day_of_week]}</span>{" "}
                      <span className="text-muted-foreground">
                        {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{w.slot_minutes} min slots</Badge>
                      {w.buffer_minutes > 0 && (
                        <Badge variant="outline">{w.buffer_minutes} min buffer</Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteWindow.mutate(w.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="grid gap-3 md:grid-cols-6">
              <div className="space-y-1 md:col-span-2">
                <Label>Day</Label>
                <Select value={newDay} onValueChange={setNewDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((d, i) => (
                      <SelectItem key={d} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Slot</Label>
                <Select value={newSlot} onValueChange={setNewSlot}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOT_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Buffer</Label>
                <Select value={newBuffer} onValueChange={setNewBuffer}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 30].map((b) => (
                      <SelectItem key={b} value={String(b)}>
                        {b} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="outline" onClick={addWindow} disabled={saveWindow.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Add availability
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Upcoming calls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calls booked yet.</p>
            ) : (
              upcoming.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{fmt(m.starts_at)}</p>
                    <p className="text-sm">
                      {m.contact_name} · {m.contact_email}
                      {m.contact_phone ? ` · ${m.contact_phone}` : ""}
                    </p>
                    {m.topic && <p className="text-xs text-muted-foreground">{m.topic}</p>}
                    {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: m.id, status: "completed" })}
                    >
                      Mark held
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus.mutate({ id: m.id, status: "cancelled" })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {past.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {past.slice(0, 25).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <span>
                    {fmt(m.starts_at)} · {m.contact_name}
                  </span>
                  <Badge variant={m.status === "completed" ? "secondary" : "outline"}>
                    {m.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}