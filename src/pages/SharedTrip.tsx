import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import SharedTripHero from "@/components/shared-trip/SharedTripHero";
import SharedTripMeta from "@/components/shared-trip/SharedTripMeta";
import SharedTripItinerary from "@/components/shared-trip/SharedTripItinerary";
import SharedTripInvestment from "@/components/shared-trip/SharedTripInvestment";
import SharedTripBudgetConfirmation from "@/components/shared-trip/SharedTripBudgetConfirmation";
import SharedTripFooter from "@/components/shared-trip/SharedTripFooter";
import SharedTripPricing from "@/components/shared-trip/SharedTripPricing";
import PaymentTimelineVisual from "@/components/shared-trip/PaymentTimelineVisual";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { sanitizePublishedItinerary, sanitizePublishedOptionBlocks } from "@/lib/publishedTrip";

export interface SharedTripData {
  trip: {
    trip_name: string;
    destination: string | null;
    depart_date: string | null;
    return_date: string | null;
    status: string;
    trip_type: string | null;
    notes: string | null;
    total_cost: number | null;
    cover_image_url: string | null;
  };
  deposit: {
    required: boolean;
    amount: number;
  };
  cancellationTerms: string[];
  paymentDeadlines: { label: string; date: string }[];
  itinerary: any[];
  bookings: any[];
  pricingLines?: any[];
  branding: {
    agency_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    tagline: string | null;
    email_address: string | null;
    phone: string | null;
    website: string | null;
  } | null;
  advisor: {
    name: string | null;
    avatar_url: string | null;
    agency_name: string | null;
    job_title: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    clia_number: string | null;
    ccra_number: string | null;
    asta_number: string | null;
    embarc_number: string | null;
  } | null;
}

type TabKey = "itinerary" | "overview" | "pricing";

export default function SharedTrip() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("itinerary");

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shared-trip?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) {
          setError(res.status === 404 ? "This trip page is not available." : "Something went wrong.");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Unable to load trip.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Skeleton className="h-[400px] w-full" />
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">{error || "Trip not found."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = data.branding?.primary_color || "#1a365d";

  const publishedItinerary = sanitizePublishedItinerary((data.itinerary || []) as any[], {
    departDate: data.trip.depart_date,
    returnDate: data.trip.return_date,
  });

  const publishedOptionBlocks = sanitizePublishedOptionBlocks((((data as any).optionBlocks) || []) as any[], {
    departDate: data.trip.depart_date,
    returnDate: data.trip.return_date,
  });

  const tabs: { key: TabKey; label: string }[] = [
    { key: "itinerary", label: "Full Itinerary" },
    { key: "overview", label: "Daily Overview" },
    { key: "pricing", label: "Pricing" },
  ];

  // Build daily overview from itinerary
  const dailyOverview = publishedItinerary.reduce((acc: Record<number, any[]>, item: any) => {
    (acc[item.day_number] = acc[item.day_number] || []).push(item);
    return acc;
  }, {});

  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-white">
      {data.trip.cover_image_url && (
        <div className="relative w-full h-[40vh] overflow-hidden">
          <img
            src={data.trip.cover_image_url}
            alt={data.trip.trip_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">{data.trip.trip_name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-white/90 text-sm">
              {data.trip.destination && <span>📍 {data.trip.destination}</span>}
              {data.trip.depart_date && (
                <span>📅 {formatDate(data.trip.depart_date)}
                  {data.trip.return_date && ` – ${formatDate(data.trip.return_date)}`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <SharedTripHero branding={data.branding} advisor={data.advisor} primaryColor={primaryColor} />

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {!data.trip.cover_image_url && (
          <SharedTripMeta trip={data.trip} primaryColor={primaryColor} />
        )}

        {/* Trip name + date (below hero when cover exists) */}
        {data.trip.cover_image_url && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{data.trip.trip_name}</h2>
            {data.trip.depart_date && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Calendar className="h-4 w-4" />
                {formatDate(data.trip.depart_date)}
                {data.trip.return_date && ` – ${formatDate(data.trip.return_date)}`}
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-2 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-gray-900"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              style={activeTab === tab.key ? { color: primaryColor } : undefined}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "itinerary" && (
          <div className="space-y-10">
            {data.trip.notes && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Trip Details</h2>
                <p className="text-gray-500 leading-relaxed whitespace-pre-wrap">{data.trip.notes}</p>
              </div>
            )}

            <SharedTripItinerary
              itinerary={publishedItinerary}
              departDate={data.trip.depart_date}
              primaryColor={primaryColor}
              optionBlocks={publishedOptionBlocks}
            />
          </div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-6">
            {data.trip.notes && (
              <p className="text-gray-500 leading-relaxed whitespace-pre-wrap">{data.trip.notes}</p>
            )}
            {Object.keys(dailyOverview).length > 0 ? (
              Object.entries(dailyOverview)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([day, items]: [string, any[]]) => (
                  <div key={day} className="space-y-2">
                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      <span
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {day}
                      </span>
                      Day {day}
                      {items[0]?.item_date && (
                        <span className="text-sm text-gray-400 font-normal ml-2">
                          {parseLocalDate(items[0].item_date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        </span>
                      )}
                    </h3>
                    <div className="ml-9 space-y-1">
                      {items.map((item: any) => (
                        <div key={item.id} className="flex items-start gap-2 py-1.5">
                          <span className="text-sm">{item.category === "flight" ? "✈️" : item.category === "cruise" ? "🚢" : item.category === "lodging" ? "🏨" : item.category === "activity" ? "🎯" : item.category === "dining" ? "🍽️" : "📌"}</span>
                          <div>
                            <p className="text-sm text-gray-800 font-medium">{item.title}</p>
                            {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-gray-400 text-sm">No itinerary items to display.</p>
            )}
          </div>
        )}

        {activeTab === "pricing" && (
          <SharedTripPricing
            pricingLines={(data as any).pricingLines || []}
            totalCost={data.trip.total_cost || 0}
            primaryColor={primaryColor}
          />
        )}

        {/* Always show below tabs */}
        {(data as any).budget?.range && (
          <SharedTripBudgetConfirmation
            budgetRange={(data as any).budget.range}
            confirmed={(data as any).budget.confirmed}
            confirmedAt={(data as any).budget.confirmed_at}
            changeRequested={(data as any).budget.change_requested}
            changeRequestMessage={(data as any).budget.change_request_message}
            primaryColor={primaryColor}
            shareToken={token || undefined}
          />
        )}

        <SharedTripInvestment
          trip={data.trip}
          deposit={data.deposit || { required: false, amount: 0 }}
          cancellationTerms={data.cancellationTerms || []}
          paymentDeadlines={data.paymentDeadlines || []}
          primaryColor={primaryColor}
          upgradeNotes={(data as any).upgrade_notes}
          shareToken={token || undefined}
        />

        <PaymentTimelineVisual
          deposit={data.deposit || { required: false, amount: 0 }}
          paymentDeadlines={data.paymentDeadlines || []}
          totalCost={data.trip.total_cost || 0}
          primaryColor={primaryColor}
        />

        <SharedTripFooter branding={data.branding} advisor={data.advisor} />
      </div>
    </div>
  );
}
