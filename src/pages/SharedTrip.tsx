import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import SharedTripHero from "@/components/shared-trip/SharedTripHero";
import SharedTripMeta from "@/components/shared-trip/SharedTripMeta";
import SharedTripItinerary from "@/components/shared-trip/SharedTripItinerary";
import SharedTripInvestment from "@/components/shared-trip/SharedTripInvestment";
import SharedTripBudgetConfirmation from "@/components/shared-trip/SharedTripBudgetConfirmation";
import SharedTripFlowSteps from "@/components/shared-trip/SharedTripFlowSteps";
import SharedTripFooter from "@/components/shared-trip/SharedTripFooter";
import SharedTripPricing from "@/components/shared-trip/SharedTripPricing";
import PaymentTimelineVisual from "@/components/shared-trip/PaymentTimelineVisual";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CheckCircle2, Loader2, MapPin, ChevronDown, PartyPopper } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { sanitizePublishedItinerary, sanitizePublishedOptionBlocks } from "@/lib/publishedTrip";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

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
  cabinOptions?: Array<{
    id: string;
    category_name: string;
    price_per_person: number;
    price_period?: string | null;
    deposit_amount?: number | null;
    capacity?: number | null;
    image_url?: string | null;
    description?: string | null;
  }>;
  itineraries?: Array<{
    id: string;
    name: string;
    overview: string | null;
    cover_image_url: string | null;
    depart_date: string | null;
    return_date: string | null;
    sort_order: number;
    header_style: string | null;
    font_style: string | null;
    items: any[];
    optionBlocks: any[];
  }>;
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
  approvedItineraryId?: string | null;
  itineraryApprovedAt?: string | null;
}

// ─── Confirmation overlay shown after key customer actions ────────────────────
function ConfirmationScreen({
  primaryColor,
  advisorName,
  agencyName,
  advisorPhone,
  advisorEmail,
  message,
  subMessage,
}: {
  primaryColor: string;
  advisorName: string | null;
  agencyName: string | null;
  advisorPhone: string | null;
  advisorEmail: string | null;
  message: string;
  subMessage: string;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div
          className="h-20 w-20 rounded-full flex items-center justify-center mx-auto shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <PartyPopper className="h-9 w-9 text-white" />
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{message}</h1>
          <p className="text-gray-500 leading-relaxed">{subMessage}</p>
        </div>

        {/* Advisor contact card */}
        {(advisorName || agencyName) && (
          <div className="rounded-xl border border-gray-200 p-5 text-left space-y-3 bg-gray-50">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Your Travel Advisor</p>
            <div>
              {advisorName && <p className="font-semibold text-gray-900">{advisorName}</p>}
              {agencyName && <p className="text-sm text-gray-500">{agencyName}</p>}
            </div>
            <div className="space-y-1 text-sm">
              {advisorPhone && (
                <a
                  href={`tel:${advisorPhone}`}
                  className="flex items-center gap-2 font-medium hover:underline"
                  style={{ color: primaryColor }}
                >
                  {advisorPhone}
                </a>
              )}
              {advisorEmail && (
                <a
                  href={`mailto:${advisorEmail}`}
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
                >
                  {advisorEmail}
                </a>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          You can close this window or keep it for reference.
        </p>
      </div>
    </div>
  );
}

// ─── Sticky anchor nav used after hero scrolls out of view ───────────────────
type SectionKey = "your-trip" | "pricing";

function StickyNav({
  sections,
  activeSection,
  primaryColor,
  onScrollTo,
}: {
  sections: { key: SectionKey; label: string }[];
  activeSection: SectionKey;
  primaryColor: string;
  onScrollTo: (key: SectionKey) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 220);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur"
      style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
    >
      <div className="max-w-4xl mx-auto px-6 flex items-center gap-6 h-12">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => onScrollTo(s.key)}
            className={`text-sm font-medium pb-0.5 transition-colors border-b-2 ${
              activeSection === s.key ? "border-current" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
            style={activeSection === s.key ? { color: primaryColor, borderColor: primaryColor } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sticky bottom CTA bar shown immediately below the hero ──────────────────
function CTABar({
  tripName,
  destination,
  departDate,
  totalCost,
  primaryColor,
  hasMultipleItineraries,
  approvedItineraryId,
  termsAccepted,
  onScrollToAction,
}: {
  tripName: string;
  destination: string | null;
  departDate: string | null;
  totalCost: number | null;
  primaryColor: string;
  hasMultipleItineraries: boolean;
  approvedItineraryId: string | null;
  termsAccepted: boolean;
  onScrollToAction: () => void;
}) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // Determine the right CTA label
  let ctaLabel = "Review & Approve";
  if (approvedItineraryId && !termsAccepted) ctaLabel = "Accept & Authorize Payment";
  if (termsAccepted) ctaLabel = "View My Trip";
  if (!hasMultipleItineraries && !approvedItineraryId && !termsAccepted) ctaLabel = "Review Pricing & Book";

  return (
    <div
      className="w-full border-b border-gray-100 bg-gray-50 py-4"
    >
      <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Trip summary */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          {destination && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" style={{ color: primaryColor }} />
              {destination}
            </span>
          )}
          {departDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" style={{ color: primaryColor }} />
              {parseLocalDate(departDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {totalCost != null && totalCost > 0 && (
            <span className="font-semibold text-gray-900">{formatCurrency(totalCost)}</span>
          )}
        </div>

        {/* CTA button */}
        <Button
          className="text-white shrink-0 gap-2"
          style={{ backgroundColor: primaryColor }}
          onClick={onScrollToAction}
        >
          {ctaLabel}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SharedTrip() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const [data, setData] = useState<SharedTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active anchor section for sticky nav
  const [activeSection, setActiveSection] = useState<SectionKey>("your-trip");

  // Multi-itinerary state
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null);
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [submittingChoice, setSubmittingChoice] = useState(false);

  // Confirmation overlay state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationSubMessage, setConfirmationSubMessage] = useState("");

  // Terms accepted state (lifted so CTA bar can reflect it)
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Live pricing totals — updated whenever customer toggles add-ons in SharedTripPricing
  // Initialized to null so we fall back to trip.total_cost until the component fires its first callback
  const [liveTripTotal, setLiveTripTotal] = useState<number | null>(null);
  const [liveDeposit, setLiveDeposit] = useState<number>(0);

  const handleTotalChange = (total: number, deposit: number) => {
    setLiveTripTotal(total);
    setLiveDeposit(deposit);
  };

  // Section refs for scroll-to
  const yourTripRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const investmentRef = useRef<HTMLDivElement>(null);

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

  // Default selection to already-approved itinerary
  useEffect(() => {
    if (data?.approvedItineraryId) {
      setSelectedItineraryId(data.approvedItineraryId);
    }
  }, [data?.approvedItineraryId]);

  // Intersection observer for sticky nav active section
  useEffect(() => {
    const refs = [
      { key: "your-trip" as SectionKey, ref: yourTripRef },
      { key: "pricing" as SectionKey, ref: pricingRef },
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const found = refs.find((r) => r.ref.current === entry.target);
            if (found) setActiveSection(found.key);
          }
        }
      },
      { threshold: 0.2 }
    );
    refs.forEach(({ ref }) => { if (ref.current) observer.observe(ref.current); });
    return () => observer.disconnect();
  }, [data]);

  const scrollTo = (key: SectionKey) => {
    const map: Record<SectionKey, React.RefObject<HTMLDivElement>> = {
      "your-trip": yourTripRef,
      pricing: pricingRef,
    };
    map[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToAction = () => {
    if (investmentRef.current) {
      investmentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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

  // Show full-screen confirmation overlay
  if (showConfirmation) {
    return (
      <ConfirmationScreen
        primaryColor={data.branding?.primary_color || "#1a365d"}
        advisorName={data.advisor?.name ?? null}
        agencyName={data.branding?.agency_name ?? data.advisor?.agency_name ?? null}
        advisorPhone={data.advisor?.phone ?? data.branding?.phone ?? null}
        advisorEmail={data.advisor?.email ?? data.branding?.email_address ?? null}
        message={confirmationMessage}
        subMessage={confirmationSubMessage}
      />
    );
  }

  const primaryColor = data.branding?.primary_color || "#1a365d";

  const itineraries = (data.itineraries || []).filter(
    (it) => (it.items?.length || 0) > 0 || (it.optionBlocks?.length || 0) > 0 || it.overview
  );
  const approvedItineraryId = data.approvedItineraryId || null;
  const hasMultipleItineraries = itineraries.length > 1;
  const activeItinerary =
    itineraries.find((it) => it.id === selectedItineraryId) || itineraries[0] || null;

  // Confirm itinerary choice
  const confirmChoice = async () => {
    if (!pendingChoiceId || !token) return;
    setSubmittingChoice(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shared-trip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            token,
            action: "select_itinerary",
            itinerary_id: pendingChoiceId,
            user_agent: navigator.userAgent,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save selection");

      // Refresh data
      const refresh = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shared-trip?token=${token}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (refresh.ok) setData(await refresh.json());
      setPendingChoiceId(null);

      // Show confirmation overlay
      const chosenName = itineraries.find((it) => it.id === pendingChoiceId)?.name || "your itinerary";
      setConfirmationMessage("Great choice!");
      setConfirmationSubMessage(
        `You've selected "${chosenName}." Your travel advisor has been notified and will be in touch shortly to confirm next steps.`
      );
      setShowConfirmation(true);
    } catch {
      toast.error("We couldn't save your choice. Please try again.");
    } finally {
      setSubmittingChoice(false);
    }
  };

  // Called by SharedTripInvestment when terms are accepted + payment flow completes
  const handleTermsAccepted = () => {
    setTermsAccepted(true);
    setConfirmationMessage("You're all set!");
    setConfirmationSubMessage(
      "Your agreement has been received. Your travel advisor will process your payment and send a confirmation. Reach out anytime with questions."
    );
    setShowConfirmation(true);
  };

  const sourceItems = activeItinerary?.items ?? data.itinerary ?? [];
  const sourceBlocks = activeItinerary?.optionBlocks ?? (data as any).optionBlocks ?? [];
  const sourceDepart = activeItinerary?.depart_date ?? data.trip.depart_date;
  const sourceReturn = activeItinerary?.return_date ?? data.trip.return_date;

  // ── Presentation style ────────────────────────────────────────────────────
  const headerStyle = (activeItinerary as any)?.header_style || "full_bleed";
  const fontStyle   = (activeItinerary as any)?.font_style   || "standard";

  const FONT_MAP: Record<string, { family: string; googleParam: string | null }> = {
    standard: { family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", googleParam: null },
    sans:     { family: "'Outfit', sans-serif",              googleParam: "Outfit:wght@400;500;600;700" },
    serif:    { family: "'Cormorant Garamond', serif",        googleParam: "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600" },
  };
  const activeFont = FONT_MAP[fontStyle] ?? FONT_MAP.standard;

  const coverImageUrl = activeItinerary?.cover_image_url ?? data.trip.cover_image_url ?? null;

  const publishedItinerary = sanitizePublishedItinerary(sourceItems as any[], {
    departDate: sourceDepart,
    returnDate: sourceReturn,
  });

  const publishedOptionBlocks = sanitizePublishedOptionBlocks(sourceBlocks as any[], {
    departDate: sourceDepart,
    returnDate: sourceReturn,
  });

  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const navSections: { key: SectionKey; label: string }[] = [
    { key: "your-trip", label: "Your Trip" },
    { key: "pricing", label: "Pricing & Payment" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Advisor preview banner ── */}
      {isPreview && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2 shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Advisor Preview — clients cannot see this banner. Hidden items are not shown.
        </div>
      )}
      {/* ── Google Fonts loader (injected per font_style) ── */}
      {activeFont.googleParam && (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${activeFont.googleParam}&display=swap`}
        />
      )}

      {/* ── Global font style injection ── */}
      <style>{`
        .cw-proposal {
          font-family: ${activeFont.family};
        }
        .cw-proposal h1, .cw-proposal h2, .cw-proposal h3 {
          font-family: ${activeFont.family};
        }
      `}</style>

      {/* ── Cover Hero — 4 display styles ─────────────────────────────────────
        full_bleed : Full-viewport cinematic — image fills 100vh, title overlaid at bottom
        large      : Prominent ~50vh image, title/dates below on white
        minimized  : Compact 120px banner strip, trip name in overlay
        legacy     : No image — text-only header block
      ── */}

      {headerStyle === "full_bleed" && coverImageUrl && (
        <div className="relative w-full overflow-hidden" style={{ height: "100svh", maxHeight: "100vh" }}>
          <img
            src={coverImageUrl}
            alt={data.trip.trip_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Bottom-weighted gradient for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {/* Top logo/branding strip */}
          {data.branding?.logo_url && (
            <div className="absolute top-6 left-6">
              <img src={data.branding.logo_url} alt={data.branding.agency_name || ""} className="h-10 object-contain drop-shadow-md" />
            </div>
          )}
          {/* Bottom text overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 max-w-4xl mx-auto">
            <div className="mb-3">
              {data.trip.destination && (
                <span className="inline-flex items-center gap-1.5 text-white/70 text-sm mb-2">
                  <span>📍</span>{data.trip.destination}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-xl leading-tight tracking-tight"
                style={{ fontFamily: activeFont.family }}
            >
              {data.trip.trip_name}
            </h1>
            {data.trip.depart_date && (
              <p className="mt-3 text-white/80 text-base">
                {formatDate(data.trip.depart_date)}
                {data.trip.return_date && ` – ${formatDate(data.trip.return_date)}`}
              </p>
            )}
            {/* Scroll indicator */}
            <div className="mt-8 flex items-center gap-2 text-white/50 text-xs animate-bounce">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Scroll to explore
            </div>
          </div>
        </div>
      )}

      {headerStyle === "large" && coverImageUrl && (
        <div className="w-full">
          <div className="relative w-full overflow-hidden" style={{ height: "50vh", minHeight: 280 }}>
            <img
              src={coverImageUrl}
              alt={data.trip.trip_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
          </div>
          <div className="max-w-4xl mx-auto px-6 py-6 border-b border-gray-100">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight"
                style={{ fontFamily: activeFont.family }}
            >
              {data.trip.trip_name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-500 text-sm">
              {data.trip.destination && <span className="flex items-center gap-1">📍 {data.trip.destination}</span>}
              {data.trip.depart_date && (
                <span className="flex items-center gap-1">
                  📅 {formatDate(data.trip.depart_date)}
                  {data.trip.return_date && ` – ${formatDate(data.trip.return_date)}`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {headerStyle === "minimized" && coverImageUrl && (
        <div className="relative w-full overflow-hidden" style={{ height: 120 }}>
          <img
            src={coverImageUrl}
            alt={data.trip.trip_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex items-end px-6 pb-4 max-w-4xl mx-auto">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white drop-shadow-md"
                  style={{ fontFamily: activeFont.family }}
              >
                {data.trip.trip_name}
              </h1>
              {data.trip.destination && (
                <p className="text-white/70 text-xs mt-0.5">📍 {data.trip.destination}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(headerStyle === "legacy" || !coverImageUrl) && (
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-6 border-b border-gray-100">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900"
              style={{ fontFamily: activeFont.family }}
          >
            {data.trip.trip_name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-500 text-sm">
            {data.trip.destination && <span>📍 {data.trip.destination}</span>}
            {data.trip.depart_date && (
              <span>
                📅 {formatDate(data.trip.depart_date)}
                {data.trip.return_date && ` – ${formatDate(data.trip.return_date)}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Advisor / branding hero ────────────────────────────────────── */}
      <SharedTripHero branding={data.branding} advisor={data.advisor} primaryColor={primaryColor} />

      {/* ── Sticky CTA bar (below hero, above fold) ───────────────────── */}
      <CTABar
        tripName={data.trip.trip_name}
        destination={data.trip.destination}
        departDate={data.trip.depart_date}
        totalCost={liveTripTotal ?? data.trip.total_cost}
        primaryColor={primaryColor}
        hasMultipleItineraries={hasMultipleItineraries}
        approvedItineraryId={approvedItineraryId}
        termsAccepted={termsAccepted}
        onScrollToAction={scrollToAction}
      />

      {/* ── Sticky anchor nav (appears after user scrolls past CTA bar) ── */}
      <StickyNav
        sections={navSections}
        activeSection={activeSection}
        primaryColor={primaryColor}
        onScrollTo={scrollTo}
      />

      {/* ── Page content ──────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-16 cw-proposal">

        {/* ── YOUR TRIP section ─────────────────────────────────────────── */}
        <div ref={yourTripRef} id="your-trip" className="scroll-mt-14 space-y-10">

          {/* How this works — 3-step process card */}
          <SharedTripFlowSteps
            itinerarySelected={Boolean(approvedItineraryId)}
            budgetConfirmed={Boolean((data as any).budget?.confirmed)}
            paymentReady={Boolean(termsAccepted)}
            primaryColor={primaryColor}
          />

          {/* Trip name/meta when no cover image */}
          {!data.trip.cover_image_url && (
            <SharedTripMeta trip={data.trip} primaryColor={primaryColor} />
          )}

          {/* Trip name + date repeated below cover */}
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

          {/* ─ Approved banner ─ */}
          {approvedItineraryId && activeItinerary && (
            <div
              className="flex items-start gap-3 rounded-xl border p-4"
              style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}10` }}
            >
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: primaryColor }} />
              <div className="text-sm">
                <p className="font-semibold text-gray-900">You've selected "{activeItinerary.name}"</p>
                <p className="text-gray-600 mt-0.5">
                  Your travel advisor has been notified and this itinerary is now active in your client portal.
                </p>
              </div>
            </div>
          )}

          {/* ─ Multi-itinerary chooser ─ */}
          {!approvedItineraryId && hasMultipleItineraries && (
            <div className="space-y-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Choose Your Option</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We've put together {itineraries.length} options for this trip. Preview each, then choose the one you'd like to move forward with.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {itineraries.map((it) => {
                  const isActive = activeItinerary?.id === it.id;
                  return (
                    <div
                      key={it.id}
                      className={`text-left rounded-xl border-2 overflow-hidden transition-all bg-white ${
                        isActive ? "shadow-md" : "border-gray-200 hover:border-gray-300"
                      }`}
                      style={isActive ? { borderColor: primaryColor } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedItineraryId(it.id)}
                        className="w-full text-left"
                      >
                        {it.cover_image_url && (
                          <img src={it.cover_image_url} alt={it.name} className="w-full h-32 object-cover" />
                        )}
                        <div className="p-4 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-gray-900">{it.name}</h3>
                            {isActive && (
                              <span
                                className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: primaryColor }}
                              >
                                Previewing
                              </span>
                            )}
                          </div>
                          {it.depart_date && (
                            <p className="text-xs text-gray-500">
                              {formatDate(it.depart_date)}
                              {it.return_date && ` – ${formatDate(it.return_date)}`}
                            </p>
                          )}
                          {it.overview && (
                            <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap pt-1">
                              {it.overview}
                            </p>
                          )}
                        </div>
                      </button>
                      <div className="px-4 pb-4">
                        <Button
                          type="button"
                          className="w-full text-white"
                          style={{ backgroundColor: primaryColor }}
                          onClick={() => setPendingChoiceId(it.id)}
                        >
                          Select this option
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400">
                Once you confirm, your chosen itinerary is locked in and shared with your travel advisor.
              </p>
            </div>
          )}

          {/* ─ Itinerary overview statement ─ */}
          {activeItinerary?.overview && (!hasMultipleItineraries || approvedItineraryId) && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{activeItinerary.name}</h2>
              <p className="text-gray-500 leading-relaxed whitespace-pre-wrap">{activeItinerary.overview}</p>
            </div>
          )}

          {/* ─ Trip notes ─ */}
          {data.trip.notes && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Trip Details</h2>
              <p className="text-gray-500 leading-relaxed whitespace-pre-wrap">{data.trip.notes}</p>
            </div>
          )}

          {/* ─ Full itinerary ─ */}
          {publishedItinerary.length > 0 || publishedOptionBlocks.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Full Itinerary</h2>
              <SharedTripItinerary
                itinerary={publishedItinerary}
                departDate={data.trip.depart_date}
                primaryColor={primaryColor}
                optionBlocks={publishedOptionBlocks}
              />
            </div>
          ) : null}

          {/* ─ Cabin / Category options ─ */}
          {data.cabinOptions && data.cabinOptions.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Cabin & Category Options</h2>
              <p className="text-sm text-gray-500 mb-6">Choose the category that works best for your travel party.</p>
              <div className="grid gap-4 md:grid-cols-2">
                {data.cabinOptions.map((cabin) => (
                  <div key={cabin.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
                    {cabin.image_url && (
                      <img src={cabin.image_url} alt={cabin.category_name} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-4 space-y-2 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{cabin.category_name}</h3>
                        <div className="text-right shrink-0">
                          <div className="font-bold" style={{ color: primaryColor }}>
                            ${Number(cabin.price_per_person || 0).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            /person{cabin.price_period === "night" ? " / night" : ""}
                          </div>
                        </div>
                      </div>
                      {cabin.description && (
                        <p className="text-sm text-gray-500 whitespace-pre-wrap">{cabin.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pt-1 mt-auto">
                        {!!cabin.deposit_amount && cabin.deposit_amount > 0 && (
                          <span>${Number(cabin.deposit_amount).toLocaleString()} deposit</span>
                        )}
                        {cabin.capacity ? <span>Max {cabin.capacity} travelers</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── PRICING & PAYMENT section ─────────────────────────────────── */}
        <div ref={pricingRef} id="pricing" className="scroll-mt-14 space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 border-t border-gray-100 pt-6">
              Pricing &amp; Payment
            </h2>

            <SharedTripPricing
              pricingLines={(data as any).pricingLines || []}
              totalCost={data.trip.total_cost || 0}
              primaryColor={primaryColor}
              termsAccepted={termsAccepted}
              onTotalChange={handleTotalChange}
            />

            <PaymentTimelineVisual
              deposit={data.deposit || { required: false, amount: 0 }}
              paymentDeadlines={data.paymentDeadlines || []}
              totalCost={data.trip.total_cost || 0}
              primaryColor={primaryColor}
            />

            {/* Budget confirmation widget */}
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

            {/* Investment / terms acceptance / payment CTA */}
            <div ref={investmentRef}>
              <SharedTripInvestment
                trip={{
                  ...data.trip,
                  // Use live total from pricing component if add-ons have been toggled,
                  // otherwise fall back to the raw trip total from the API
                  total_cost: liveTripTotal ?? data.trip.total_cost,
                }}
                deposit={
                  liveDeposit > 0
                    ? { required: true, amount: liveDeposit }
                    : data.deposit || { required: false, amount: 0 }
                }
                cancellationTerms={data.cancellationTerms || []}
                paymentDeadlines={data.paymentDeadlines || []}
                primaryColor={primaryColor}
                upgradeNotes={(data as any).upgrade_notes}
                shareToken={token || undefined}
                onTermsAccepted={handleTermsAccepted}
                bookingSupplierTypes={
                  (data.bookings || []).map((b: any) => b.supplier_type).filter(Boolean)
                }
                stripePublishableKey={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}
              />
            </div>
        </div>

        <SharedTripFooter branding={data.branding} advisor={data.advisor} />
      </div>

      {/* ── Itinerary choice confirmation dialog ──────────────────────── */}
      <AlertDialog
        open={!!pendingChoiceId}
        onOpenChange={(open) => {
          if (!open && !submittingChoice) setPendingChoiceId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm your itinerary choice</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to select{" "}
              <strong>
                {itineraries.find((it) => it.id === pendingChoiceId)?.name || "this option"}
              </strong>{" "}
              as your preferred itinerary. Your travel advisor will be notified and this will become the active itinerary in your client portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submittingChoice}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={submittingChoice}
              onClick={(e) => {
                e.preventDefault();
                confirmChoice();
              }}
              style={{ backgroundColor: primaryColor }}
            >
              {submittingChoice ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm selection"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

