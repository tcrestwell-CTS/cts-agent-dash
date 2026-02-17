import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { usePortalTripDetail, useApproveItinerary, usePortalCCAuthorizations } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, MapPin, Calendar, Plane, CreditCard, ClipboardList, Clock, MapPinned, ChevronDown, ChevronUp, CheckCircle2, ThumbsUp, ExternalLink, Loader2, DollarSign, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const categoryIcons: Record<string, string> = {
  flight: "✈️", lodging: "🏨", cruise: "🚢", transportation: "🚗",
  activity: "🎯", dining: "🍽️", meeting: "📋", other: "📌",
};

export default function PortalTripDetail() {
  const { tripId } = useParams();
  const { data, isLoading } = usePortalTripDetail(tripId);
  const { data: ccData } = usePortalCCAuthorizations(tripId);
  const approveItinerary = useApproveItinerary();
  const [showItinerary, setShowItinerary] = useState(false);
  const [confirmApproval, setConfirmApproval] = useState<{ id: string; name: string } | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const handlePayNow = useCallback(async (paymentId: string) => {
    setPayingId(paymentId);
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
        body: JSON.stringify({ paymentId, returnUrl: window.location.origin }),
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
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
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

  const { trip, bookings = [], payments = [], itinerary = [], itineraries = [] } = data;
  const approvedId = trip.approved_itinerary_id;

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

  // Group itinerary items by itinerary_id
  const itemsByItinerary = itinerary.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.itinerary_id || "default";
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
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
                {format(new Date(trip.depart_date), "MMM d")}
                {trip.return_date && ` – ${format(new Date(trip.return_date), "MMM d, yyyy")}`}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {trip.published_at && trip.share_token && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/shared/${trip.share_token}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View Itinerary
              </Link>
            </Button>
          )}
          <Badge variant={trip.status === "confirmed" ? "default" : "secondary"}>
            {trip.status}
          </Badge>
        </div>
      </div>

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
                  {/* Cover image */}
                  {itin.cover_image_url && (
                    <img
                      src={itin.cover_image_url}
                      alt={itin.name}
                      className="w-full h-36 object-cover"
                    />
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
                      {!isApproved && (
                        <Button
                          size="sm"
                          variant={approvedId ? "outline" : "default"}
                          className="shrink-0 gap-1.5"
                          onClick={() => setConfirmApproval({ id: itin.id, name: itin.name })}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          {approvedId ? "Switch" : "Approve"}
                        </Button>
                      )}
                    </div>

                    {/* Itinerary items */}
                    {items.length > 0 && (
                      <ItineraryItemsList items={items} />
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Legacy itinerary (items without itinerary_id) */}
      {(itemsByItinerary["default"]?.length > 0 && itineraries.length === 0) && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setShowItinerary(!showItinerary)}
          >
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> View Full Itinerary ({itinerary.length} items)
              {showItinerary ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </CardTitle>
          </CardHeader>
          {showItinerary && (
            <CardContent>
              <ItineraryItemsList items={itinerary} />
            </CardContent>
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
              {bookings.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{b.trip_name || b.booking_reference}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.destination}
                      {b.depart_date && ` · ${format(new Date(b.depart_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={b.status === "confirmed" ? "default" : "secondary"} className="mb-1">
                      {b.status}
                    </Badge>
                    {b.total_amount > 0 && (
                      <p className="text-sm font-medium">${b.total_amount.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CC Authorizations */}
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
                    {auth.authorization_description && (
                      <p className="text-sm text-muted-foreground">{auth.authorization_description}</p>
                    )}
                    {auth.booking && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {auth.booking.trip_name || auth.booking.destination}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant={auth.status === "authorized" ? "default" : auth.status === "pending" ? "secondary" : "outline"}>
                      {auth.status === "authorized" ? "✓ Authorized" : auth.status === "pending" ? "Awaiting" : auth.status}
                    </Badge>
                    {auth.status === "pending" && (
                      <div>
                        <a
                          href={`/authorize/${auth.access_token}`}
                          className="text-xs text-primary hover:underline font-medium"
                        >
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
              {payments.map((p: any) => {
                const isPending = p.status === "pending";
                const isPaid = p.status === "paid";
                const statusIcon = isPaid ? CheckCircle2 : isPending ? Clock : p.status === "refunded" ? DollarSign : p.status === "cancelled" ? XCircle : CreditCard;
                const StatusIcon = statusIcon;
                const statusClass = isPaid
                  ? "bg-green-100 text-green-700 border-green-200"
                  : isPending
                  ? "bg-amber-100 text-amber-700 border-amber-200"
                  : p.status === "authorized"
                  ? "bg-blue-100 text-blue-700 border-blue-200"
                  : p.status === "refunded"
                  ? "bg-purple-100 text-purple-700 border-purple-200"
                  : "bg-red-100 text-red-700 border-red-200";

                const typeLabel = p.payment_type === "final_balance" ? "Final Balance" :
                  p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1);

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${isPending ? "border-amber-200 bg-amber-50/50" : ""}`}
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">{typeLabel}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : format(new Date(p.payment_date), "MMM d, yyyy")}
                      </p>
                      {p.details && <p className="text-xs text-muted-foreground">{p.details}</p>}
                      {isPaid && p.payment_method && (
                        <p className="text-xs text-muted-foreground capitalize">
                          via {p.payment_method.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="outline" className={`gap-1 ${statusClass}`}>
                          <StatusIcon className="h-3 w-3" />
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </Badge>
                        <p className="text-sm font-semibold mt-1">${Number(p.amount).toLocaleString()}</p>
                      </div>
                      {isPending && (
                        <Button
                          size="sm"
                          onClick={() => handlePayNow(p.id)}
                          disabled={payingId === p.id}
                        >
                          {payingId === p.id ? (
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

      {/* Notes */}
      {trip.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trip Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trip.notes}</p>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}

function ItineraryItemsList({ items }: { items: any[] }) {
  const grouped = items.reduce((acc: Record<number, any[]>, item: any) => {
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
                  <span className="text-lg">{categoryIcons[item.category] || "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
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
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
