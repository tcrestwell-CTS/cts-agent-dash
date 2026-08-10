import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Storefront {
  user_id: string;
  storefront_slug: string;
  storefront_headline: string | null;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  agency_name: string | null;
  storefront_logo_url: string | null;
  storefront_bio: string | null;
}

const TRIP_TYPES = [
  "Cruise",
  "All-Inclusive Resort",
  "Lodging / Hotel",
  "Flight",
  "Group Travel",
  "Other",
];

/** Resolve the storefront slug from either /storefront/:slug or <slug>.crestwelltravels.com */
function resolveSlug(routeSlug?: string) {
  if (routeSlug) return routeSlug;
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (!["www", "app", "compass", "localhost", "id-preview--8ab51332-288c-4764-b4d9-392cc428e2fb"].includes(sub)) {
      return sub;
    }
  }
  return undefined;
}

const AgentStorefront = () => {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const slug = useMemo(() => resolveSlug(routeSlug), [routeSlug]);

  const [agent, setAgent] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    trip_type: TRIP_TYPES[0],
    destination: "",
    departure_date: "",
    travelers_adults: 2,
    travelers_children: 0,
    message: "",
  });

  useEffect(() => {
    const load = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("public_storefronts")
        .select("*")
        .eq("storefront_slug", slug)
        .maybeSingle();
      if (error) console.error("Storefront lookup failed:", error);
      setAgent((data as any) ?? null);
      setLoading(false);
    };
    load();
  }, [slug]);

  const storefrontName = agent?.agency_name?.trim() || agent?.full_name || "Travel Advisor";

  useEffect(() => {
    if (agent) {
      document.title = `${storefrontName} | Travel Planning`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) {
        desc.setAttribute(
          "content",
          agent.storefront_headline ?? `Plan your next trip with ${storefrontName}.`,
        );
      }
    }
  }, [agent, storefrontName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("Please add your name and email");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("quote_requests").insert(
      {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        trip_type: form.trip_type,
        destination: form.destination || null,
        departure_date: form.departure_date || null,
        travelers_adults: Number(form.travelers_adults) || 1,
        travelers_children: Number(form.travelers_children) || 0,
        message: form.message || null,
        lead_source: "agent_storefront",
        funnel_slug: agent.storefront_slug,
        assigned_agent_id: agent.user_id,
        assigned_at: new Date().toISOString(),
      } as any,
      { count: "none" } as any,
    );
    setSubmitting(false);
    if (error) {
      console.error("Trip request failed:", error);
      toast.error("We couldn't send your request. Please try again.");
      return;
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Storefront not found</h1>
          <p className="text-muted-foreground">This advisor page is not available.</p>
        </div>
      </div>
    );
  }

  const initials = storefrontName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          {agent.storefront_logo_url ? (
            <img
              src={agent.storefront_logo_url}
              alt={`${storefrontName} logo`}
              className="h-24 w-auto max-w-[220px] object-contain"
              loading="eager"
            />
          ) : (
            <Avatar className="h-24 w-24">
              <AvatarImage src={agent.avatar_url ?? undefined} alt={storefrontName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          )}
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-card-foreground">{storefrontName}</h1>
            <p className="text-primary font-medium">{agent.storefront_headline}</p>
            <p className="text-sm text-muted-foreground">
              {[agent.full_name, agent.job_title].filter(Boolean).join(" · ")}
            </p>
            {agent.storefront_bio && (
              <p className="text-sm text-muted-foreground max-w-xl pt-2">{agent.storefront_bio}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Card>
          {submitted ? (
            <CardContent className="py-16 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-semibold text-card-foreground">Request received</h2>
              <p className="text-muted-foreground">
                {agent.full_name} will reach out shortly to start planning your trip.
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Start your trip request</CardTitle>
                <CardDescription>
                  Tell {agent.full_name?.split(" ")[0]} about your trip and get a personalized quote.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First name</Label>
                      <Input
                        id="first_name"
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last name</Label>
                      <Input
                        id="last_name"
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="trip_type">Trip type</Label>
                      <select
                        id="trip_type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.trip_type}
                        onChange={(e) => setForm({ ...form, trip_type: e.target.value })}
                      >
                        {TRIP_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destination">Destination</Label>
                      <Input
                        id="destination"
                        value={form.destination}
                        onChange={(e) => setForm({ ...form, destination: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="departure_date">Departure date</Label>
                      <Input
                        id="departure_date"
                        type="date"
                        value={form.departure_date}
                        onChange={(e) => setForm({ ...form, departure_date: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="adults">Adults</Label>
                        <Input
                          id="adults"
                          type="number"
                          min={1}
                          value={form.travelers_adults}
                          onChange={(e) => setForm({ ...form, travelers_adults: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="children">Children</Label>
                        <Input
                          id="children"
                          type="number"
                          min={0}
                          value={form.travelers_children}
                          onChange={(e) => setForm({ ...form, travelers_children: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Anything else?</Label>
                    <Textarea
                      id="message"
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Occasion, budget range, must-haves..."
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Send my trip request
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AgentStorefront;
