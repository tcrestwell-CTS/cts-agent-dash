import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Compass,
  Plus,
  Search,
  Calendar,
  Users,
  MapPin,
  DollarSign,
  ExternalLink,
  Plane,
  Ship,
  Hotel,
  Car,
  Palmtree,
  ChevronDown,
  Loader2,
  LayoutGrid,
  List,
  FileDown,
} from "lucide-react";
import { generateBookingFlowPDF } from "@/lib/bookingFlowPDF";
import { DepartureUrgencyBadge } from "@/components/shared/DepartureUrgencyBadge";
import { Panel, EmptyState } from "@/components/patterns/Panel";
import { StatusPill } from "@/components/patterns/StatusPill";
import { useTrips } from "@/hooks/useTrips";
import { AddTripDialog } from "@/components/trips/AddTripDialog";
import { TripsKanban } from "@/components/trips/TripsKanban";
import {
  DataTable,
  DataTableHead,
  DataTableHeaderRow,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from "@/components/ui/data-table";
import type { CancellationOptions } from "@/components/trips/TripStatusWorkflow";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { useTripStatuses } from "@/hooks/useTripStatuses";
import { SupplierCard } from "@/components/suppliers/SupplierCard";
import { SupplierNotesDialog } from "@/components/suppliers/SupplierNotesDialog";
import { QuickBookingDialog } from "@/components/suppliers/QuickBookingDialog";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import type { Supplier } from "@/types/supplier";

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = parseLocalDate(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function DaysOutBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-[12px] text-muted-foreground">—</span>;
  if (days < 0)
    return (
      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-muted-foreground bg-muted">
        {Math.abs(days)}d ago
      </span>
    );
  const tone =
    days < 7
      ? "bg-destructive/15 text-destructive"
      : days < 14
        ? "bg-warning/15 text-warning"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      in {days}d
    </span>
  );
}


const initialPortalSuppliers: Supplier[] = [
  // Flights
  {
    id: "farebuzz",
    name: "FareBuzz",
    url: "https://www.farebuzz.com/default.aspx",
    description: "FareBuzz agent home portal for exclusive net fares, multi-city search, group bookings, and flight commission tracking.",
    category: "flights",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "centrav",
    name: "Centrav",
    url: "https://www.centrav.com",
    description: "Centrav consolidator portal for discounted international airfare.",
    category: "flights",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "skybird-travel",
    name: "Skybird Travel",
    url: "https://crestwelltravelservices.mywingsbooking.com/agent-login",
    description: "Skybird Travel MyWings portal for flight bookings and consolidator fares.",
    category: "flights",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  // Cruises
  {
    id: "cruisingpower",
    name: "CruisingPower",
    url: "https://www.cruisingpower.com",
    description: "Royal Caribbean's travel agent booking portal for cruise reservations and training.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "princess-cruises",
    name: "Princess Cruises",
    url: "https://www.onesourcecruises.com/onesource/login",
    description: "Princess Cruises agent portal via OneSource for cruise bookings.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "carnival",
    name: "Carnival GoCCL",
    url: "https://www.goccl.com",
    description: "Carnival Cruise Line's travel agent booking and resource center.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "ncl",
    name: "NCL Central",
    url: "https://norwegiancentral.com",
    description: "Norwegian Cruise Line's travel partner portal.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "virgin-voyages",
    name: "Virgin Voyages",
    url: "https://myfirstmates.com",
    description: "Virgin Voyages First Mates agent portal for cruise bookings.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "traveltek",
    name: "Traveltek Cruise API",
    url: "https://www.traveltek.com/travel-api-provider/cruise-api/",
    description: "Third-party API aggregator with access to multiple cruise lines. Contact for API access.",
    category: "cruises",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "api",
    apiStatus: "coming_soon",
  },
  // Hotels
  {
    id: "stayhvn",
    name: "StayHVN",
    url: "https://www.stayhvn.com",
    description: "StayHVN hotel booking platform for travel agents with curated accommodations worldwide.",
    category: "hotels",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "choice-hotels",
    name: "Choice Hotels Travel Professionals",
    url: "https://www.choicehotels.com/travel-professionals",
    description: "Choice Hotels travel professional portal for booking Quality Inn, Comfort Inn, and more.",
    category: "hotels",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "ihg-agent",
    name: "IHG Agent Portal",
    url: "https://www.ihg.com/agentconnect",
    description: "IHG travel agent portal for booking Holiday Inn, Crowne Plaza, InterContinental, and more.",
    category: "hotels",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "hilton-agent",
    name: "Hilton Travel Agents",
    url: "https://travelagents.hilton.com",
    description: "Hilton travel agent portal for booking Hilton, DoubleTree, Hampton Inn, and more.",
    category: "hotels",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "loews-agent",
    name: "Loews Hotels Agents",
    url: "https://www.loewshotels.com/agents",
    description: "Loews Hotels travel agent portal for booking luxury accommodations at Loews properties.",
    category: "hotels",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "hyatt-inclusive",
    name: "Hyatt Inclusive Collection",
    url: "https://www.hyattinclusivecollection.com/en/travel-advisors/",
    description: "Hyatt all-inclusive travel advisor portal for Dreams, Secrets, Breathless, and Zoëtry resorts.",
    category: "hotels",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  // All-Inclusive Resorts
  {
    id: "sandals",
    name: "Sandals & Beaches",
    url: "https://taportal.sandals.com/dashboard",
    description: "Sandals and Beaches Resorts travel agent portal for all-inclusive Caribbean bookings.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "amresorts",
    name: "AMResorts",
    url: "https://agents.amresorts.com",
    description: "AMResorts agent portal for Dreams, Secrets, Breathless, and other luxury all-inclusive brands.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "palace-resorts",
    name: "Palace Resorts",
    url: "https://www.palaceproagent.com",
    description: "Palace Resorts Pro Agent portal for Moon Palace, Le Blanc, and other luxury properties.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "all-in-agents",
    name: "All In Agents",
    url: "https://www.allinagents.com",
    description: "All In Agents portal powered by AIA for booking multiple all-inclusive resort brands.",
    category: "all-inclusive",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  // Transportation
  {
    id: "carey-connect",
    name: "Carey Connect",
    url: "https://connect.carey.com",
    description: "Carey corporate portal for luxury chauffeured transportation and ground services worldwide.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "carmellimo",
    name: "CarmelLimo",
    url: "https://www.carmellimo.com",
    description: "NY Limousine Service - New York City & Airport limousine services.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "welcome-partners",
    name: "Welcome Partners Platform",
    url: "https://partners.welcomepickups.com",
    description: "Crestwell Travel Services partner portal for airport transfers and personalized travel experiences.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
  {
    id: "drvn",
    name: "drvn - VIP 2.0",
    url: "https://vip.drvn.co",
    description: "drvn VIP ground transportation and transfer services for travelers.",
    category: "transportation",
    isFavorite: false,
    notes: "",
    visitCount: 0,
    integrationType: "redirect",
    apiStatus: "none",
  },
];

const portalCategories = [
  { id: "all", label: "All Portals", icon: ExternalLink },
  { id: "flights", label: "Flights", icon: Plane },
  { id: "cruises", label: "Cruises", icon: Ship },
  { id: "hotels", label: "Hotels", icon: Hotel },
  { id: "transportation", label: "Transportation", icon: Car },
  { id: "all-inclusive", label: "All-Inclusive", icon: Palmtree },
];

// Status colors are now dynamic from useTripStatuses

// CTS Bookings Widget Component
function CTSBookingsWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [widgetError, setWidgetError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !isOpen) return;
    
    containerRef.current.innerHTML = '';
    setWidgetError(false);
    
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'ptw-container';
    widgetContainer.className = 'ptw-horizontal-search bookerContainer';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://widgets.priceres.com/travel-agencyweb/jsonpBooker/startWidget?container=ptw-container&UseConfigs=false&IsHorizontal=true&WhiteLabelId=CTSBookings';
    script.async = true;
    script.onerror = () => setWidgetError(true);
    containerRef.current.appendChild(script);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLFormElement) {
            node.setAttribute('target', '_blank');
          }
          if (node instanceof HTMLElement) {
            const forms = node.querySelectorAll('form');
            forms.forEach((form) => {
              form.setAttribute('target', '_blank');
            });
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = setTimeout(() => {
      if (containerRef.current && containerRef.current.querySelector('#ptw-container')?.children.length === 0) {
        setWidgetError(true);
      }
    }, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [isOpen]);

  const handleOpenPortal = () => {
    window.open('https://travel-agencyweb.com/CTSBookings', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mb-8">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 rounded-none"
            >
              <span className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Hotel className="h-5 w-5 text-primary" />
                CTS Hotel Booking Widget
              </span>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0">
              {widgetError ? (
                <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
                  <div className="text-muted-foreground">
                    <p className="font-medium">Widget cannot load in this environment</p>
                    <p className="text-sm mt-1">The booking widget requires domain authorization from the provider.</p>
                  </div>
                  <Button onClick={handleOpenPortal} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open CTS Booking Portal
                  </Button>
                </div>
              ) : (
                <div 
                  ref={containerRef}
                  className="onlyBooker_section w-full min-h-[80px]"
                />
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

const Trips = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trips, loading, fetchTrips, updateTrip } = useTrips();
  const { processStatusChange } = useWorkflowAutomation();
  const { statuses, kanbanColumns, getStatusLabel, getStatusColor, getKanbanStatus, statusToSlug, loading: statusesLoading } = useTripStatuses();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tripNameFilter, setTripNameFilter] = useState<string>("all");

  const handleTripCreated = () => {
    setIsAddDialogOpen(false);
    fetchTrips();
  };
  
  // Initialize tab from URL param
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "portals" ? "portals" : "trips";
  const [activeTab, setActiveTab] = useState<"trips" | "portals">(initialTab);
  
  // Portal state
  const [portalSuppliers, setPortalSuppliers] = useState<Supplier[]>(initialPortalSuppliers);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [quickBookDialogOpen, setQuickBookDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const filteredTrips = trips.filter((trip) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      trip.trip_name.toLowerCase().includes(searchLower) ||
      trip.destination?.toLowerCase().includes(searchLower) ||
      trip.clients?.name.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || trip.status === statusFilter;
    const matchesTripName =
      tripNameFilter === "all" ||
      trip.trip_name?.toLowerCase().startsWith(tripNameFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesTripName;
  });

  const filteredPortalSuppliers = selectedCategory === "all" 
    ? portalSuppliers 
    : portalSuppliers.filter(s => s.category === selectedCategory);

  const favoriteSuppliers = portalSuppliers.filter(s => s.isFavorite);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleToggleFavorite = (id: string) => {
    setPortalSuppliers(prev => 
      prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)
    );
  };

  const handleOpenSite = (supplier: Supplier) => {
    setPortalSuppliers(prev =>
      prev.map(s => 
        s.id === supplier.id 
          ? { ...s, lastVisited: new Date(), visitCount: s.visitCount + 1 }
          : s
      )
    );
    window.open(supplier.url, "_blank", "noopener,noreferrer");
  };

  const handleOpenNotes = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = (id: string, notes: string) => {
    setPortalSuppliers(prev =>
      prev.map(s => s.id === id ? { ...s, notes } : s)
    );
    setNotesDialogOpen(false);
  };

  const handleQuickBook = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setQuickBookDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">
              Trips
              {!loading && (
                <span className="ml-2 text-[13px] font-medium text-muted-foreground">
                  ({filteredTrips.length}
                  {filteredTrips.length !== trips.length ? ` of ${trips.length}` : ""})
                </span>
              )}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">Manage client trips and access booking portals</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateBookingFlowPDF()}
              className="gap-1.5 rounded-[8px] text-[13px]"
            >
              <FileDown className="h-4 w-4" />
              Booking Flow PDF
            </Button>
            {activeTab === "trips" && (
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-1.5 rounded-[8px] text-[13px]">
                <Plus className="h-4 w-4" />
                New Trip
              </Button>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "trips" | "portals")}>
          <TabsList>
            <TabsTrigger value="trips" className="gap-2">
              <Compass className="h-4 w-4" />
              My Trips
            </TabsTrigger>
            <TabsTrigger value="portals" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Booking Portals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trips" className="mt-6 space-y-4">
            {/* Search + View Toggle */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search trips..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 rounded-[8px] pl-9 text-[13.5px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] rounded-[8px] text-[13.5px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={statusToSlug(s.name)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex overflow-hidden rounded-[8px] border border-border">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="rounded-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {loading || statusesLoading ? (
              <div className="grid gap-[14px]">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-[11px]" />
                ))}
              </div>
            ) : viewMode === "kanban" ? (
              kanbanColumns.length === 0 ? (
                <Panel>
                  <EmptyState
                    title="Kanban view unavailable"
                    message="Trip statuses are still syncing, so Kanban can't render yet."
                    action={
                      <Button variant="outline" size="sm" className="rounded-[8px] text-[13px]" onClick={() => setViewMode("list")}>
                        Switch to List View
                      </Button>
                    }
                  />
                </Panel>
              ) : (
                <TripsKanban
                  trips={filteredTrips.map(t => ({
                    ...t,
                    kanbanStatus: getKanbanStatus(t.status),
                  }))}
                  columns={kanbanColumns}
                  onStatusChange={async (tripId, newStatus, cancellationOptions) => {
                    const trip = filteredTrips.find(t => t.id === tripId);
                    if (!trip) return false;
                    const result = await processStatusChange(newStatus, { trip, bookings: [] }, cancellationOptions);
                    if (!result.allowed) {
                      const { toast } = await import("@/hooks/use-toast");
                      toast({ title: "Cannot change status", description: result.error, variant: "destructive" });
                      return false;
                    }
                    return await updateTrip(tripId, { status: newStatus });
                  }}
                />
              )
            ) : filteredTrips.length === 0 ? (
              <Panel>
                <EmptyState
                  title={searchQuery ? "No trips found" : "No trips yet"}
                  message={searchQuery ? "Try adjusting your search" : "Create your first trip to get started"}
                  action={
                    !searchQuery && (
                      <Button
                        onClick={() => setIsAddDialogOpen(true)}
                        className="gap-1.5 rounded-[8px] text-[13px]"
                      >
                        <Plus className="h-4 w-4" />
                        Create Trip
                      </Button>
                    )
                  }
                />
              </Panel>
            ) : (
              <Panel className="overflow-hidden p-0">
                <DataTable>
                  <DataTableHead>
                    <DataTableHeaderRow>
                      <DataTableHeaderCell>Trip / Client</DataTableHeaderCell>
                      <DataTableHeaderCell secondary>Destination</DataTableHeaderCell>
                      <DataTableHeaderCell>Departure</DataTableHeaderCell>
                      <DataTableHeaderCell align="right" secondary>Guests</DataTableHeaderCell>
                      <DataTableHeaderCell align="right">Value</DataTableHeaderCell>
                      <DataTableHeaderCell align="right" secondary>Commission</DataTableHeaderCell>
                      <DataTableHeaderCell>Status</DataTableHeaderCell>
                    </DataTableHeaderRow>
                  </DataTableHead>
                  <DataTableBody>
                    {filteredTrips.map((trip) => {
                      const days = daysUntil(trip.depart_date);
                      const guests = (trip as any).num_travelers ?? (trip as any).travelers ?? null;
                      return (
                        <DataTableRow
                          key={trip.id}
                          interactive={!trip.isOptimistic}
                          onClick={() => !trip.isOptimistic && navigate(`/trips/${trip.id}`)}
                          className={trip.isOptimistic ? "opacity-70 animate-pulse pointer-events-none" : ""}
                        >
                          <DataTableCell
                            primary={
                              <span className="flex items-center gap-2">
                                {trip.isOptimistic && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                                <span className="truncate">{trip.trip_name}</span>
                              </span>
                            }
                            sub={trip.clients?.name || "Unassigned client"}
                          />
                          <DataTableCell secondary>
                            {trip.destination ? (
                              <span className="text-[13.5px] text-muted-foreground">{trip.destination}</span>
                            ) : (
                              <span className="text-[13px] text-muted-foreground">—</span>
                            )}
                          </DataTableCell>
                          <DataTableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-[13.5px]">
                                {trip.depart_date
                                  ? format(parseLocalDate(trip.depart_date), "MMM d, yyyy")
                                  : "—"}
                              </span>
                              <DaysOutBadge days={days} />
                            </div>
                          </DataTableCell>
                          <DataTableCell align="right" secondary>
                            {guests ? (
                              <span className="[font-variant-numeric:tabular-nums]">{guests}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </DataTableCell>
                          <DataTableCell money>{formatCurrency(trip.total_gross_sales)}</DataTableCell>
                          <DataTableCell money secondary className="text-primary">
                            {formatCurrency(trip.total_commission_revenue)}
                          </DataTableCell>
                          <DataTableCell>
                            <StatusPill
                              color={getStatusColor(trip.status)}
                              label={trip.isOptimistic ? "Saving..." : getStatusLabel(trip.status)}
                            />
                          </DataTableCell>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              </Panel>
            )}
          </TabsContent>

          <TabsContent value="portals" className="mt-6 space-y-6">
            {/* Favorites Section */}
            {favoriteSuppliers.length > 0 && (
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-[14.5px] font-semibold text-foreground">
                  ⭐ Quick Access
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[14px]">
                  {favoriteSuppliers.map(supplier => (
                    <SupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      onToggleFavorite={handleToggleFavorite}
                      onOpenSite={handleOpenSite}
                      onOpenNotes={handleOpenNotes}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Portal Category Tabs */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-[18px]">
              <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0">
                {portalCategories.map(category => (
                  <TabsTrigger
                    key={category.id}
                    value={category.id}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-[8px] border border-border text-[13px]"
                  >
                    <category.icon className="h-4 w-4 mr-2" />
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={selectedCategory} className="mt-[18px]">
                {/* CTS Bookings Widget - Show on Hotels tab or All tab */}
                {(selectedCategory === "hotels" || selectedCategory === "all") && (
                  <CTSBookingsWidget />
                )}

                {filteredPortalSuppliers.length === 0 ? (
                  <Panel>
                    <EmptyState
                      title="No suppliers in this category yet"
                      message="More suppliers coming soon!"
                    />
                  </Panel>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
                    {filteredPortalSuppliers.map(supplier => (
                      <SupplierCard
                        key={supplier.id}
                        supplier={supplier}
                        onToggleFavorite={handleToggleFavorite}
                        onOpenSite={handleOpenSite}
                        onOpenNotes={handleOpenNotes}
                        onQuickBook={handleQuickBook}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      <AddTripDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onTripCreated={fetchTrips}
      />

      {/* Notes Dialog */}
      <SupplierNotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        supplier={selectedSupplier}
        onSave={handleSaveNotes}
      />

      {/* Quick Booking Dialog */}
      <QuickBookingDialog
        open={quickBookDialogOpen}
        onOpenChange={setQuickBookDialogOpen}
        supplier={selectedSupplier}
      />
    </DashboardLayout>
  );
};

export default Trips;

