import { useEffect, useMemo, useState } from "react";
import { Ticket, Star, Clock, ExternalLink, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  usePortalExcursionSearch,
  usePortalExcursionRequests,
  useRequestExcursion,
  usePortalTrips,
  type PortalExcursionRequest,
} from "@/hooks/usePortalData";

const DESTINATIONS = [
  { label: "Caribbean (all ports)", value: "caribbean" },
  { label: "Nassau, Bahamas", value: "nassau" },
  { label: "Cozumel, Mexico", value: "cozumel" },
  { label: "St. Thomas, USVI", value: "st-thomas" },
  { label: "St. Maarten", value: "st-maarten" },
  { label: "Grand Cayman", value: "grand-cayman" },
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Barcelona", value: "barcelona" },
  { label: "Rome", value: "rome" },
  { label: "Athens", value: "athens" },
  { label: "Santorini", value: "santorini" },
  { label: "Alaska", value: "alaska" },
  { label: "Europe", value: "europe" },
];

interface Product {
  productCode: string;
  title: string;
  description?: string;
  pricing?: { summary?: { fromPrice?: number } };
  reviews?: { combinedAverageRating?: number; totalReviews?: number };
  duration?: { fixedDurationInMinutes?: number };
  images?: Array<{ variants?: Array<{ url: string; width: number }> }>;
  productUrl?: string;
}

function formatDuration(minutes?: number) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed by your advisor",
  booked: "Booked",
  declined: "Not available",
  cancelled: "Cancelled",
};

export default function PortalExcursions() {
  const [destination, setDestination] = useState("caribbean");
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [travelDate, setTravelDate] = useState("");
  const [travelers, setTravelers] = useState("2");
  const [notes, setNotes] = useState("");
  const [tripId, setTripId] = useState<string>("none");

  const search = usePortalExcursionSearch();
  const requestExcursion = useRequestExcursion();
  const { data: requestsData } = usePortalExcursionRequests();
  const { data: tripsData } = usePortalTrips();

  const trips = useMemo(() => (tripsData?.trips ?? []) as any[], [tripsData]);
  const requests = (requestsData?.requests ?? []) as PortalExcursionRequest[];

  const runSearch = (dest: string) => {
    search.mutate(
      { destination: dest },
      {
        onSuccess: (data: any) => setProducts(data.products ?? []),
        onError: () => toast.error("Excursion search is unavailable right now"),
      },
    );
  };

  useEffect(() => {
    runSearch(destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  const openRequest = (product: Product) => {
    setSelected(product);
    setTravelDate("");
    setTravelers("2");
    setNotes("");
    setTripId(trips.length === 1 ? trips[0].id : "none");
  };

  const submit = () => {
    if (!selected) return;
    requestExcursion.mutate(
      {
        productCode: selected.productCode,
        productTitle: selected.title,
        destination,
        productUrl: selected.productUrl ?? null,
        imageUrl: selected.images?.[0]?.variants?.find((v) => v.width >= 400)?.url ?? null,
        travelDate: travelDate || null,
        travelers: Number(travelers) || 2,
        pricePerPerson: selected.pricing?.summary?.fromPrice ?? null,
        notes: notes || null,
        tripId: tripId === "none" ? null : tripId,
      },
      {
        onSuccess: () => {
          toast.success("Request sent — your advisor will confirm availability");
          setSelected(null);
        },
        onError: (err: any) => toast.error(err?.message || "Could not send that request"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Ticket className="h-6 w-6" /> Excursions &amp; Tours
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse tours by port or destination and send a request to your advisor — they handle the
          booking and it lands on your trip.
        </p>
      </div>

      {requests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.product_title || r.product_code}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.travel_date, `${r.travelers} traveler${r.travelers === 1 ? "" : "s"}`, r.destination]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {r.agent_notes && (
                    <p className="text-xs text-muted-foreground mt-1">Advisor: {r.agent_notes}</p>
                  )}
                </div>
                <Badge variant={r.status === "requested" ? "secondary" : r.status === "declined" || r.status === "cancelled" ? "outline" : "default"}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Label className="text-xs">Port or destination</Label>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DESTINATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => runSearch(destination)} disabled={search.isPending}>
          {search.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          Search
        </Button>
      </div>

      {search.isPending && products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading excursions…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const img = p.images?.[0]?.variants?.find((v) => v.width >= 400)?.url
              ?? p.images?.[0]?.variants?.[0]?.url;
            const duration = formatDuration(p.duration?.fixedDurationInMinutes);
            return (
              <Card key={p.productCode} className="overflow-hidden flex flex-col">
                {img && (
                  <img src={img} alt={p.title} loading="lazy" className="h-40 w-full object-cover" />
                )}
                <CardContent className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{p.title}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {p.reviews?.combinedAverageRating != null && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {p.reviews.combinedAverageRating.toFixed(1)}
                        {p.reviews.totalReviews ? ` (${p.reviews.totalReviews})` : ""}
                      </span>
                    )}
                    {duration && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{p.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {p.pricing?.summary?.fromPrice != null
                        ? `From $${p.pricing.summary.fromPrice.toFixed(0)}`
                        : "Price on request"}
                    </span>
                    <div className="flex items-center gap-2">
                      {p.productUrl && (
                        <a href={p.productUrl} target="_blank" rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground" aria-label="View details">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button size="sm" onClick={() => openRequest(p)}>Request</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">Request this excursion</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {trips.length > 0 && (
              <div>
                <Label className="text-xs">Which trip?</Label>
                <Select value={tripId} onValueChange={setTripId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select a trip" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not sure yet</SelectItem>
                    {trips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.trip_name || t.destination}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs" htmlFor="exc-date">Preferred date</Label>
                <Input id="exc-date" type="date" className="mt-1" value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs" htmlFor="exc-pax">Travelers</Label>
                <Input id="exc-pax" type="number" min={1} max={20} className="mt-1" value={travelers}
                  onChange={(e) => setTravelers(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs" htmlFor="exc-notes">Anything we should know?</Label>
              <Textarea id="exc-notes" className="mt-1" rows={3} value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mobility needs, preferred time of day, celebrating something…" />
            </div>
            {selected?.pricing?.summary?.fromPrice != null && (
              <p className="text-xs text-muted-foreground">
                Estimated total: $
                {(selected.pricing.summary.fromPrice * (Number(travelers) || 1)).toFixed(2)} — final
                pricing is confirmed by your advisor before anything is charged.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={submit} disabled={requestExcursion.isPending}>
              {requestExcursion.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}