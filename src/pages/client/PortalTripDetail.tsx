import { ItineraryGallery, getItemImages } from "@/components/shared/ItineraryGallery";
import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { usePortalTripDetail, useApproveItinerary, usePortalCCAuthorizations, usePortalOptionSelections, useSelectOption, usePortalLineSelections } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Calendar, Plane, CreditCard, ClipboardList, Clock, MapPinned, ChevronDown, ChevronUp, CheckCircle2, ThumbsUp, ExternalLink, Loader2, DollarSign, XCircle, MessageSquare, Lock, Wallet, Layers, Send, Hash, BedDouble, Users } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import { RequestChangesDialog } from "@/components/client/RequestChangesDialog";
import { PaymentMilestoneTracker } from "@/components/client/PaymentMilestoneTracker";
import { PaymentAgreementStep } from "@/components/client/PaymentAgreementStep";
import { DepartureCountdown } from "@/components/client/DepartureCountdown";
import { TravelDocChecklist } from "@/components/client/TravelDocChecklist";
import { AgentTripDocumentsView } from "@/components/client/AgentTripDocumentsView";
import { ItineraryLocationTimeline } from "@/components/client/ItineraryLocationTimeline";
import { buildAffirmVcnCheckoutData } from "@/lib/affirmCheckout";
import { ApprovalStatePanel } from "@/components/client/ApprovalStatePanel";
import { BookingOptionsCard } from "@/components/client/BookingOptionsCard";

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

export default function PortalTripDetail() {
  const { tripId } = useParams();
  const { data, isLoading, refetch } = usePortalTripDetail(tripId);
  const { data: ccData } = usePortalCCAuthorizations(tripId);
  const { data: selectionsData } = usePortalOptionSelections(tripId);
  const { data: lineSelectionsData } = usePortalLineSelections(tripId);
  const approveItinerary = useApproveItinerary();
  const selectOption = useSelectOption();
  const [showItinerary, setShowItinerary] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "itinerary" | "pricing">("overview");
  const [confirmApproval, setConfirmApproval] = useState<{ id: string; name: string } | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [changeRequest, setChangeRequest] = useState<{ id: string; name: string } | null>(null);
  const [selectedOptionChoices, setSelectedOptionChoices] = useState<Record<string, string>>({});

  // Payment agreement flow state
  const [showAgreement, setShowAgreement] = useState(false);
  const [showMethodDialog, setShowMethodDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [affirmLoading, setAffirmLoading] = useState(false);

  const handlePayNowClick = (payment: any) => {
    setSelectedPayment(payment);
    setShowAgreement(true);
  };

  const notifyAgentPaymentMethod = useCallback(async (method: string) => {
    try {
      const portalSession = localStorage.getItem("portal_session");
      const portalToken = portalSession ? JSON.parse(portalSession).token : null;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?resource=notify-payment-method`, {
        method: "POST",
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-portal-token": portalToken || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripId,
          paymentId: selectedPayment?.id,
          method,
        }),
      });
    } catch (err) {
      console.error("Failed to notify agent of payment method:", err);
    }
  }, [tripId, selectedPayment]);

  const handleAgreementAccepted = () => {
    setShowAgreement(false);
    setTimeout(() => setShowMethodDialog(true), 150);
  };

  const handleStripePayment = async () => {
    if (!selectedPayment) return;
    setPayingId(selectedPayment.id);
      setShowMethodDialog(false);
      notifyAgentPaymentMethod("stripe");
      try {
        const portalSession = localStorage.getItem("portal_session");
        const portalToken = portalSession ? JSON.parse(portalSession).token : null;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stripe-payment`, {
          method: "POST",
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "x-portal-token": portalToken || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentId: selectedPayment.id, returnUrl: window.location.origin + `/client/trips/${tripId}`, paymentMethodChoice: "stripe" }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed");
        if (result.url) window.location.href = result.url;
      } catch (error) {
        console.error("Payment error:", error);
        toast.error("Failed to start payment");
      } finally {
        setPayingId(null);
      }
  };

  const handleAffirmPayment = async () => {
    if (!selectedPayment) return;
    if (typeof (window as any).affirm === "undefined") {
      toast.error("Affirm is not available. Please try card payment or contact your agent.");
      return;
    }

    const checkoutResult = buildAffirmVcnCheckoutData({
      amount: Number(selectedPayment.amount),
      orderId: selectedPayment.id,
      tripName: selectedPayment.trip_name,
      client: data?.client,
      itemUrl: window.location.href,
    });

    if ("error" in checkoutResult) {
      toast.error(checkoutResult.error);
      return;
    }

    setAffirmLoading(true);
    setShowMethodDialog(false);
    notifyAgentPaymentMethod("affirm");
    const affirm = (window as any).affirm;
    const checkoutData = checkoutResult.checkoutData;
    affirm.ui.ready(function () {
      affirm.checkout(checkoutData);
      affirm.checkout.open_vcn({
        success: async function (card_response: any) {
          setAffirmLoading(false);
          toast.success("Affirm approved! Your agent has been notified.");
          try {
            const portalSession = localStorage.getItem("portal_session");
            const portalToken = portalSession ? JSON.parse(portalSession).token : null;
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-virtual-card`, {
              method: "POST",
              headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "x-portal-token": portalToken || "", "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId: selectedPayment.id, method: "affirm", affirmCheckoutId: card_response.checkout_id || null }),
            });
            // Return to the client portal trip page
            window.location.href = `/client/trips/${tripId}`;
          } catch (err) { console.error("Error notifying agent:", err); }
        },
        error: function () {
          setAffirmLoading(false);
          toast.error("Affirm checkout was cancelled or declined.");
        },
        checkout_data: checkoutData,
      });
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!data?.trip) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Trip not found.</p>
        <Link to="/client/trips">
          <Button variant="outline" className="mt-4">Back to Trips</Button>
        </Link>
      </div>
    );
  }

  const { trip, bookings = [], payments = [], itinerary = [], itineraries = [], optionBlocks = [], pricingLines = [], selectedCabin = null } = data;
  const approvedId = trip.approved_itinerary_id;

  const depositPaid = payments.some((p: any) =>
    (p.payment_type === "deposit" || p.payment_type === "payment") && p.status === "paid"
  );
  const depositRequired = trip.deposit_required && !depositPaid;
  // Compute total based on the client's current selections.
  // Required lines always count. Optional lines count only if selected
  // (or when their booking has no saved selections yet — default-on).
  const selectionsArr: any[] = lineSelectionsData?.selections || [];
  const selectedMap = new Map<string, boolean>(
    selectionsArr.map((s: any) => [s.margin_line_id, !!s.selected])
  );
  const bookingHasAnySelection = new Set<string>(
    selectionsArr.map((s: any) => s.booking_id)
  );
  const selectedTotal = (pricingLines || []).reduce((sum: number, l: any) => {
    const lineTotal = Number(l.total_price || 0);
    if (!l.is_optional) return sum + lineTotal;
    const explicit = selectedMap.get(l.id);
    const include = explicit !== undefined
      ? explicit
      : !bookingHasAnySelection.has(l.booking_id); // default-on if booking has no saved selections
    return sum + (include ? lineTotal : 0);
  }, 0);
  const fallbackTotal = trip.total_gross_sales || 0;
  const totalCost = selectedTotal > 0 ? selectedTotal : fallbackTotal;

  // Get cancellation terms from bookings for the agreement step
  const cancellationTerms = bookings
    .map((b: any) => b.cancellation_terms)
    .filter(Boolean)
    .join(" | ");

  const handleChangeRequest = async (message: string) => {
    const portalSession = localStorage.getItem("portal_session");
    const portalToken = portalSession ? JSON.parse(portalSession).token : null;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?resource=send_message`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-portal-token": portalToken || "", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("Failed to send");
  };

  const handleApprove = async () => {
    if (!confirmApproval || !tripId) return;
    try {
      await approveItinerary.mutateAsync({ tripId, itineraryId: confirmApproval.id });
      toast.success(`You've approved "${confirmApproval.name}" as your preferred itinerary!`);
    } catch {
      toast.error("Failed to approve itinerary");
    } finally {
      setConfirmApproval(null);
    }
  };

  const itemsByItinerary = itinerary.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.itinerary_id || "default";
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  // Shared pricing-breakdown renderer used on both Overview and Pricing tabs.
  // Mirrors the shared-trip pricing layout: per-booking groups, extended
  // line totals (unit × qty × travelers), add-on separation, deposit sum.
  const renderPricingBreakdown = () => {
    if (pricingLines.length === 0 && totalCost <= 0) {
      return <p className="text-sm text-muted-foreground text-center py-4">Pricing details are not yet available.</p>;
    }
    if (pricingLines.length === 0) {
      return (
        <div className="flex justify-between py-2">
          <span className="text-sm">Trip Total</span>
          <span className="text-sm font-bold">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      );
    }
    const grouped = pricingLines.reduce((acc: Record<string, any[]>, line: any) => {
      (acc[line.booking_id] = acc[line.booking_id] || []).push(line);
      return acc;
    }, {});
    const depositTotal = pricingLines.reduce((s: number, l: any) => s + Number(l.deposit_amount || 0), 0);
    return (
      <div className="space-y-5">
        {Object.entries(grouped).map(([bId, lines]: [string, any[]]) => {
          const booking = bookings.find((b: any) => b.id === bId);
          const isSelectable = (l: any) => l.is_addon || l.is_optional;
          const coreLines = lines.filter((l: any) => !isSelectable(l));
          const addonLines = lines.filter(isSelectable);
          const subtotal = lines.reduce(
            (s: number, l: any) => s + Number(l.unit_price || 0) * Number(l.quantity || 1) * Number(l.travelers || 1),
            0
          );
          return (
            <div key={bId} className="space-y-2">
              {Object.keys(grouped).length > 1 && (
                <h3 className="text-sm font-semibold">{booking?.trip_name || booking?.destination || "Booking"}</h3>
              )}
              <div className="divide-y">
                {coreLines.map((l: any) => {
                  const qty = Number(l.quantity || 1);
                  const trav = Number(l.travelers || 1);
                  const ext = Number(l.unit_price || 0) * qty * trav;
                  return (
                    <div key={l.id} className="flex justify-between py-2">
                      <div>
                        <p className="text-sm">{l.description}</p>
                        {(qty > 1 || trav > 1) && (
                          <p className="text-xs text-muted-foreground">
                            ${Number(l.unit_price || 0).toFixed(2)} × {qty} × {trav} {trav > 1 ? "persons" : "person"}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">
                        ${ext.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
              {addonLines.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground pt-2">Optional / Add-Ons</p>
                  <div className="divide-y">
                    {addonLines.map((l: any) => {
                      const qty = Number(l.quantity || 1);
                      const trav = Number(l.travelers || 1);
                      const ext = Number(l.unit_price || 0) * qty * trav;
                      return (
                        <div key={l.id} className="flex justify-between py-2">
                          <div>
                            <p className="text-sm">{l.description}</p>
                            {(qty > 1 || trav > 1) && (
                              <p className="text-xs text-muted-foreground">
                                ${Number(l.unit_price || 0).toFixed(2)} × {qty} × {trav} {trav > 1 ? "persons" : "person"}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-medium whitespace-nowrap">
                            +${ext.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {Object.keys(grouped).length > 1 && (
                <div className="flex justify-between pt-2 border-t text-sm font-semibold">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex justify-between pt-4 border-t font-bold">
          <span>Total</span>
          <div className="text-right">
            <div>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            {depositTotal > 0 && (
              <div className="text-xs font-normal text-muted-foreground">
                Deposit: ${depositTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Group option blocks by day
  const optionBlocksByDay = optionBlocks.reduce((acc: Record<number, any[]>, block: any) => {
    (acc[block.day_number] = acc[block.day_number] || []).push(block);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Hero Cover Image */}
      {trip.cover_image_url && (
        <div className="relative -mx-4 -mt-6 mb-2 h-[30vh] min-h-[200px] overflow-hidden">
          <img
            src={trip.cover_image_url}
            alt={trip.trip_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">{trip.trip_name}</h1>
              <div className="flex items-center gap-3 text-white/90 text-sm mt-2">
                {trip.destination && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {trip.destination}</span>
                )}
                {trip.depart_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(parseLocalDate(trip.depart_date), "MMM d")}
                    {trip.return_date && ` – ${format(parseLocalDate(trip.return_date), "MMM d, yyyy")}`}
                  </span>
                )}
                {totalCost > 0 && (
                  <span className="flex items-center gap-1 font-semibold">
                    <DollarSign className="h-3.5 w-3.5" />
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalCost)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="absolute top-4 left-4">
            <Link to="/client/trips">
              <Button variant="secondary" size="icon" className="shadow-md"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {trip.published_at && trip.share_token && (
              <Button variant="secondary" size="sm" className="shadow-md" asChild>
                <Link to={`/shared/${trip.share_token}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View Itinerary
                </Link>
              </Button>
            )}
            <Badge variant={trip.status === "confirmed" ? "default" : "secondary"} className="shadow-md">
              {trip.status}
            </Badge>
          </div>
        </div>
      )}

      {/* Standard header when no cover image */}
      {!trip.cover_image_url && (
        <div className="flex items-center gap-3">
          <Link to="/client/trips">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{trip.trip_name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              {trip.destination && (
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {trip.destination}</span>
              )}
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
          <div className="ml-auto flex items-center gap-2">
            {trip.published_at && trip.share_token && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/shared/${trip.share_token}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View Itinerary
                </Link>
              </Button>
            )}
            <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>
              {trip.status}
            </Badge>
          </div>
        </div>
      )}

      {/* Departure Countdown */}
      <DepartureCountdown departDate={trip.depart_date} returnDate={trip.return_date} />

      {/* Tab Navigation */}
      <div className="flex gap-6 border-b border-border">
        {([
          { key: "overview" as const, label: "Overview" },
          { key: "itinerary" as const, label: "Full Itinerary" },
          { key: "pricing" as const, label: "Pricing" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab Content */}
      {activeTab === "overview" && (<>

      {/* Payment Milestone Tracker */}
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

      {/* Selected Cabin / Stateroom */}
      {selectedCabin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BedDouble className="h-4 w-4" /> Your Stateroom
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {selectedCabin.image_url && (
                <img
                  src={selectedCabin.image_url}
                  alt={selectedCabin.category_name}
                  className="w-full sm:w-48 h-32 object-cover rounded-md border border-border"
                />
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedCabin.category_name}</h3>
                    {selectedCabin.description && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedCabin.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">Selected</Badge>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground pt-1">
                  {selectedCabin.price_per_person != null && (
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      ${Number(selectedCabin.price_per_person).toLocaleString()} per guest{(selectedCabin as any).price_period === 'night' ? ' / night' : ''}
                    </span>
                  )}
                  {selectedCabin.capacity != null && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Sleeps {selectedCabin.capacity}
                    </span>
                  )}
                  {selectedCabin.deposit_amount != null && Number(selectedCabin.deposit_amount) > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      ${Number(selectedCabin.deposit_amount).toLocaleString()} deposit
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location Timeline */}
      {itinerary.length > 0 && (
        <ItineraryLocationTimeline items={itinerary} />
      )}

      {/* Option Blocks */}
      {optionBlocks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Your Choices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(optionBlocksByDay).map(([day, blocks]: [string, any[]]) => (
              <div key={day} className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" /> Day {day}
                </h4>
                {blocks.map((block: any) => {
                  const blockItems = itinerary.filter((item: any) => item.option_block_id === block.id);
                  if (blockItems.length === 0) return null;

                  // Check saved server selection
                  const savedSelection = (selectionsData?.selections || []).find(
                    (s: any) => s.option_block_id === block.id
                  );
                  const localChoice = selectedOptionChoices[block.id];
                  const activeSelection = localChoice || savedSelection?.selected_item_id;
                  const isConfirmed = savedSelection?.agent_confirmed;
                  const isSaved = savedSelection?.selected_item_id === activeSelection && !localChoice;
                  const hasUnsavedChange = localChoice && localChoice !== savedSelection?.selected_item_id;

                  return (
                    <div key={block.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{block.title}</p>
                        <div className="flex items-center gap-2">
                          {isConfirmed && (
                            <Badge variant="default" className="gap-1 text-[10px]">
                              <CheckCircle2 className="h-3 w-3" /> Confirmed
                            </Badge>
                          )}
                          {isSaved && !isConfirmed && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Clock className="h-3 w-3" /> Awaiting Confirmation
                            </Badge>
                          )}
                          {hasUnsavedChange && (
                            <Button
                              size="sm"
                              className="gap-1.5 h-7 text-xs"
                              disabled={selectOption.isPending}
                              onClick={() => {
                                if (!tripId) return;
                                selectOption.mutate(
                                  { tripId, optionBlockId: block.id, selectedItemId: localChoice },
                                  {
                                    onSuccess: () => {
                                      toast.success("Selection sent to your advisor for confirmation!");
                                      setSelectedOptionChoices(prev => {
                                        const next = { ...prev };
                                        delete next[block.id];
                                        return next;
                                      });
                                    },
                                    onError: () => toast.error("Failed to save selection"),
                                  }
                                );
                              }}
                            >
                              {selectOption.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              Submit Choice
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {blockItems.map((item: any, idx: number) => {
                          const isSelected = activeSelection === item.id;
                          const optionLabel = String.fromCharCode(65 + idx);
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                if (isConfirmed) return; // Don't allow changes after confirmation
                                setSelectedOptionChoices(prev => ({ ...prev, [block.id]: item.id }));
                              }}
                              disabled={isConfirmed}
                              className={`text-left p-4 rounded-lg border-2 transition-all ${
                                isConfirmed
                                  ? isSelected
                                    ? "border-primary bg-primary/5 cursor-default"
                                    : "border-border opacity-50 cursor-default"
                                  : isSelected
                                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  {isSelected ? <CheckCircle2 className="h-4 w-4" /> : optionLabel}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{categoryIcons[item.category] || "📌"}</span>
                                    <p className="font-medium text-sm">{item.title}</p>
                                  </div>
                                  {item.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                  )}
                                  {item.location && (
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                      <MapPinned className="h-3 w-3" /> {item.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Itinerary Options */}
      {itineraries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Itinerary Options ({itineraries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvedId && (
              <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">
                  You've approved: {itineraries.find((i: any) => i.id === approvedId)?.name || "an itinerary"}
                </span>
              </div>
            )}

            {itineraries.map((itin: any) => {
              const isApproved = approvedId === itin.id;
              const items = itemsByItinerary[itin.id] || [];

              return (
                <div
                  key={itin.id}
                  className={`rounded-lg border overflow-hidden transition-all ${
                    isApproved ? "border-primary ring-1 ring-primary/30" : ""
                  }`}
                >
                  {itin.cover_image_url && (
                    <img src={itin.cover_image_url} alt={itin.name} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {itin.name}
                          {isApproved && (
                            <Badge variant="default" className="text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Approved
                            </Badge>
                          )}
                        </h3>
                        {itin.overview && (
                          <p className="text-sm text-muted-foreground mt-1">{itin.overview}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {!isApproved && (
                          <Button
                            size="sm"
                            variant={approvedId ? "outline" : "default"}
                            className="gap-1.5"
                            onClick={() => setConfirmApproval({ id: itin.id, name: itin.name })}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {approvedId ? "Switch" : "Approve"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setChangeRequest({ id: itin.id, name: itin.name })}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Request Changes
                        </Button>
                      </div>
                    </div>
                    {items.length > 0 && <ItineraryItemsList items={items} />}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Legacy itinerary */}
      {(itemsByItinerary["default"]?.length > 0 && itineraries.length === 0) && (
        <Card>
          <CardHeader className="cursor-pointer select-none" onClick={() => setShowItinerary(!showItinerary)}>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> View Full Itinerary ({itinerary.length} items)
              {showItinerary ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </CardTitle>
          </CardHeader>
          {showItinerary && (
            <CardContent><ItineraryItemsList items={itinerary} /></CardContent>
          )}
        </Card>
      )}

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
              {depositRequired && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <Lock className="h-5 w-5 text-warning shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-warning">Confirmation details unlock after deposit</p>
                    <p className="text-xs text-warning mt-0.5">Choose your options below and pay your deposit to unlock full booking confirmations.</p>
                  </div>
                </div>
              )}
              {bookings.map((b: any) => {
                const typeInfo = bookingTypeIcons[b.booking_type] || bookingTypeIcons.other;
                const bookingLines = (pricingLines || []).filter((l: any) => l.booking_id === b.id);
                const bookingSelections = (lineSelectionsData?.selections || []).filter(
                  (s: any) => s.booking_id === b.id
                );
                const pendingDepositPayment = payments.find(
                  (p: any) => p.status === "pending" && (p.payment_type === "deposit" || p.payment_type === "payment")
                );
                return (
                  <BookingOptionsCard
                    key={b.id}
                    tripId={tripId!}
                    tripName={trip.trip_name}
                    booking={b}
                    lines={bookingLines}
                    selections={bookingSelections}
                    typeIcon={typeInfo.icon}
                    typeLabel={typeInfo.label}
                    disablePay={!!payingId || affirmLoading}
                    pendingDepositPayment={pendingDepositPayment}
                    onPayDeposit={(payload) => handlePayNowClick(payload)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CC Authorizations */}
      {(pricingLines.length > 0 || totalCost > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Pricing Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderPricingBreakdown()}
          </CardContent>
        </Card>
      )}

      {(ccData?.authorizations?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Payment Authorizations ({ccData.authorizations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ccData.authorizations.map((auth: any) => (
                <div key={auth.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">${Number(auth.authorization_amount).toLocaleString()}</p>
                    {auth.authorization_description && <p className="text-sm text-muted-foreground">{auth.authorization_description}</p>}
                    {auth.booking && <p className="text-xs text-muted-foreground mt-0.5">{auth.booking.trip_name || auth.booking.destination}</p>}
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={auth.status === "authorized" ? "default" : auth.status === "pending" ? "secondary" : "outline"}>
                      {auth.status === "authorized" ? "✓ Authorized" : auth.status === "pending" ? "Awaiting" : auth.status}
                    </Badge>
                    {auth.status === "pending" && (
                      <div>
                        <a href={`/authorize/${auth.access_token}`} className="text-xs text-primary hover:underline font-medium">
                          Complete Authorization →
                        </a>
                      </div>
                    )}
                    {auth.status === "authorized" && auth.last_four && (
                      <p className="text-xs text-muted-foreground">•••• {auth.last_four}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              {/* Balance Summary */}
              {(() => {
                const totalPaid = payments
                  .filter((p: any) => p.status === "paid")
                  .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
                const balanceDue = Math.max((totalCost || 0) - totalPaid, 0);
                const fmt = (n: number) =>
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
                if (totalCost <= 0) return null;
                return (
                  <div className="grid grid-cols-3 gap-3 p-4 rounded-lg border bg-muted/30">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Trip Total</p>
                      <p className="text-lg font-bold mt-1">{fmt(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Payments Applied</p>
                      <p className="text-lg font-bold mt-1 text-success">{fmt(totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance Due</p>
                      <p className={`text-lg font-bold mt-1 ${balanceDue > 0 ? "text-warning" : "text-success"}`}>
                        {fmt(balanceDue)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Pay Full Amount option when there are multiple pending payments */}
              {(() => {
                const pendingPayments = payments.filter((p: any) => p.status === "pending");
                const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
                if (pendingPayments.length > 1) {
                  return (
                    <div className="flex items-center justify-between p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          <Wallet className="h-4 w-4" /> Pay Full Amount
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pay all remaining balance at once instead of installments
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold">${totalPending.toLocaleString()}</p>
                        <Button
                          size="sm"
                          onClick={() => {
                            // Create a virtual "full payment" object
                            const fullPayment = {
                              id: pendingPayments[0].id,
                              amount: totalPending,
                              payment_type: "full_payment",
                              status: "pending",
                              trip_name: trip.trip_name,
                            };
                            handlePayNowClick(fullPayment);
                          }}
                          disabled={!!payingId || affirmLoading}
                        >
                          <CreditCard className="h-4 w-4 mr-1" /> Pay Now
                        </Button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {payments.map((p: any) => {
                const isPending = p.status === "pending";
                const isPaid = p.status === "paid";
                const statusIcon = isPaid ? CheckCircle2 : isPending ? Clock : p.status === "refunded" ? DollarSign : p.status === "cancelled" ? XCircle : CreditCard;
                const StatusIcon = statusIcon;
                const statusClass = isPaid
                  ? "bg-success/10 text-success border-success/30"
                  : isPending
                  ? "bg-warning/10 text-warning border-warning/30"
                  : p.status === "authorized"
                  ? "bg-info/10 text-info border-info/30"
                  : p.status === "refunded"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-destructive/10 text-destructive border-destructive/30";

                const typeLabel = p.payment_type === "final_balance" ? "Final Balance" :
                  p.payment_type === "full_payment" ? "Full Payment" :
                  p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1);

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${isPending ? "border-warning/30 bg-warning/10/50" : ""}`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">{typeLabel}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : format(new Date(p.payment_date), "MMM d, yyyy")}
                      </p>
                      {p.details && <p className="text-xs text-muted-foreground">{p.details}</p>}
                      {isPaid && p.payment_method && (
                        <p className="text-xs text-muted-foreground capitalize">via {p.payment_method.replace(/_/g, " ")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="outline" className={`gap-1 ${statusClass}`}>
                          <StatusIcon className="h-3 w-3" />
                          {p.status === "pending" ? "Unpaid" : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </Badge>
                        <p className="text-sm font-semibold mt-1">${Number(p.amount).toLocaleString()}</p>
                      </div>
                      {isPending && (
                        <Button size="sm" onClick={() => handlePayNowClick(p)} disabled={payingId === p.id || affirmLoading}>
                          {payingId === p.id || affirmLoading ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-1" />
                          )}
                          Pay Now
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

      {/* Travel Document Checklist */}
      {tripId && <AgentTripDocumentsView tripId={tripId} />}
      {tripId && <TravelDocChecklist tripId={tripId} />}

      {/* Notes */}
      {trip.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Trip Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trip.notes}</p>
          </CardContent>
        </Card>
      )}

      </>)}

      {/* Itinerary Tab */}
      {activeTab === "itinerary" && (
        <div className="space-y-6">
          <ApprovalStatePanel
            kind="itinerary"
            published={Boolean(trip.published_at)}
            approved={Boolean(approvedId)}
            approvedName={itineraries.find((i: any) => i.id === approvedId)?.name}
            onGoToApproveTab={() => setActiveTab("overview")}
            tripId={tripId}
          />
          {itinerary.length > 0 && <ItineraryLocationTimeline items={itinerary} />}
          {itineraries.length > 0 ? (
            itineraries.map((itin: any) => {
              const items = (itemsByItinerary[itin.id] || []);
              return (
                <Card key={itin.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{itin.name}</CardTitle>
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
      {activeTab === "pricing" && (
        <div className="space-y-6">
          <ApprovalStatePanel
            kind="budget"
            published={Boolean(trip.published_at) && (pricingLines.length > 0 || totalCost > 0)}
            approved={Boolean(approvedId)}
            approvedName={itineraries.find((i: any) => i.id === approvedId)?.name}
            onGoToApproveTab={() => setActiveTab("overview")}
            tripId={tripId}
          />
          <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Pricing Breakdown</CardTitle></CardHeader>
          <CardContent>
            {renderPricingBreakdown()}
          </CardContent>
          </Card>
        </div>
      )}
      <Dialog open={showAgreement} onOpenChange={setShowAgreement}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Agreement</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <PaymentAgreementStep
              tripName={trip.trip_name || "Trip"}
              amount={selectedPayment.amount}
              cancellationTerms={cancellationTerms || undefined}
              onAccept={handleAgreementAccepted}
              onCancel={() => setShowAgreement(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Method Selection Dialog */}
      <Dialog open={showMethodDialog} onOpenChange={setShowMethodDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>
              Select how you'd like to pay{" "}
              {selectedPayment && <strong>${Number(selectedPayment.amount).toLocaleString()}</strong>}
              {" "}for <strong>{trip.trip_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <button
              onClick={handleStripePayment}
              className="w-full flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Pay with Card</p>
                <p className="text-sm text-muted-foreground mt-0.5">Pay instantly using your credit or debit card via secure checkout.</p>
              </div>
            </button>
            <button
              onClick={handleAffirmPayment}
              className="w-full flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-accent/50 hover:bg-accent/5 transition-all text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Pay with Affirm</p>
                <p className="text-sm text-muted-foreground mt-0.5">Finance your trip with flexible monthly payments.</p>
              </div>
            </button>

            {/* CC Authorization — send card info to agent */}
            {tripId && (
              <button
                onClick={async () => {
                  setShowMethodDialog(false);
                  toast.info("Preparing your authorization form...");
                  try {
                    const portalSession = localStorage.getItem("portal_session");
                    const portalToken = portalSession ? JSON.parse(portalSession).token : null;
                    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?resource=notify-payment-method`, {
                      method: "POST",
                      headers: {
                        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                        "x-portal-token": portalToken || "",
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        tripId,
                        paymentId: selectedPayment?.id,
                        method: "cc_to_agent",
                      }),
                    });
                    const result = await res.json();
                    if (result.ccAccessToken) {
                      window.location.href = `/authorize/${result.ccAccessToken}`;
                    } else {
                      // Fallback: check existing pending auths
                      const pendingAuth = ccData?.authorizations?.find((a: any) => a.status === "pending");
                      if (pendingAuth) {
                        window.location.href = `/authorize/${pendingAuth.access_token}`;
                      } else {
                        toast.info("Your advisor will send you a secure card authorization form shortly.");
                      }
                    }
                  } catch (err) {
                    console.error("Error:", err);
                    toast.error("Something went wrong. Please try again.");
                  }
                }}
                className="w-full flex items-start gap-4 p-4 rounded-lg border-2 border-border hover:border-muted-foreground/30 hover:bg-muted/30 transition-all text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Send Card Info to Agent</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Securely authorize your credit card and let your advisor process the payment.</p>
                </div>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval confirmation */}
      <AlertDialog open={!!confirmApproval} onOpenChange={(open) => !open && setConfirmApproval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Itinerary?</AlertDialogTitle>
            <AlertDialogDescription>
              You're selecting <strong>"{confirmApproval?.name}"</strong> as your preferred itinerary. Your travel advisor will be notified of your choice.
              {approvedId && " This will replace your previous selection."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveItinerary.isPending}>
              {approveItinerary.isPending ? "Approving..." : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RequestChangesDialog
        open={!!changeRequest}
        onOpenChange={(open) => !open && setChangeRequest(null)}
        itineraryName={changeRequest?.name || ""}
        onSubmit={handleChangeRequest}
      />
    </div>
  );
}

function ItineraryItemsList({ items }: { items: any[] }) {
  // Filter out items that belong to option blocks (they're rendered separately)
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
                — {format(new Date(dayItems[0].item_date), "EEEE, MMM d, yyyy")}
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
