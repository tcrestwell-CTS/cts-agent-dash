import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  BedDouble,
  Anchor,
  ArrowLeft,
  CreditCard,
  Mail,
  Phone,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ReservationData {
  parentTrip: {
    id: string;
    trip_name: string;
    destination: string | null;
    depart_date: string | null;
    return_date: string | null;
    share_token: string;
  };
  subTrip: {
    id: string;
    trip_name: string;
    destination: string | null;
    depart_date: string | null;
    return_date: string | null;
    status: string;
    notes: string | null;
    selected_cabin_option_id: string | null;
    cover_image_url: string | null;
  };
  client: {
    name: string;
    email: string;
    phone: string | null;
  };
  cabin: {
    category_name: string;
    price_per_person: number;
    deposit_amount: number;
    description: string | null;
  } | null;
  booking: {
    id: string;
    confirmation_number: string;
    gross_sales: number;
    status: string;
  } | null;
  depositPayment: {
    id: string;
    amount: number;
    status: string;
    due_date: string | null;
  } | null;
  payUrl: string | null;
  branding: {
    agency_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    phone: string | null;
    email_address: string | null;
    website: string | null;
  } | null;
  advisor: {
    full_name: string | null;
    agency_name: string | null;
    job_title: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export default function GroupReservation() {
  const { token, subTripId } = useParams<{ token: string; subTripId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReservationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token || !subTripId) {
        setError("Invalid reservation link.");
        setLoading(false);
        return;
      }
      try {
        const { data: parentTrip, error: tripErr } = await supabase
          .from("trips")
          .select("id, trip_name, destination, depart_date, return_date, share_token")
          .eq("share_token", token)
          .eq("trip_type", "group")
          .single();

        if (tripErr || !parentTrip) {
          setError("This group trip could not be found.");
          setLoading(false);
          return;
        }

        const { data: subTrip, error: subErr } = await supabase
          .from("trips")
          .select("id, trip_name, destination, depart_date, return_date, status, notes, selected_cabin_option_id, cover_image_url, client_id, user_id")
          .eq("id", subTripId)
          .eq("parent_trip_id", parentTrip.id)
          .single();

        if (subErr || !subTrip) {
          setError("Your reservation could not be found for this group trip.");
          setLoading(false);
          return;
        }

        const [{ data: client }, { data: cabin }, { data: booking }, { data: depositPayment }, { data: branding }, { data: advisor }] = await Promise.all([
          supabase.from("clients").select("name, email, phone").eq("id", subTrip.client_id).single(),
          subTrip.selected_cabin_option_id
            ? supabase.from("trip_cabin_options").select("category_name, price_per_person, deposit_amount, description").eq("id", subTrip.selected_cabin_option_id).single()
            : Promise.resolve({ data: null }),
          supabase.from("bookings").select("id, confirmation_number, gross_sales, status").eq("trip_id", subTrip.id).maybeSingle(),
          supabase.from("trip_payments")
            .select("id, amount, status, due_date")
            .eq("trip_id", subTrip.id)
            .eq("payment_type", "deposit")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("branding_settings").select("agency_name, logo_url, primary_color, accent_color, phone, email_address, website").eq("user_id", subTrip.user_id).maybeSingle(),
          supabase.from("profiles").select("full_name, agency_name, job_title, phone, avatar_url").eq("user_id", subTrip.user_id).maybeSingle(),
        ]);

        // Build a fresh secure pay link from the latest deposit payment if one exists.
        let payUrl: string | null = null;
        if (depositPayment && depositPayment.status !== "paid") {
          const ref = `TP-${depositPayment.id.slice(0, 8).toUpperCase()}`;
          const payload = encodeURIComponent(btoa(JSON.stringify({
            token: "", // SecurePay may mint its own; the token is not stored here.
            ref,
            name: client?.name || "",
            email: client?.email || "",
          })));
          payUrl = `${window.location.origin}/pay?d=${payload}`;
        }

        setData({
          parentTrip,
          subTrip,
          client: client || { name: "Traveler", email: "", phone: null },
          cabin: cabin as any,
          booking: booking as any,
          depositPayment: depositPayment as any,
          payUrl,
          branding,
          advisor,
        });
      } catch (e) {
        console.error("Group reservation load error:", e);
        setError("Something went wrong while loading your reservation.");
        toast.error("Failed to load reservation");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, subTripId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Reservation Not Found</h1>
            <p className="text-gray-500 mb-6">{error || "We couldn't locate your reservation."}</p>
            {token && (
              <Link to={`/group/${token}`}>
                <Button variant="outline">Back to Group Trip</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = data.branding?.primary_color || "#0b2545";
  const accentColor = data.branding?.accent_color || "#c9a84c";
  const agencyName = data.branding?.agency_name || data.advisor?.agency_name || "Crestwell Travel Services";
  const advisorName = data.advisor?.name || "Your Travel Advisor";
  const advisorPhone = data.advisor?.phone || data.branding?.phone || null;
  const advisorEmail = data.branding?.email_address || null;

  const hasPrestay = data.subTrip.notes?.toLowerCase().includes("pre-cruise hotel");
  const prestayLine = hasPrestay
    ? data.subTrip.notes?.split("\n").find((l) => l.toLowerCase().includes("pre-cruise hotel")) || "Pre-cruise hotel stay requested"
    : null;

  const depositPaid = data.depositPayment?.status === "paid";
  const balanceRemaining = (data.booking?.gross_sales || 0) - (depositPaid ? data.depositPayment?.amount || 0 : 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>My Reservation — {data.parentTrip.trip_name}</title>
        <meta name="description" content={`Reservation details for ${data.client.name} on ${data.parentTrip.trip_name}.`} />
      </Helmet>

      {/* Header */}
      <div className="relative h-64 md:h-80 bg-cover bg-center" style={{ backgroundImage: data.subTrip.cover_image_url ? `url(${data.subTrip.cover_image_url})` : undefined, backgroundColor: primaryColor }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative max-w-3xl mx-auto px-6 h-full flex flex-col justify-end pb-8">
          <Link to={`/group/${token}`} className="text-white/80 hover:text-white flex items-center gap-1 text-sm mb-3 w-fit">
            <ArrowLeft className="h-4 w-4" /> Back to group trip
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white font-serif">{data.parentTrip.trip_name}</h1>
          <p className="text-white/90 mt-1 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> {data.parentTrip.destination || "Group trip"}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 -mt-6">
        <Card className="rounded-xl shadow-sm border-0 overflow-hidden">
          <div className="p-6 border-b" style={{ borderColor: `${primaryColor}20` }}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: accentColor, color: primaryColor }}>
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{data.client.name}</h2>
                <p className="text-sm text-gray-500">Reservation confirmed</p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-8">
            {/* Trip details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Dates</p>
                  <p className="font-medium text-gray-900">
                    {data.parentTrip.depart_date ? format(new Date(`${data.parentTrip.depart_date}T00:00:00`), "MMM d, yyyy") : "TBD"}
                    {" — "}
                    {data.parentTrip.return_date ? format(new Date(`${data.parentTrip.return_date}T00:00:00`), "MMM d, yyyy") : "TBD"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Travelers</p>
                  <p className="font-medium text-gray-900">{data.subTrip.trip_name.includes("—") ? "2" : "1"} on record</p>
                </div>
              </div>

              {data.cabin && (
                <div className="flex items-start gap-3">
                  <Anchor className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Cabin / category</p>
                    <p className="font-medium text-gray-900">{data.cabin.category_name}</p>
                    <p className="text-sm text-gray-500">{currency(data.cabin.price_per_person)} per person</p>
                  </div>
                </div>
              )}

              {prestayLine && (
                <div className="flex items-start gap-3">
                  <BedDouble className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Pre-cruise hotel</p>
                    <p className="font-medium text-gray-900">{prestayLine.replace(/Pre-cruise hotel stay requested:?\s*/i, "")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Financial summary */}
            <div className="rounded-xl p-5" style={{ backgroundColor: `${primaryColor}08` }}>
              <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Trip total</span>
                  <span className="font-medium text-gray-900">{currency(data.booking?.gross_sales || 0)}</span>
                </div>
                {data.depositPayment && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Deposit {depositPaid ? "(paid)" : "(due)"}</span>
                    <span className={`font-medium ${depositPaid ? "text-green-700" : "text-gray-900"}`}>
                      {currency(data.depositPayment.amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-medium text-gray-900">Remaining balance</span>
                  <span className="font-semibold text-gray-900">{currency(Math.max(0, balanceRemaining))}</span>
                </div>
              </div>

              {!depositPaid && data.payUrl && (
                <Button
                  className="w-full mt-5 text-white"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => window.open(data.payUrl!, "_blank", "noopener")}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay Deposit — {currency(data.depositPayment?.amount || 0)}
                </Button>
              )}
              {depositPaid && (
                <div className="mt-5 flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Deposit paid — thank you!</span>
                </div>
              )}
            </div>

            {/* Advisor card */}
            <div className="border rounded-xl p-5 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Your travel advisor</p>
                <h4 className="font-semibold text-gray-900">{advisorName}</h4>
                <p className="text-sm text-gray-600">{agencyName}</p>
                <div className="mt-3 space-y-1 text-sm">
                  {advisorPhone && (
                    <a href={`tel:${advisorPhone.replace(/[^0-9]/g, "")}`} className="flex items-center gap-2 text-gray-700 hover:underline">
                      <Phone className="h-4 w-4" /> {advisorPhone}
                    </a>
                  )}
                  {advisorEmail && (
                    <a href={`mailto:${advisorEmail}`} className="flex items-center gap-2 text-gray-700 hover:underline">
                      <Mail className="h-4 w-4" /> {advisorEmail}
                    </a>
                  )}
                </div>
              </div>
              {data.advisor?.avatar_url && (
                <img src={data.advisor.avatar_url} alt={advisorName || ""} className="h-20 w-20 rounded-full object-cover border" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
