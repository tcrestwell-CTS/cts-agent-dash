import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useParams, useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  DollarSign,
  Plus,
  Trash2,
  Edit,
  Building2,
  CreditCard,
  Map,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Plane,
  Ship,
  Hotel,
  ShieldCheck,
  BedDouble,
  Users as UsersIcon,
  Copy,
  Rows3,
  Columns3,
  PanelLeft,
  MoreVertical,
  Pencil,
  Settings2,
  Lock,
  Compass,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { StatusPill } from "@/components/patterns/StatusPill";
import { TripPayments } from "@/components/trips/TripPayments";
import { TripBookings } from "@/components/trips/TripBookings";
import { TripCoverImage } from "@/components/trips/TripCoverImage";
import { TripStatusWorkflow, CancellationOptions } from "@/components/trips/TripStatusWorkflow";
import { TripCloseoutChecklist } from "@/components/trips/TripCloseoutChecklist";
import { TripReadinessScore } from "@/components/trips/TripReadinessScore";
import { AgentTripDocuments } from "@/components/trips/AgentTripDocuments";
import { SupplierPaymentStatus } from "@/components/trips/SupplierPaymentStatus";
import { PublishTripButton } from "@/components/trips/PublishTripButton";
import { SubTrips } from "@/components/trips/SubTrips";
import { CabinOptionsManager } from "@/components/trips/CabinOptionsManager";
import { BalconyCabinsSection } from "@/components/trips/BalconyCabinsSection";
import { TripSettingsSidebar } from "@/components/trips/TripSettingsSidebar";
import { TripTravelersCard } from "@/components/trips/TripTravelersCard";
import { DepartureUrgencyBadge } from "@/components/shared/DepartureUrgencyBadge";
import { WorkflowTasks } from "@/components/trips/WorkflowTasks";

import { WidgetyCruiseImportDialog } from "@/components/trips/WidgetyCruiseImportDialog";
import { EditTripDialog } from "@/components/trips/EditTripDialog";
import { TripSidebar } from "@/components/trips/TripSidebar";
import { TripItinerary, type ItinerarySidebarCallbacks } from "@/components/trips/TripItinerary";
import { ItinerarySidebar } from "@/components/trips/ItinerarySidebar";
import { CreateItinerarySheet } from "@/components/trips/CreateItinerarySheet";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { useItinerary } from "@/hooks/useItinerary";
import { useItineraries, type Itinerary } from "@/hooks/useItineraries";
import { useTrip, useTrips } from "@/hooks/useTrips";
import { ClientSearchCombobox, type SelectedClient } from "@/components/shared/ClientSearchCombobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTripTravelers } from "@/hooks/useTripTravelers";
import { useTripPayments } from "@/hooks/useTripPayments";
import { useProfile } from "@/hooks/useProfile";
import { useEarningsLabel } from "@/hooks/useEarningsLabel";
import { usePermissions } from "@/hooks/usePermissions";
import { parseLocalDate } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WorkspaceBreadcrumbs } from "@/components/layout/WorkspaceBreadcrumbs";

type OuterTab = "itinerary" | "details" | "bookings";


const TripDetail = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const innerBookingsTab = searchParams.get("tab") === "payments" ? "payments" : "bookings";

  const activeTab: OuterTab = useMemo(() => {
    if (location.pathname.endsWith("/itinerary")) return "itinerary";
    const t = searchParams.get("tab");
    if (t === "bookings" || t === "payments") return "bookings";
    return "details";
  }, [location.pathname, searchParams]);

  const goToTab = (tab: OuterTab) => {
    if (tab === "itinerary") navigate(`/trips/${tripId}/itinerary`);
    else if (tab === "bookings") navigate(`/trips/${tripId}?tab=bookings`);
    else navigate(`/trips/${tripId}`);
  };

  const { trip, bookings, subTrips, loading, removeBookingFromTrip, updateTripStatus, updatingStatus, fetchTrip } = useTrip(tripId);
  const { trips: allTrips, deleteTrip, cloneTrip, creating: cloning } = useTrips();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherQuery, setSwitcherQuery] = useState("");
  const { payments } = useTripPayments(tripId);
  const { profile } = useProfile();
  const earnings = useEarningsLabel();
  const { isAdmin } = usePermissions();
  const { data: tripTravelers = [] } = useTripTravelers(tripId);
  const hasPayments = payments.length > 0;
  const [isSendingPortalLink, setIsSendingPortalLink] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { processStatusChange } = useWorkflowAutomation();
  const { addItem: addItineraryItem } = useItinerary(tripId);

  // ── Itinerary tab state (was ItineraryBuilder.tsx) ────────────────────────
  const { itineraries, activeId, setActiveId, createItinerary, updateItinerary, renameItinerary, deleteItinerary, duplicateItinerary } = useItineraries(tripId);
  const [layout, setLayout] = useState<"vertical" | "horizontal">("horizontal");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [itinerarySidebarCallbacks, setItinerarySidebarCallbacks] = useState<ItinerarySidebarCallbacks | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteItineraryConfirmId, setDeleteItineraryConfirmId] = useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editingItinerary, setEditingItinerary] = useState<Itinerary | null>(null);
  const [editApprovedAnyway, setEditApprovedAnyway] = useState(false);

  // Persist the unlock per itinerary so edits (e.g. adding photos) survive a reload
  useEffect(() => {
    if (!activeId) { setEditApprovedAnyway(false); return; }
    try {
      setEditApprovedAnyway(localStorage.getItem(`itinerary-unlocked:${activeId}`) === "1");
    } catch {
      setEditApprovedAnyway(false);
    }
  }, [activeId]);

  const setItineraryUnlocked = useCallback((unlocked: boolean) => {
    setEditApprovedAnyway(unlocked);
    if (!activeId) return;
    try {
      if (unlocked) localStorage.setItem(`itinerary-unlocked:${activeId}`, "1");
      else localStorage.removeItem(`itinerary-unlocked:${activeId}`);
    } catch { /* ignore */ }
  }, [activeId]);

  const activeItinerary = useMemo(
    () => itineraries.find((i) => i.id === activeId),
    [itineraries, activeId]
  );
  const activeDepartDate = activeItinerary?.depart_date ?? trip?.depart_date ?? null;
  const activeReturnDate = activeItinerary?.return_date ?? trip?.return_date ?? null;
  const isApprovedActive = !!trip?.approved_itinerary_id && trip.approved_itinerary_id === activeId;
  const isItineraryLocked = isApprovedActive && !editApprovedAnyway;

  const handleItinerarySidebarReady = useCallback((callbacks: ItinerarySidebarCallbacks) => {
    setItinerarySidebarCallbacks(callbacks);
  }, []);

  const handleRenameStart = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleRenameSubmit = async () => {
    if (renamingId && renameValue.trim()) {
      await renameItinerary(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const handleDeleteItinerary = async () => {
    if (deleteItineraryConfirmId) {
      await deleteItinerary(deleteItineraryConfirmId);
      setDeleteItineraryConfirmId(null);
    }
  };

  // ── Trip details tab state (was TripDetail.tsx) ───────────────────────────

  const { data: invoiceData } = useQuery({
    queryKey: ["trip-invoice-number", tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("trip_id", tripId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.invoice_number || null;
    },
    enabled: !!tripId,
  });

  const { data: selectedCabin } = useQuery({
    queryKey: ["trip-selected-cabin", tripId, trip?.selected_cabin_option_id],
    queryFn: async () => {
      if (!trip?.selected_cabin_option_id) return null;
      const { data } = await supabase
        .from("trip_cabin_options")
        .select("id, category_name, description, price_per_person, deposit_amount, capacity, image_url")
        .eq("id", trip.selected_cabin_option_id)
        .maybeSingle();
      return data || null;
    },
    enabled: !!trip?.selected_cabin_option_id,
  });

  const { data: insuranceData } = useQuery({
    queryKey: ["trip-insurance-financials", tripId],
    queryFn: async () => {
      const { data: responses } = await supabase
        .from("trip_insurance_responses")
        .select("*")
        .eq("trip_id", tripId!)
        .eq("response_type", "accepted");

      if (!responses || responses.length === 0) {
        const { data: quotes } = await supabase
          .from("trip_insurance_quotes")
          .select("id, premium_amount, is_recommended")
          .eq("trip_id", tripId!);

        const recommendedQuote = quotes?.find((q: any) => q.is_recommended) || quotes?.[0];
        return {
          status: quotes && quotes.length > 0 ? "pending" as const : "none" as const,
          premium: recommendedQuote?.premium_amount || 0,
          quoteCount: quotes?.length || 0,
        };
      }

      const acceptedResponse = responses[0];
      if (acceptedResponse.selected_quote_id) {
        const { data: quote } = await supabase
          .from("trip_insurance_quotes")
          .select("premium_amount, provider_name, plan_name")
          .eq("id", acceptedResponse.selected_quote_id)
          .single();
        return {
          status: "accepted" as const,
          premium: quote?.premium_amount || 0,
          providerName: quote?.provider_name,
          planName: quote?.plan_name,
        };
      }
      return { status: "accepted" as const, premium: 0 };
    },
    enabled: !!tripId,
  });

  const handleWorkflowStatusChange = async (newStatus: string, cancellationOptions?: CancellationOptions) => {
    if (!trip) return false;
    setWorkflowError(null);
    const result = await processStatusChange(newStatus, { trip, bookings }, cancellationOptions);
    if (!result.allowed) {
      setWorkflowError(result.error || "Cannot transition to this status");
      return false;
    }
    return updateTripStatus(newStatus);
  };

  useEffect(() => {
    const handleFocus = () => {
      fetchTrip();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchTrip]);

  const handleSendPortalLink = async () => {
    if (!trip?.clients?.email) {
      toast.error("Client has no email address");
      return;
    }
    setIsSendingPortalLink(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "send-magic-link", email: trip.clients.email }),
        }
      );
      if (!res.ok) throw new Error("Failed to send");
      toast.success(`Portal access link sent to ${trip.clients.email}`);
    } catch {
      toast.error("Failed to send portal link");
    } finally {
      setIsSendingPortalLink(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleDelete = async () => {
    if (trip) {
      const success = await deleteTrip(trip.id);
      if (success) {
        navigate("/trips");
      }
    }
  };

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneClient, setCloneClient] = useState<SelectedClient | null>(null);

  const handleClone = async () => {
    if (!trip || !cloneClient) return;
    const newTrip = await cloneTrip(trip.id, cloneClient.id);
    if (newTrip) {
      setCloneOpen(false);
      setCloneClient(null);
      navigate(`/trips/${newTrip.id}`);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-48 lg:col-span-2" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!trip) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive font-medium">Trip not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/trips")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trips
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isGroupTrip = trip.trip_type === "group";
  const showRightSidebar = activeTab !== "itinerary";

  const tripSettings = {
    currency: (trip as any).currency || "USD",
    pricing_visibility: (trip as any).pricing_visibility || "show_all",
    tags: (trip as any).tags || [],
    allow_pdf_downloads: (trip as any).allow_pdf_downloads || false,
    itinerary_style: (trip as any).itinerary_style || "vertical_list",
    deposit_required: (trip as any).deposit_required || false,
    deposit_amount: (trip as any).deposit_amount || 0,
    deposit_override: (trip as any).deposit_override || false,
    payment_mode: (trip as any).payment_mode || "deposit_balance",
    upgrade_notes: (trip as any).upgrade_notes || "",
    group_landing_enabled: (trip as any).group_landing_enabled || false,
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <WorkspaceBreadcrumbs
          tripName={trip.trip_name}
          tripId={trip.id}
          section={activeTab}
          onSectionChange={(s) => goToTab(s)}
        />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => trip.parent_trip_id ? navigate(`/trips/${trip.parent_trip_id}`) : navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">{trip.trip_name}</h1>
                <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label="Switch trip"
                    >
                      <ChevronsUpDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[320px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search trips…"
                        value={switcherQuery}
                        onValueChange={setSwitcherQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No trips found.</CommandEmpty>
                        <CommandGroup heading="Recent trips">
                          {(allTrips || [])
                            .filter((t) => !switcherQuery ||
                              t.trip_name.toLowerCase().includes(switcherQuery.toLowerCase()) ||
                              (t.destination || "").toLowerCase().includes(switcherQuery.toLowerCase()) ||
                              ((t as any).clients?.name || "").toLowerCase().includes(switcherQuery.toLowerCase())
                            )
                            .slice(0, 30)
                            .map((t) => {
                              const isCurrent = t.id === trip.id;
                              const clientName = (t as any).clients?.name;
                              return (
                                <CommandItem
                                  key={t.id}
                                  value={`${t.trip_name} ${clientName ?? ""} ${t.destination ?? ""}`}
                                  onSelect={() => {
                                    setSwitcherOpen(false);
                                    setSwitcherQuery("");
                                    if (!isCurrent) navigate(`/trips/${t.id}${activeTab === "itinerary" ? "/itinerary" : ""}`);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <Check className={`h-3.5 w-3.5 ${isCurrent ? "opacity-100 text-accent" : "opacity-0"}`} />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium">{t.trip_name}</p>
                                    <p className="truncate text-[11.5px] text-muted-foreground">
                                      {clientName || "No client"}
                                      {t.destination ? ` · ${t.destination}` : ""}
                                      {t.depart_date ? ` · ${format(parseLocalDate(t.depart_date) as Date, "MMM d, yyyy")}` : ""}
                                    </p>
                                  </div>
                                  <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                                    {t.status}
                                  </span>
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <StatusPill
                  color="hsl(var(--accent))"
                  label={trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                />
                {trip.trip_type && (
                  <Badge variant="secondary">
                    {trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1).replace(/_/g, " ")}
                  </Badge>
                )}
                {(trip as any).trip_subtype && (
                  <Badge variant="outline">
                    {String((trip as any).trip_subtype)
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-muted-foreground text-[13px]">
                  {trip.clients?.name ||
                    (() => {
                      const primary = tripTravelers.find((t) => t.is_primary) || tripTravelers[0];
                      return primary
                        ? `${primary.first_name}${primary.last_name ? " " + primary.last_name : ""}`
                        : "No client assigned";
                    })()}
                </span>
                {trip.destination && (
                  <span className="text-[12px] text-muted-foreground/70 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{trip.destination}
                  </span>
                )}
                <DepartureUrgencyBadge departDate={trip.depart_date} showIcon={true} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-[13px]" onClick={() => navigate(`/flights?tripId=${trip.id}`)}>
              <Plane className="h-4 w-4 mr-2" />
              Search Flights
            </Button>
            <WidgetyCruiseImportDialog
              tripId={trip.id}
              departDate={trip.depart_date}
              returnDate={trip.return_date}
              destination={trip.destination}
              cruiseBookings={bookings.filter((b: any) => b.suppliers?.supplier_type?.toLowerCase() === "cruise")}
              onImport={async (items) => {
                let success = true;
                for (const item of items) {
                  const res = await addItineraryItem({
                    trip_id: trip.id,
                    day_number: item.day_number || 1,
                    title: item.title,
                    description: item.description || undefined,
                    category: item.category || "cruise",
                    location: item.location || undefined,
                    start_time: item.start_time || undefined,
                    end_time: item.end_time || undefined,
                    notes: item.notes || undefined,
                    sort_order: items.indexOf(item),
                  });
                  if (!res) { success = false; break; }
                }
                return success;
              }}
            />
            <PublishTripButton
              tripId={trip.id}
              shareToken={(trip as any).share_token}
              publishedAt={(trip as any).published_at}
              updatedAt={trip.updated_at}
              onPublished={fetchTrip}
            />
            <Dialog open={cloneOpen} onOpenChange={(o) => { setCloneOpen(o); if (!o) setCloneClient(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-[13px]" disabled={cloning}>
                  {cloning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
                  Clone Trip
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clone trip to a new client</DialogTitle>
                  <DialogDescription>
                    Copies destination, dates, and trip settings to a new trip for the client you select.
                    Status resets to Lead. Bookings, payments, and itinerary items are not copied.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <ClientSearchCombobox
                    value={cloneClient}
                    onSelect={setCloneClient}
                    onClear={() => setCloneClient(null)}
                    excludeClientIds={trip.client_id ? [trip.client_id] : []}
                    label="Select client for the new trip"
                    description="The cloned trip will be assigned to this client."
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCloneOpen(false)}>Cancel</Button>
                  <Button onClick={handleClone} disabled={!cloneClient || cloning}>
                    {cloning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Clone Trip
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Workspace tabs */}
        <Tabs value={activeTab} onValueChange={(v) => goToTab(v as OuterTab)}>
          <TabsList>
            <TabsTrigger value="itinerary" className="flex items-center gap-2 text-[13px]">
              <Compass className="h-4 w-4" />
              Itinerary
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2 text-[13px]">
              <Map className="h-4 w-4" />
              Trip details
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2 text-[13px]">
              <Building2 className="h-4 w-4" />
              Bookings
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Mobile Action Bar */}
        <div className="lg:hidden flex flex-wrap items-center gap-2 rounded-[9px] border border-border bg-card p-3">
          {trip.client_id && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/contacts/${trip.client_id}`}>
                <Users className="h-4 w-4 mr-2" />
                Client
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(`/trips/${tripId}/insurance`)}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Insurance
          </Button>
        </div>

        {/* Main content with left sidebar */}
        <div className={showRightSidebar
          ? "grid gap-6 lg:grid-cols-[200px_1fr] 2xl:grid-cols-[210px_minmax(0,1fr)_360px] items-start"
          : "grid gap-6 lg:grid-cols-[200px_1fr] items-start"
        }>
          <TripSidebar
            tripId={tripId!}
            parentTripId={trip.parent_trip_id}
            clientId={trip.client_id}
            clientName={trip.clients?.name}
            clientEmail={trip.clients?.email}
            tripName={trip.trip_name}
            tripStatus={trip.status}
            hasPayments={hasPayments}
            tripTotalAmount={trip.total_gross_sales || 0}
            depositRequired={(trip as any).deposit_required || false}
            depositAmount={(trip as any).deposit_amount || 0}
            destination={trip.destination}
            departDate={trip.depart_date}
            returnDate={trip.return_date}
            shareToken={(trip as any).share_token}
            defaultBookingRef={bookings?.[0]?.confirmation_number || ""}
            invoiceNumber={invoiceData || undefined}
            clientAddress={trip.clients ? {
              line1: trip.clients.address_line_1,
              city: trip.clients.address_city,
              state: trip.clients.address_state,
              zipCode: trip.clients.address_zip_code,
              country: trip.clients.address_country,
            } : undefined}
            isSendingPortalLink={isSendingPortalLink}
            onSendPortalLink={handleSendPortalLink}
            onFlightSearch={() => navigate(`/flights?tripId=${tripId}`)}
            onDelete={handleDelete}
          />

          {/* Center / main content */}
          <div className="space-y-6">
            {activeTab === "itinerary" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 border-b overflow-x-auto">
                    {itineraries.map((itin) => (
                      <div key={itin.id} className="flex items-center group shrink-0">
                        {renamingId === itin.id ? (
                          <form
                            onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(); }}
                            className="flex items-center px-1 pb-2"
                          >
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              className="h-7 w-40 text-[13.5px]"
                              autoFocus
                              onBlur={handleRenameSubmit}
                            />
                          </form>
                        ) : (
                          <button
                            onClick={() => setActiveId(itin.id)}
                            className={`px-3 py-2 text-[13.5px] font-medium border-b-2 transition-colors ${
                              activeId === itin.id
                                ? "border-accent text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                            }`}
                          >
                            {itin.name}
                            {trip.approved_itinerary_id === itin.id && (
                              <CheckCircle2 className="inline h-3.5 w-3.5 ml-1 text-accent" />
                            )}
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem onClick={() => { setEditingItinerary(itin); setCreateSheetOpen(true); }}>
                              <Settings2 className="h-3.5 w-3.5 mr-2" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRenameStart(itin.id, itin.name)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateItinerary(itin.id)}>
                              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            {itineraries.length > 1 && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteItineraryConfirmId(itin.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    <button
                      onClick={() => { setEditingItinerary(null); setCreateSheetOpen(true); }}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <TooltipProvider>
                    <div className="flex items-center gap-2 shrink-0">
                      {itinerarySidebarCallbacks && (
                        <WidgetyCruiseImportDialog
                          tripId={trip.id}
                          departDate={activeDepartDate}
                          returnDate={activeReturnDate}
                          destination={trip.destination}
                          cruiseBookings={bookings?.filter((b: any) => b.suppliers?.supplier_type?.toLowerCase() === "cruise") || []}
                          onImport={itinerarySidebarCallbacks.onWidgetyImport}
                        />
                      )}
                      <div className="flex items-center rounded-lg border bg-muted p-1 gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={layout === "vertical" ? "secondary" : "ghost"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setLayout("vertical")}
                            >
                              <Rows3 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Vertical layout</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={layout === "horizontal" ? "secondary" : "ghost"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setLayout("horizontal")}
                            >
                              <Columns3 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Horizontal layout</TooltipContent>
                        </Tooltip>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                          >
                            <PanelLeft className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>

                {trip.approved_itinerary_id && (
                  <div className="flex items-center gap-2 text-[13px] rounded-[9px] border border-border px-4 py-2.5 bg-tint text-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                    <span className="font-medium">
                      Client approved: {itineraries.find(i => i.id === trip.approved_itinerary_id)?.name || "an itinerary"}
                    </span>
                    {trip.itinerary_approved_at && (
                      <span className="text-[12px] text-muted-foreground ml-auto">
                        {format(new Date(trip.itinerary_approved_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    )}
                  </div>
                )}

                {isApprovedActive && (
                  <div className="flex items-center gap-2 text-[13px] rounded-[9px] border border-warning/40 px-4 py-2.5 bg-warning/10 text-warning">
                    {isItineraryLocked ? <Lock className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    <span className="font-medium">
                      {isItineraryLocked
                        ? "This itinerary was approved by the client and is locked to preserve the signed snapshot."
                        : "Editing the approved itinerary — changes may invalidate the client's signature."}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7"
                      onClick={() => setItineraryUnlocked(isItineraryLocked)}
                    >
                      {isItineraryLocked ? "Unlock to edit" : "Re-lock"}
                    </Button>
                    {!isItineraryLocked && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7"
                        onClick={() => duplicateItinerary(activeId!)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate instead
                      </Button>
                    )}
                  </div>
                )}

                {activeItinerary?.cover_image_url && (
                  <div className="relative rounded-[11px] overflow-hidden border border-border">
                    <img
                      src={activeItinerary.cover_image_url}
                      alt={`${activeItinerary.name} cover`}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-6">
                      <h2 className="text-white text-[16.5px] font-semibold drop-shadow-md">{activeItinerary.name}</h2>
                    </div>
                  </div>
                )}

                {activeItinerary?.overview && (
                  <div className="rounded-[9px] border border-border bg-card-2 px-5 py-4">
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{activeItinerary.overview}</p>
                  </div>
                )}

                <div className="flex gap-0 rounded-[11px] border border-border bg-background overflow-hidden relative" style={{ minHeight: "calc(100vh - 340px)" }}>
                  <div className={`flex-1 p-6 overflow-y-auto ${isItineraryLocked ? "pointer-events-none opacity-60 select-none" : ""}`} aria-disabled={isItineraryLocked}>
                    {activeId && (
                      <TripItinerary
                        tripId={tripId!}
                        itineraryId={activeId}
                        parentTripId={trip.parent_trip_id}
                        destination={trip.destination}
                        departDate={activeDepartDate}
                        returnDate={activeReturnDate}
                        tripName={trip.trip_name}
                        bookings={bookings}
                        layout={layout}
                        hideToolbar={sidebarOpen}
                        onSidebarReady={handleItinerarySidebarReady}
                      />
                    )}
                  </div>

                  {sidebarOpen && itinerarySidebarCallbacks && (
                    <ItinerarySidebar
                      tripId={tripId!}
                      destination={trip.destination}
                      departDate={activeDepartDate}
                      returnDate={activeReturnDate}
                      tripName={trip.trip_name}
                      bookings={bookings}
                      generating={itinerarySidebarCallbacks.generating}
                      hasItems={itinerarySidebarCallbacks.hasItems}
                      unimportedBookings={itinerarySidebarCallbacks.unimportedBookings}
                      onAIGenerate={itinerarySidebarCallbacks.onAIGenerate}
                      onImportBookings={itinerarySidebarCallbacks.onImportBookings}
                      onExportPDF={itinerarySidebarCallbacks.onExportPDF}
                      onClearAll={itinerarySidebarCallbacks.onClearAll}
                      onAddCategory={itinerarySidebarCallbacks.onAddCategory}
                      onWidgetyImport={itinerarySidebarCallbacks.onWidgetyImport}
                      totalDays={itinerarySidebarCallbacks.totalDays}
                      onAddParsedItem={itinerarySidebarCallbacks.onAddParsedItem}
                      items={itinerarySidebarCallbacks.items}
                      activeItineraryId={activeId}
                      activeHeaderStyle={(activeItinerary as any)?.header_style ?? null}
                      activeFontStyle={(activeItinerary as any)?.font_style ?? null}
                      hasCoverImage={!!activeItinerary?.cover_image_url}
                      onUpdateItineraryStyle={async (id, updates) => { await updateItinerary(id, updates as any); }}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === "details" && (
              <>
                {/* Status Workflow */}
                <TripStatusWorkflow
                  currentStatus={trip.status}
                  tripName={trip.trip_name}
                  onStatusChange={handleWorkflowStatusChange}
                  disabled={updatingStatus}
                  readinessComplete={
                    !!(trip as any).budget_range &&
                    !!trip.depart_date &&
                    !!trip.return_date &&
                    bookings.some((b: any) => b.supplier_id) &&
                    trip.total_commission_revenue > 0
                  }
                  validationError={workflowError}
                />

                {/* Workflow Tasks */}
                <WorkflowTasks tripId={trip.id} />

                {/* Cover Image */}
                <TripCoverImage
                  tripId={trip.id}
                  coverImageUrl={(trip as any).cover_image_url}
                  onUpdated={fetchTrip}
                />

                {/* Trip Details & Financials */}
                <div className={isGroupTrip ? "grid gap-6 md:grid-cols-2" : "grid gap-6 lg:grid-cols-3"}>
                  <Card className={isGroupTrip ? "" : "lg:col-span-2"}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <CardTitle className="text-[14.5px]">Trip Details</CardTitle>
                      <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={() => setEditDialogOpen(true)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {trip.destination && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[13.5px]">
                              <span className="text-muted-foreground">Destination:</span>{" "}
                              {trip.destination}
                            </span>
                          </div>
                        )}
                        {((trip as any).trip_subtype === "cruise" || trip.trip_type === "cruise") &&
                          (trip as any).ship_name && (
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[13.5px]">
                              <span className="text-muted-foreground">Ship:</span>{" "}
                              {(trip as any).ship_name}
                            </span>
                          </div>
                        )}
                        {["lodging", "all_inclusive"].includes(
                          ((trip as any).trip_subtype || trip.trip_type || "") as string
                        ) &&
                          (trip as any).hotel_name && (
                            <div className="flex items-center gap-2">
                              <Hotel className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[13.5px]">
                                <span className="text-muted-foreground">Property:</span>{" "}
                                {(trip as any).hotel_name}
                              </span>
                            </div>
                          )}
                        {trip.depart_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[13.5px]">
                              <span className="text-muted-foreground">Dates:</span>{" "}
                              {format(parseLocalDate(trip.depart_date), "MMM d, yyyy")}
                              {trip.return_date && (
                                <> - {format(parseLocalDate(trip.return_date), "MMM d, yyyy")}</>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      {trip.notes && (
                        <div className="pt-2 border-t">
                          <p className="text-[12.5px] text-muted-foreground mb-1">Trip Details Overview</p>
                          <p className="text-[13.5px]">{trip.notes}</p>
                        </div>
                      )}
                      {((trip as any).cabin_selection || ((trip as any).cabin_photos?.length ?? 0) > 0) && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <BedDouble className="h-4 w-4 text-muted-foreground" />
                            <p className="text-[12.5px] text-muted-foreground">Cabin Selection</p>
                          </div>
                          {(trip as any).cabin_selection && (
                            <p className="text-[13.5px] font-medium mb-2">{(trip as any).cabin_selection}</p>
                          )}
                          {((trip as any).cabin_photos?.length ?? 0) > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {((trip as any).cabin_photos as string[]).map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block aspect-video overflow-hidden rounded-[9px] border border-border bg-muted"
                                >
                                  <img
                                    src={url}
                                    alt={`Cabin photo ${i + 1}`}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {(trip as any).budget_range && (
                        <div className="pt-2 border-t">
                          <p className="text-[12.5px] text-muted-foreground mb-2">Budget</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[13.5px] font-medium">{(trip as any).budget_range}</span>
                            {(trip as any).budget_confirmed ? (
                              <StatusPill color="hsl(var(--success))" label="Client Confirmed" />
                            ) : (trip as any).budget_change_requested ? (
                              <StatusPill color="hsl(var(--warning))" label="Change Requested" />
                            ) : (
                              <StatusPill color="hsl(var(--muted-foreground))" label="Pending Approval" />
                            )}
                          </div>
                          {(trip as any).budget_change_requested && (trip as any).budget_change_request_message && (
                            <div className="mt-2 rounded-[9px] bg-warning/10 border border-warning/30 p-3">
                              <p className="text-[12px] text-warning italic">
                                "{(trip as any).budget_change_request_message}"
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-[14.5px] flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Trip Financials
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-[13px] text-muted-foreground">Gross Sales</span>
                        <span className="text-[14px] font-semibold tabular-nums">
                          {formatCurrency(trip.total_gross_sales)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-[13px] text-muted-foreground">Supplier Payout</span>
                        <span className="text-[14px] font-medium tabular-nums">
                          {formatCurrency(trip.total_supplier_payout)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-[13px] text-muted-foreground">Net Sales</span>
                        <span className="text-[14px] font-medium tabular-nums">
                          {formatCurrency(trip.total_net_sales)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-[13px] text-muted-foreground">Total {earnings.singular}</span>
                        <span className="text-[14px] font-semibold text-accent tabular-nums">
                          {formatCurrency(trip.total_commission_revenue)}
                        </span>
                      </div>

                      {insuranceData && insuranceData.status !== "none" && (
                        <div className="flex justify-between items-center py-2 border-b">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[13px] text-muted-foreground">
                              Insurance
                              {insuranceData.status === "accepted" && insuranceData.providerName && (
                                <span className="text-[11.5px] ml-1">({insuranceData.providerName})</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium tabular-nums">
                              {formatCurrency(insuranceData.premium)}
                            </span>
                            {insuranceData.status === "accepted" ? (
                              <StatusPill color="hsl(var(--success))" label="Approved" className="text-[10px]" />
                            ) : (
                              <StatusPill color="hsl(var(--warning))" label="Pending" className="text-[10px]" />
                            )}
                          </div>
                        </div>
                      )}

                      {insuranceData?.status === "accepted" && insuranceData.premium > 0 && (
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-[13.5px] font-medium">Total incl. Insurance</span>
                          <span className="text-[14px] font-bold tabular-nums">
                            {formatCurrency(trip.total_gross_sales + insuranceData.premium)}
                          </span>
                        </div>
                      )}

                      {trip.total_commission_revenue > 0 && profile && (() => {
                        const tierKey = profile.commission_tier || "tier_1";
                        const baseTierConfig = {
                          none: { label: "None", agentSplit: 0, agencySplit: 100 },
                          tier_1: { label: "Tier 1", agentSplit: 70, agencySplit: 30 },
                          tier_2: { label: "Tier 2", agentSplit: 80, agencySplit: 20 },
                          tier_3: { label: "Tier 3", agentSplit: 95, agencySplit: 5 },
                        }[tierKey] || { label: "Tier 1", agentSplit: 70, agencySplit: 30 };
                        const tierConfig = isAdmin
                          ? { label: "Owner", agentSplit: 0, agencySplit: 100 }
                          : baseTierConfig;

                        const agentCommissionBase = trip.total_commission_revenue;
                        const advisorPayout = agentCommissionBase * (tierConfig.agentSplit / 100);
                        const agencyRetained = agentCommissionBase * (tierConfig.agencySplit / 100);

                        return (
                          <div className="pt-2 space-y-2">
                            <p className="text-[10.5px] font-bold uppercase tracking-[.13em] text-muted-foreground">
                              {earnings.singular} Split ({tierConfig.label}: {tierConfig.agentSplit}/{tierConfig.agencySplit})
                            </p>
                            <div className="flex justify-between items-center py-1">
                              <span className="text-[13px] text-muted-foreground">Advisor Payout</span>
                              <span className="text-[14px] font-semibold text-success tabular-nums">
                                {formatCurrency(advisorPayout)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                              <span className="text-[13px] text-muted-foreground">Agency Retains</span>
                              <span className="text-[14px] font-medium tabular-nums">
                                {formatCurrency(agencyRetained)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {trip.total_gross_sales > 0 && (
                        <div className="flex justify-between items-center py-2 border-t">
                          <span className="text-[13px] text-muted-foreground">Margin %</span>
                          <span className="text-[14px] font-semibold text-accent tabular-nums">
                            {((trip.total_commission_revenue / trip.total_gross_sales) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {isGroupTrip && (
                  <CabinOptionsManager tripId={trip.id} onDataChange={fetchTrip} />
                )}

                {!isGroupTrip && selectedCabin && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-[13.5px] flex items-center gap-2">
                        <BedDouble className="h-4 w-4" /> Selected Stateroom
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row gap-4">
                        {selectedCabin.image_url && (
                          <img
                            src={selectedCabin.image_url}
                            alt={selectedCabin.category_name}
                            className="w-full sm:w-48 h-32 object-cover rounded-[9px] border border-border"
                          />
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-[15px] font-semibold">{selectedCabin.category_name}</h3>
                              {selectedCabin.description && (
                                <p className="text-[13px] text-muted-foreground mt-1">{selectedCabin.description}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className="shrink-0">Selected</Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground pt-1">
                            {selectedCabin.price_per_person != null && (
                              <span className="flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5" />
                                ${Number(selectedCabin.price_per_person).toLocaleString()} per guest
                              </span>
                            )}
                            {selectedCabin.capacity != null && (
                              <span className="flex items-center gap-1.5">
                                <UsersIcon className="h-3.5 w-3.5" />
                                Sleeps {selectedCabin.capacity}
                              </span>
                            )}
                            {selectedCabin.deposit_amount != null && Number(selectedCabin.deposit_amount) > 0 && (
                              <span className="flex items-center gap-1.5">
                                <CreditCard className="h-3.5 w-3.5" />
                                ${Number(selectedCabin.deposit_amount).toLocaleString()} deposit
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {isGroupTrip && (
                  <BalconyCabinsSection tripId={trip.id} />
                )}

                {isGroupTrip && (
                  <SubTrips
                    parentTripId={trip.id}
                    subTrips={subTrips}
                    onDataChange={fetchTrip}
                  />
                )}
              </>
            )}

            {activeTab === "bookings" && (
              <Tabs defaultValue={innerBookingsTab} className="w-full">
                <TabsList>
                  <TabsTrigger value="bookings" className="flex items-center gap-2 text-[13px]">
                    <Building2 className="h-4 w-4" />
                    Bookings
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="flex items-center gap-2 text-[13px]">
                    <CreditCard className="h-4 w-4" />
                    Payments
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="bookings" className="mt-6 space-y-6">
                  <TripBookings
                    tripId={tripId!}
                    clientId={trip.client_id}
                    bookings={bookings}
                    tripTotal={trip.total_gross_sales}
                    totalCommission={trip.total_commission_revenue}
                    destination={trip.destination || undefined}
                    departDate={trip.depart_date || undefined}
                    returnDate={trip.return_date || undefined}
                    onDataChange={fetchTrip}
                  />
                  <SupplierPaymentStatus
                    bookings={bookings as any}
                  />
                </TabsContent>

                <TabsContent value="payments" className="mt-6">
                  <TripPayments
                    tripId={tripId!}
                    clientId={trip.client_id}
                    bookings={bookings}
                    tripTotal={trip.total_gross_sales}
                    tripName={trip.trip_name}
                    clientName={trip.clients?.name}
                    clientEmail={trip.clients?.email || undefined}
                    clientPhone={trip.clients?.phone || undefined}
                    destination={trip.destination || undefined}
                    departDate={trip.depart_date || undefined}
                    returnDate={trip.return_date || undefined}
                    tripStatus={trip.status}
                    onDataChange={fetchTrip}
                    onStatusChange={handleWorkflowStatusChange}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Right sidebar */}
          {showRightSidebar && (
            <div className="space-y-4 lg:col-span-2 2xl:col-span-1">
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1 2xl:sticky 2xl:top-6 2xl:max-h-[calc(100vh-3rem)] 2xl:overflow-y-auto 2xl:overscroll-contain 2xl:pr-2">
                <TripReadinessScore
                  tripId={trip.id}
                  departDate={trip.depart_date}
                  returnDate={trip.return_date}
                  hasSupplierBooking={bookings.some((b: any) => b.supplier_id)}
                  totalCommissionRevenue={trip.total_commission_revenue}
                />
                {!(trip.trip_type === "group" && !trip.parent_trip_id) && (
                  <TripTravelersCard
                    client={trip.clients}
                    clientId={trip.client_id}
                    tripId={trip.id}
                  />
                )}
                <TripSettingsSidebar
                  tripId={trip.id}
                  settings={tripSettings}
                  agencyName={profile?.agency_name || undefined}
                  tripTotal={trip.total_gross_sales}
                  departDate={trip.depart_date || undefined}
                  tripType={trip.trip_type || undefined}
                  shareToken={(trip as any).share_token || undefined}
                  onSettingsChange={fetchTrip}
                  onNavigateToLandingPage={() => navigate(`/trips/${tripId}/landing-page`)}
                />
                <TripCloseoutChecklist
                  bookings={bookings}
                  payments={payments}
                  tripTotal={trip.total_gross_sales}
                  tripStatus={trip.status}
                />
                <AgentTripDocuments tripId={trip.id} />
              </div>
            </div>
          )}
        </div>
      </div>

      <EditTripDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        trip={trip}
        onUpdated={fetchTrip}
      />

      <AlertDialog open={!!deleteItineraryConfirmId} onOpenChange={(open) => !open && setDeleteItineraryConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Itinerary?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this itinerary and all its items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItinerary} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateItinerarySheet
        open={createSheetOpen}
        onOpenChange={(open) => {
          setCreateSheetOpen(open);
          if (!open) setEditingItinerary(null);
        }}
        tripDepartDate={trip.depart_date}
        tripReturnDate={trip.return_date}
        onCreate={createItinerary}
        editingItinerary={editingItinerary}
        onUpdate={updateItinerary}
      />
    </DashboardLayout>
  );
};

export default TripDetail;
