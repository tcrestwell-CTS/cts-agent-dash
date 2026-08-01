import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateSlots, type Slot, type Window, type Busy } from "@/lib/scheduling";

interface AgentInfo {
  full_name: string | null;
  job_title: string | null;
  timezone: string;
  instructions: string | null;
  phone: string | null;
}

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-booking`;

async function callBooking(payload: Record<string, unknown>) {
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Something went wrong");
  return data;
}

export default function BookMeeting() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [windows, setWindows] = useState<Window[]>([]);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Slot | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await callBooking({ action: "availability", slug });
        if (!active) return;
        setAgent(data.agent);
        setWindows(data.windows ?? []);
        setBusy(data.busy ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load this page");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const tz = agent?.timezone ?? "America/New_York";

  const grouped = useMemo(() => {
    if (!agent) return [];
    const slots = generateSlots({ windows, busy, timeZone: tz });
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = s.start.toLocaleDateString("en-US", {
        timeZone: tz,
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return Array.from(map.entries()).slice(0, 14);
  }, [agent, windows, busy, tz]);

  const timeLabel = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      await callBooking({
        action: "book",
        slug,
        starts_at: selected.start.toISOString(),
        ends_at: selected.end.toISOString(),
        contact_name: name,
        contact_email: email,
        contact_phone: phone || null,
        topic: topic || null,
        notes: notes || null,
      });
      setConfirmed(selected);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book that time");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Booking unavailable</CardTitle>
            <CardDescription>{error ?? "This link is not active."}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (confirmed) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader className="space-y-2">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <CardTitle>You're booked</CardTitle>
            <CardDescription>
              {confirmed.start.toLocaleString("en-US", {
                timeZone: tz,
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              ({tz.replace("America/", "").replace("_", " ")}) with {agent.full_name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>A confirmation has been sent to your advisor.</p>
            {agent.phone && <p>Call details: {agent.phone}</p>}
            {agent.instructions && <p>{agent.instructions}</p>}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Book a call with {agent.full_name ?? "your advisor"}
        </h1>
        {agent.job_title && <p className="text-sm text-muted-foreground">{agent.job_title}</p>}
        {agent.instructions && <p className="text-sm text-muted-foreground">{agent.instructions}</p>}
        <Badge variant="secondary">
          Times shown in {tz.replace("America/", "").replace("_", " ")}
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-4 w-4" />
            Pick a time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open times right now. Please check back or reach out directly.
            </p>
          ) : (
            grouped.map(([day, slots]) => (
              <div key={day} className="space-y-2">
                <p className="text-sm font-medium">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Button
                      key={s.start.toISOString()}
                      size="sm"
                      variant={
                        selected?.start.getTime() === s.start.getTime() ? "default" : "outline"
                      }
                      onClick={() => setSelected(s)}
                    >
                      {timeLabel(s.start)}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
            <CardDescription>
              {selected.start.toLocaleString("en-US", {
                timeZone: tz,
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topic">What's this about?</Label>
                  <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Anything else</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm booking
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  );
}