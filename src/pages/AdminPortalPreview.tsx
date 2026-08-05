import { ItineraryGallery, getItemImages } from "@/components/shared/ItineraryGallery";
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useClients } from "@/hooks/useClients";
import {
  useAdminPortalDashboard,
  useAdminPortalTrips,
  useAdminPortalTripDetail,
  useAdminPortalPayments,
  useAdminPortalInvoices,
  useAdminPortalMessages,
  useAdminPortalDocuments,
} from "@/hooks/useAdminPortalPreview";
import { BookingOptionsCard } from "@/components/client/BookingOptionsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Home, Map, CreditCard, MessageSquare, FileText,
  MapPin, Calendar, DollarSign, User, Clock, CheckCircle2,
  Plane, ClipboardList, ChevronDown, ChevronUp, Hash, Lock,
  Eye, MapPinned, Layers, FolderOpen, Download,
} from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DepartureCountdown } from "@/components/client/DepartureCountdown";
import { ItineraryLocationTimeline } from "@/components/client/ItineraryLocationTimeline";
import { PaymentMilestoneTracker } from "@/components/client/PaymentMilestoneTracker";

const categoryIcons: Record<string, string> = {
  flight: "✈️", lodging: "🏨", cruise: "🚢", transportation: "🚗",
  activity: "🎯", dining: "🍽️", meeting: "📋", other: "📌",
};

const bookingTypeIcons: Record<string, { icon: string; label: string }> = {
  flight: { icon: "✈️", label: "Flight" },
  hotel: { icon: "🏨", label: "Hotel" },
  cruise: { icon: "🚢", label: "Cruise" },
  car_rental: { icon: "🚗", label: "Car Rental" },
  tour: { icon: "🎯", label: "Tour" },
  transfer: { icon: "🚐", label: "Transfer" },
  insurance: { icon: "🛡️", label: "Insurance" },
  other: { icon: "📌", label: "Other" },
};

type PortalTab = "dashboard" | "trips" | "documents" | "payments" | "messages" | "invoices";

const tabs: { key: PortalTab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "trips", label: "My Trips", icon: Map },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "invoices", label: "Invoices", icon: FileText },
];

export default function AdminPortalPreview() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PortalTab>("dashboard");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Get client name
  const clientsQuery = useClients();
  const client = (clientsQuery.data || []).find((c: any) => c.id === clientId);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Admin Header Bar */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portal-management")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">
                Portal Preview — {client?.name || "Client"}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground ml-7">
              Read-only admin view · This is what your client sees in their portal
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 text-warning border-warning/30 bg-warning/10">
            <Eye className="h-3 w-3" /> Admin Preview
          </Badge>
        </div>

        {/* Simulated Portal Chrome */}
        <div className="border rounded-xl overflow-hidden bg-background shadow-lg">
          {/* Simulated Portal Header */}
          <div className="border-b bg-card px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Crestwell Travel Services</span>
              <span className="text-xs text-muted-foreground">Welcome, {client?.first_name || client?.name || "Client"}</span>
            </div>
            {/* Tab Navigation */}
            <div className="flex gap-1 mt-2 -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedTripId(null); }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.key
                      ? "text-primary border-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 min-h-[500px]">
            {activeTab === "dashboard" && <DashboardTab clientId={clientId} />}
            {activeTab === "trips" && (
              selectedTripId ? (
                <TripDetailTab clientId={clientId} tripId={selectedTripId} onBack={() => setSelectedTripId(null)} />
              ) : (
                <TripsTab clientId={clientId} onSelectTrip={setSelectedTripId} />
              )
            )}
            {activeTab === "payments" && <PaymentsTab clientId={clientId} />}
            {activeTab === "messages" && <MessagesTab clientId={clientId} />}
            {activeTab === "invoices" && <InvoicesTab clientId={clientId} />}
            {activeTab === "documents" && <DocumentsTab clientId={clientId} />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ─── Dashboard Tab ────────────────────────────────────────────────────────── */
function DashboardTab({ clientId }: { clientId?: string }) {
  const { data, isLoading } = useAdminPortalDashboard(clientId);
  if (isLoading) return <TabSkeleton />;

  const client = data?.client;
  const trips = data?.trips || [];
  const payments = data?.upcoming_payments || [];
  const agent = data?.agent;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {client?.first_name || client?.name || "Traveler"}
        </h1>
        <p className="text-muted-foreground">Here's an overview of your travel plans</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Map className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trips.length}</p>
              <p className="text-sm text-muted-foreground">Active Trips</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{payments.length}</p>
              <p className="text-sm text-muted-foreground">Unpaid Payments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Unread Messages</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trips */}
      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming Trips</CardTitle></CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active trips yet.</p>
          ) : (
            <div className="space-y-3">
              {trips.slice(0, 5).map((trip: any) => (
                <div key={trip.id} className="flex items-center gap-4 p-3 rounded-lg border">
                  {trip.cover_image_url ? (
                    <img src={trip.cover_image_url} alt={trip.trip_name} className="h-16 w-24 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="h-16 w-24 rounded-md bg-gradient-to-br from-primary/10 to-muted shrink-0 flex items-center justify-center">
                      <Map className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{trip.trip_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {trip.destination}
                      {trip.depart_date && ` · ${format(parseLocalDate(trip.depart_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <DepartureCountdown departDate={trip.depart_date} returnDate={trip.return_date} compact />
                    <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>{trip.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent */}
      {agent && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Your Travel Agent</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            {agent.avatar_url ? (
              <img src={agent.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <p className="font-semibold">{agent.full_name}</p>
              {agent.job_title && <p className="text-sm text-muted-foreground">{agent.job_title}</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Trips Tab ────────────────────────────────────────────────────────────── */
function TripsTab({ clientId, onSelectTrip }: { clientId?: string; onSelectTrip: (id: string) => void }) {
  const { data, isLoading } = useAdminPortalTrips(clientId);
  if (isLoading) return <TabSkeleton />;

  const trips = data?.trips || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Trips</h1>
      {trips.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No trips found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trips.map((trip: any) => (
            <Card
              key={trip.id}
              className="hover:shadow-lg transition-all cursor-pointer overflow-hidden group h-full"
              onClick={() => onSelectTrip(trip.id)}
            >
              {trip.cover_image_url ? (
                <div className="relative h-40 overflow-hidden">
                  <img src={trip.cover_image_url} alt={trip.trip_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="font-bold text-lg text-white drop-shadow-sm">{trip.trip_name}</h3>
                    {trip.destination && (
                      <p className="text-sm text-white/90 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" /> {trip.destination}
                      </p>
                    )}
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge variant={trip.status === "confirmed" ? "default" : "secondary"} className="shadow-sm">{trip.status}</Badge>
                  </div>
                </div>
              ) : (
                <div className="relative h-28 bg-gradient-to-br from-primary/10 via-accent/5 to-muted flex items-end">
                  <div className="absolute top-3 right-3">
                    <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>{trip.status}</Badge>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-foreground">{trip.trip_name}</h3>
                    {trip.destination && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" /> {trip.destination}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  {trip.depart_date && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(parseLocalDate(trip.depart_date), "MMM d")}
                      {trip.return_date && ` – ${format(parseLocalDate(trip.return_date), "MMM d, yyyy")}`}
                    </p>
                  )}
                  <DepartureCountdown departDate={trip.depart_date} returnDate={trip.return_date} compact />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Trip Detail Tab ──────────────────────────────────────────────────────── */
function TripDetailTab({ clientId, tripId, onBack }: { clientId?: string; tripId: string; onBack: () => void }) {
  const { data, isLoading } = useAdminPortalTripDetail(clientId, tripId);
  const [tripTab, setTripTab] = useState<"overview" | "itinerary" | "pricing">("overview");
  const [showItinerary, setShowItinerary] = useState(false);
  const [picksByBooking, setPicksByBooking] = useState<Record<string, Record<string, boolean>>>({});

  if (isLoading) return <TabSkeleton />;
  if (!data?.trip) return <p className="text-center text-muted-foreground py-12">Trip not found.</p>;

  const { trip, bookings = [], payments = [], itinerary = [], itineraries = [], pricingLines = [] } = data;
  const handleSelectionChange = (bookingId: string, picks: Record<string, boolean>) => {
    setPicksByBooking((prev) => {
      const existing = prev[bookingId] || {};
      const same = Object.keys(picks).length === Object.keys(existing).length &&
        Object.keys(picks).every((k) => existing[k] === picks[k]);
      if (same) return prev;
      return { ...prev, [bookingId]: picks };
    });
  };
  const selectedTotal = (pricingLines || []).reduce((sum: number, l: any) => {
    const lineTotal = Number(l.total_sell ?? l.total_price ?? 0);
    if (!l.is_optional) return sum + lineTotal;
    const picks = picksByBooking[l.booking_id];
    const include = picks ? !!picks[l.id] : true; // default-on until card mounts
    return sum + (include ? lineTotal : 0);
  }, 0);
  const totalCost = selectedTotal > 0 ? selectedTotal : (trip.total_gross_sales || 0);

  const itemsByItinerary = itinerary.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.itinerary_id || "default";
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{trip.trip_name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            {trip.destination && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {trip.destination}</span>}
            {trip.depart_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(parseLocalDate(trip.depart_date), "MMM d")}
                {trip.return_date && ` – ${format(parseLocalDate(trip.return_date), "MMM d, yyyy")}`}
              </span>
            )}
            {totalCost > 0 && (
              <span className="flex items-center gap-1 font-semibold text-primary">
                <DollarSign className="h-3.5 w-3.5" />
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalCost)}
              </span>
            )}
          </div>
        </div>
        <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>{trip.status}</Badge>
      </div>

      <DepartureCountdown departDate={trip.depart_date} returnDate={trip.return_date} />

      {/* Trip Tabs */}
      <div className="flex gap-6 border-b border-border">
        {([
          { key: "overview" as const, label: "Overview" },
          { key: "itinerary" as const, label: "Full Itinerary" },
          { key: "pricing" as const, label: "Pricing" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setTripTab(tab.key)}
            className={`pb-2 text-sm font-medium transition-colors relative ${
              tripTab === tab.key ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tripTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tripTab === "overview" && (
        <>
          {payments.length > 0 && totalCost > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Payment Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentMilestoneTracker payments={payments} totalCost={totalCost} />
              </CardContent>
            </Card>
          )}

          {itinerary.length > 0 && <ItineraryLocationTimeline items={itinerary} />}

          {/* Bookings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plane className="h-4 w-4" /> Bookings ({bookings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b: any) => {
                    const typeInfo = bookingTypeIcons[b.booking_type] || bookingTypeIcons.other;
                    const bookingLines = (pricingLines || [])
                      .filter((l: any) => l.booking_id === b.id)
                      .map((l: any) => ({
                        id: l.id,
                        booking_id: l.booking_id,
                        description: l.description,
                        line_type: l.line_type,
                        unit_price: Number(l.unit_sell ?? l.unit_price ?? 0),
                        quantity: Number(l.quantity ?? 1),
                        total_price: Number(l.total_sell ?? l.total_price ?? 0),
                        is_addon: !!(l.is_pass_through || l.line_type === "addon"),
                        is_optional: !!l.is_optional,
                        deposit_amount: Number(l.deposit_amount ?? 0),
                        sort_order: l.sort_order ?? 0,
                      }));
                    return (
                      <BookingOptionsCard
                        key={b.id}
                        tripId={tripId}
                        tripName={trip?.trip_name || ""}
                        booking={b}
                        lines={bookingLines}
                        selections={[]}
                        typeIcon={typeInfo.icon}
                        typeLabel={typeInfo.label}
                        onPayDeposit={() => {}}
                        disablePay
                        pendingDepositPayment={null}
                        onSelectionChange={handleSelectionChange}
                        readOnly
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Payments ({payments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((p: any) => {
                    const isPaid = p.status === "paid";
                    const isPending = p.status === "pending";
                    const typeLabel = p.payment_type === "final_balance" ? "Final Balance" :
                      p.payment_type?.charAt(0).toUpperCase() + p.payment_type?.slice(1);

                    return (
                      <div key={p.id} className={`flex items-center justify-between p-4 rounded-lg border ${isPending ? "border-warning/30 bg-warning/10/50" : ""}`}>
                        <div className="space-y-0.5">
                          <p className="font-medium">{typeLabel}</p>
                          <p className="text-sm text-muted-foreground">
                            {p.due_date ? format(parseLocalDate(p.due_date), "MMM d, yyyy") : "Date TBD"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={cn(
                            "gap-1",
                            isPaid ? "bg-success/10 text-success border-success/30" :
                            isPending ? "bg-warning/10 text-warning border-warning/30" : ""
                          )}>
                            {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {p.status === "pending" ? "Unpaid" : p.status?.charAt(0).toUpperCase() + p.status?.slice(1)}
                          </Badge>
                          <p className="text-sm font-semibold">${Number(p.amount).toLocaleString()}</p>
                          {isPending && (
                            <Button size="sm" disabled className="opacity-50">
                              <CreditCard className="h-4 w-4 mr-1" /> Pay Now
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Itinerary Tab */}
      {tripTab === "itinerary" && (
        <div className="space-y-6">
          {itinerary.length > 0 && <ItineraryLocationTimeline items={itinerary} />}
          {itineraries.length > 0 ? (
            itineraries.map((itin: any) => {
              const items = itemsByItinerary[itin.id] || [];
              const isApproved = trip.approved_itinerary_id === itin.id;
              return (
                <Card key={itin.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {itin.name}
                          {isApproved && (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Approved
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                      {!trip.approved_itinerary_id && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-warning border-warning/30 bg-warning/10">
                            <Lock className="h-3 w-3" /> Client-only action
                          </Badge>
                          <Button size="sm" disabled className="opacity-50">
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        </div>
                      )}
                    </div>
                    {itin.overview && <p className="text-sm text-muted-foreground">{itin.overview}</p>}
                  </CardHeader>
                  {items.length > 0 && <CardContent><ItineraryItemsList items={items} /></CardContent>}
                </Card>
              );
            })
          ) : itinerary.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Full Itinerary</CardTitle></CardHeader>
              <CardContent><ItineraryItemsList items={itinerary} /></CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No itinerary items yet.</CardContent></Card>
          )}
        </div>
      )}

      {/* Pricing Tab */}
      {tripTab === "pricing" && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Pricing Breakdown</CardTitle></CardHeader>
          <CardContent>
            {pricingLines.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const grouped = pricingLines.reduce((acc: Record<string, any[]>, line: any) => {
                    (acc[line.booking_id] = acc[line.booking_id] || []).push(line);
                    return acc;
                  }, {});
                  return Object.entries(grouped).map(([bId, lines]: [string, any[]]) => {
                    const booking = bookings.find((b: any) => b.id === bId);
                    const coreLines = lines.filter((l: any) => !l.is_addon);
                    const addonLines = lines.filter((l: any) => l.is_addon);
                    return (
                      <div key={bId} className="space-y-2">
                        {Object.keys(grouped).length > 1 && (
                          <h3 className="text-sm font-semibold">{booking?.trip_name || booking?.destination || booking?.booking_reference || "Booking"}</h3>
                        )}
                        <div className="divide-y">
                          {coreLines.map((l: any) => {
                            const lineTotal = Number(l.unit_price || 0) * Number(l.quantity || 1) * Number(l.travelers || 1);
                            return (
                              <div key={l.id} className="flex justify-between py-2">
                                <div>
                                  <span className="text-sm">{l.description}</span>
                                  {(l.travelers || 1) > 1 && (
                                    <p className="text-xs text-muted-foreground">${Number(l.unit_price || 0).toFixed(2)} × {l.quantity || 1} × {l.travelers} persons</p>
                                  )}
                                </div>
                                <span className="text-sm font-medium">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            );
                          })}
                        </div>
                        {addonLines.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-muted-foreground pt-2">Add-Ons</p>
                            <div className="divide-y">
                              {addonLines.map((l: any) => {
                                const lineTotal = Number(l.unit_price || 0) * Number(l.quantity || 1) * Number(l.travelers || 1);
                                return (
                                  <div key={l.id} className="flex justify-between py-2">
                                    <div>
                                      <span className="text-sm">{l.description}</span>
                                      {(l.travelers || 1) > 1 && (
                                        <p className="text-xs text-muted-foreground">${Number(l.unit_price || 0).toFixed(2)} × {l.quantity || 1} × {l.travelers} persons</p>
                                      )}
                                    </div>
                                    <span className="text-sm font-medium">${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  });
                })()}
                <div className="flex justify-between pt-4 border-t font-bold">
                  <span>Total</span>
                  <div className="text-right">
                    <span>${pricingLines.reduce((sum: number, l: any) => sum + (Number(l.unit_price || 0) * Number(l.quantity || 1) * Number(l.travelers || 1)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {(pricingLines[0]?.travelers || 1) > 1 && (
                      <p className="text-xs text-muted-foreground font-normal">Based on {pricingLines[0].travelers} persons</p>
                    )}
                  </div>
                </div>
              </div>
            ) : totalCost > 0 ? (
              <div className="flex justify-between py-2">
                <span className="text-sm">Trip Total</span>
                <span className="text-sm font-bold">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Pricing details are not yet available.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Payments Tab ─────────────────────────────────────────────────────────── */
function PaymentsTab({ clientId }: { clientId?: string }) {
  const { data, isLoading } = useAdminPortalPayments(clientId);
  if (isLoading) return <TabSkeleton />;

  const payments = data?.payments || [];
  const paidPayments = payments.filter((p: any) => p.status === "paid");
  const pendingPayments = payments.filter((p: any) => p.status === "pending");
  const totalPaid = paidPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
                <p className="text-sm text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
                <p className="text-sm text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{payments.length}</p>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {payments.length > 0 ? (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {payments.map((p: any) => {
              const isPaid = p.status === "paid";
              const isPending = p.status === "pending";
              const typeLabel = p.payment_type === "final_balance" ? "Final Balance" :
                p.payment_type?.charAt(0).toUpperCase() + p.payment_type?.slice(1);

              return (
                <div key={p.id} className={`flex items-center justify-between p-4 rounded-lg border ${isPending ? "border-warning/30 bg-warning/10/50" : ""}`}>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{typeLabel}</p>
                      {p.trip_name && <span className="text-xs text-muted-foreground">· {p.trip_name}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.due_date ? format(parseLocalDate(p.due_date), "MMM d, yyyy") : "Date TBD"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn(
                      "gap-1",
                      isPaid ? "bg-success/10 text-success border-success/30" :
                      isPending ? "bg-warning/10 text-warning border-warning/30" : ""
                    )}>
                      {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {p.status === "pending" ? "Unpaid" : p.status?.charAt(0).toUpperCase() + p.status?.slice(1)}
                    </Badge>
                    <p className="text-lg font-bold">{formatCurrency(p.amount)}</p>
                    {isPending && (
                      <Button size="sm" disabled className="opacity-50">
                        <CreditCard className="h-4 w-4 mr-1" /> Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No payments found.</CardContent></Card>
      )}
    </div>
  );
}

/* ─── Messages Tab ─────────────────────────────────────────────────────────── */
function MessagesTab({ clientId }: { clientId?: string }) {
  const { data, isLoading } = useAdminPortalMessages(clientId);
  if (isLoading) return <TabSkeleton />;

  const messages = data?.messages || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Messages</h1>
      <Card className="flex flex-col" style={{ height: "400px" }}>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">Chat with Your Agent</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
          ) : (
            messages.map((msg: any) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[80%] p-3 rounded-lg text-sm",
                  msg.sender_type === "client"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.message}</p>
                <p className={cn(
                  "text-xs mt-1",
                  msg.sender_type === "client" ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {format(new Date(msg.created_at), "MMM d, h:mm a")}
                </p>
              </div>
            ))
          )}
        </CardContent>
        <div className="p-4 border-t">
          <p className="text-xs text-center text-muted-foreground italic">Message input disabled in admin preview</p>
        </div>
      </Card>
    </div>
  );
}

/* ─── Invoices Tab ─────────────────────────────────────────────────────────── */
function InvoicesTab({ clientId }: { clientId?: string }) {
  const { data, isLoading } = useAdminPortalInvoices(clientId);
  if (isLoading) return <TabSkeleton />;

  const invoices = data?.invoices || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No invoices found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => (
            <Card key={inv.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{inv.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {inv.invoice_date ? format(parseLocalDate(inv.invoice_date), "MMM d, yyyy") : format(parseLocalDate(inv.created_at), "MMM d, yyyy")}
                      {inv.trip_name && ` · ${inv.trip_name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={inv.status === "paid" ? "default" : inv.status === "partial" ? "secondary" : "outline"}>
                      {inv.status}
                    </Badge>
                    <p className="font-semibold mt-1">${Number(inv.total_amount || 0).toLocaleString()}</p>
                    {inv.amount_remaining > 0 && (
                      <p className="text-xs text-muted-foreground">${inv.amount_remaining.toLocaleString()} remaining</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ────────────────────────────────────────────────────── */
function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

function ItineraryItemsList({ items }: { items: any[] }) {
  const regularItems = items.filter((item: any) => !item.option_block_id);
  const grouped = regularItems.reduce((acc: Record<number, any[]>, item: any) => {
    (acc[item.day_number] = acc[item.day_number] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, dayItems]: [string, any[]]) => (
        <div key={day}>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Day {day}
            {dayItems[0]?.item_date && (
              <span className="text-muted-foreground font-normal">
                — {format(parseLocalDate(dayItems[0].item_date), "EEEE, MMM d, yyyy")}
              </span>
            )}
          </h4>
          <div className="space-y-2 ml-5 border-l-2 border-muted pl-4">
            {dayItems.map((item: any) => (
              <div key={item.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-start gap-2">
                  {(item.thumbnail_url || item.image_url) && (
                    <img
                      src={item.thumbnail_url || item.image_url}
                      alt={item.title}
                      loading="lazy"
                      className="h-16 w-16 rounded-md object-cover flex-shrink-0 border"
                    />
                  )}
                  <span className="text-lg">{categoryIcons[item.category] || "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.title}</p>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                      {(item.start_time || item.end_time) && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.start_time}{item.end_time && ` – ${item.end_time}`}
                        </span>
                      )}
                      {item.location && (
                        <span className="flex items-center gap-1">
                          <MapPinned className="h-3 w-3" /> {item.location}
                        </span>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>}
                  </div>
                </div>
                {getItemImages(item).length > 1 && (
                  <ItineraryGallery
                    images={getItemImages(item)}
                    alt={item.title}
                    className="mt-3"
                    aspectClassName="aspect-[16/10]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Documents Tab ────────────────────────────────────────────────────────── */
function DocumentsTab({ clientId }: { clientId?: string }) {
  const { data, isLoading } = useAdminPortalDocuments(clientId);
  const groups = data?.groups || [];

  if (isLoading) return <Skeleton className="h-40" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" /> Documents
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Travel documents your agent has shared with you, grouped by trip.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No documents shared yet.
          </CardContent>
        </Card>
      ) : (
        groups.map((g: any) => (
          <div key={g.trip_id} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {g.trip_name}
            </h2>
            <Card>
              <CardContent className="space-y-2 pt-4">
                {g.docs.map((d: any) => (
                  <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                    <FileText className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{d.label || d.file_name}</p>
                      {d.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {d.file_name} · Shared {format(new Date(d.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0 self-center"
                      >
                        <Download className="h-4 w-4" /> Download
                      </a>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
