import { useEffect, useState } from "react";
import crestwellLogo from "@/assets/CTN-Logo.png";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import DOMPurify from "dompurify";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { EventRsvpForm } from "@/components/group/EventRsvp";
import {
  MapPin,
  Calendar,
  CheckCircle2,
  Plane,
  Hotel,
  Utensils,
  Camera,
  ArrowRight,
  Phone,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Globe,
  Anchor,
  Compass,
  Users,
  BedDouble,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { CelebrationSection, type CelebrationConfig } from "@/components/group/CelebrationSection";
import { ItineraryGallery, getItemImages } from "@/components/shared/ItineraryGallery";
import { HawaiiProposal } from "@/components/group/HawaiiProposal";
import { ResortGroupProposal } from "@/components/group/ResortGroupProposal";
import { SafeHtml } from "@/components/ui/rich-text-editor";

interface FeatureImage {
  id: string;
  url: string;
  caption?: string;
}

interface AdditionalSection {
  id: string;
  title: string;
  content: string;
  rsvp_enabled?: boolean;
}

interface LandingContent {
  feature_images?: FeatureImage[];
  additional_sections?: AdditionalSection[];
  inclusions?: string[];
  notice_banner?: { enabled?: boolean; text?: string };
  signup_button_label?: string;
  signup_enabled?: boolean;
  cta_enabled?: boolean;
  cta_button_label?: string;
  cta_link?: string;
  celebration?: CelebrationConfig;
}

interface CabinOption {
  id: string;
  category_name: string;
  description: string | null;
  price_per_person: number;
  deposit_amount: number;
  capacity: number | null;
  image_url: string | null;
  sort_order: number;
  price_period?: string | null;
  requires_double_occupancy?: boolean | null;
}

interface GroupLandingData {
  trip: {
    booking_flow_enabled?: boolean;
    id: string;
    trip_name: string;
    destination: string | null;
    depart_date: string | null;
    return_date: string | null;
    status: string;
    notes: string | null;
    cover_image_url: string | null;
    budget_range: string | null;
    group_landing_headline: string | null;
    group_landing_description: string | null;
    group_landing_content: LandingContent | null;
  };
  branding: {
    agency_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    tagline: string | null;
    phone: string | null;
    email_address: string | null;
    website: string | null;
  } | null;
  advisor: {
    name: string | null;
    avatar_url: string | null;
    agency_name: string | null;
    job_title: string | null;
    phone: string | null;
    storefront_logo_url?: string | null;
    clia_number?: string | null;
    ccra_number?: string | null;
    asta_number?: string | null;
    embarc_number?: string | null;
  } | null;
  signupCount: number;
  cabinOptions: CabinOption[];
  itineraryHighlights: {
    title: string;
    description: string | null;
    category: string;
    day_number: number;
    location: string | null;
    image_url?: string | null;
    gallery_urls?: any[] | null;
    item_price?: number | null;
  }[];
}

const currency = (n: number) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const categoryIcons: Record<string, typeof Plane> = {

  flight: Plane,
  hotel: Hotel,
  dining: Utensils,
  activity: Camera,
  cruise: Anchor,
  transport: Compass,
};

// Pre-cruise hotel room choices (Hilton Hawaiian Village, 2 nights, double occupancy).
// Rates are per night; a $66/night resort fee is paid at the hotel.
const PRESTAY_ROOM_OPTIONS = [
  { id: "resort-view-king-bb", name: "Resort View, 1 King — breakfast included", flexible: 409, prepaid: 347 },
  { id: "resort-view-2-double", name: "Resort View, 2 Double Beds — room only", flexible: 398, prepaid: 338 },
  { id: "ocean-view-king-ro", name: "Ocean View, 1 King — room only", flexible: 417, prepaid: 354 },
  { id: "ocean-view-king-bb", name: "Ocean View, 1 King — breakfast included", flexible: 428, prepaid: 363 },
];
const PRESTAY_NIGHTS = 2;
const PRESTAY_RESORT_FEE_PER_NIGHT = 66;

// Curated city options for the "traveling from" city/state dropdowns.
const US_CITIES: Record<string, string[]> = {
  "Alabama": ["Birmingham", "Huntsville", "Mobile", "Montgomery"],
  "Alaska": ["Anchorage", "Fairbanks", "Juneau"],
  "Arizona": ["Phoenix", "Tucson", "Scottsdale", "Mesa", "Flagstaff"],
  "Arkansas": ["Little Rock", "Fayetteville", "Fort Smith"],
  "California": ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "Oakland", "San Jose", "Fresno"],
  "Colorado": ["Denver", "Colorado Springs", "Boulder", "Aurora"],
  "Connecticut": ["Hartford", "New Haven", "Stamford", "Bridgeport"],
  "Delaware": ["Wilmington", "Dover", "Newark"],
  "Florida": ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale", "Naples", "Tallahassee", "Pensacola"],
  "Georgia": ["Atlanta", "Savannah", "Augusta", "Macon"],
  "Hawaii": ["Honolulu", "Kahului", "Kona", "Lihue", "Hilo"],
  "Idaho": ["Boise", "Idaho Falls", "Coeur d'Alene"],
  "Illinois": ["Chicago", "Springfield", "Peoria", "Rockford"],
  "Indiana": ["Indianapolis", "Fort Wayne", "Bloomington", "South Bend"],
  "Iowa": ["Des Moines", "Cedar Rapids", "Iowa City"],
  "Kansas": ["Wichita", "Kansas City", "Overland Park"],
  "Kentucky": ["Louisville", "Lexington", "Bowling Green"],
  "Louisiana": ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette"],
  "Maine": ["Portland", "Bangor", "Augusta"],
  "Maryland": ["Baltimore", "Bethesda", "Annapolis", "Silver Spring"],
  "Massachusetts": ["Boston", "Cambridge", "Springfield", "Worcester"],
  "Michigan": ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing"],
  "Minnesota": ["Minneapolis", "Saint Paul", "Duluth", "Rochester"],
  "Mississippi": ["Jackson", "Gulfport", "Biloxi"],
  "Missouri": ["Kansas City", "St. Louis", "Springfield", "Columbia"],
  "Montana": ["Billings", "Missoula", "Bozeman"],
  "Nebraska": ["Omaha", "Lincoln", "Grand Island"],
  "Nevada": ["Las Vegas", "Reno", "Henderson"],
  "New Hampshire": ["Manchester", "Nashua", "Concord"],
  "New Jersey": ["Newark", "Jersey City", "Trenton", "Atlantic City"],
  "New Mexico": ["Albuquerque", "Santa Fe", "Las Cruces"],
  "New York": ["New York City", "Buffalo", "Rochester", "Syracuse", "Albany"],
  "North Carolina": ["Charlotte", "Raleigh", "Greensboro", "Wilmington", "Asheville"],
  "North Dakota": ["Fargo", "Bismarck", "Grand Forks"],
  "Ohio": ["Cleveland", "Columbus", "Cincinnati", "Dayton", "Toledo"],
  "Oklahoma": ["Oklahoma City", "Tulsa", "Norman"],
  "Oregon": ["Portland", "Eugene", "Salem", "Bend"],
  "Pennsylvania": ["Philadelphia", "Pittsburgh", "Harrisburg", "Allentown"],
  "Rhode Island": ["Providence", "Newport", "Warwick"],
  "South Carolina": ["Charleston", "Columbia", "Greenville", "Myrtle Beach"],
  "South Dakota": ["Sioux Falls", "Rapid City", "Pierre"],
  "Tennessee": ["Nashville", "Memphis", "Knoxville", "Chattanooga"],
  "Texas": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso"],
  "Utah": ["Salt Lake City", "Park City", "Provo"],
  "Vermont": ["Burlington", "Montpelier", "Rutland"],
  "Virginia": ["Virginia Beach", "Richmond", "Norfolk", "Arlington", "Alexandria"],
  "Washington": ["Seattle", "Spokane", "Tacoma", "Bellevue"],
  "Washington, D.C.": ["Washington"],
  "West Virginia": ["Charleston", "Huntington", "Morgantown"],
  "Wisconsin": ["Milwaukee", "Madison", "Green Bay"],
  "Wyoming": ["Cheyenne", "Casper", "Jackson"],
};


export default function GroupLanding() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<GroupLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [reservationUrl, setReservationUrl] = useState<string | null>(null);
  const [depositDue, setDepositDue] = useState(0);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showInclusions, setShowInclusions] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);


  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    number_of_travelers: "1",
    notes: "",
    selected_cabin_option_id: "",
    departure_state: "",
    departure_city: "",

    companion_first_name: "",
    companion_last_name: "",
    companion_email: "",
    companion_phone: "",
  });

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-signup?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        if (!res.ok) {
          setError(
            res.status === 404
              ? "This group trip page is not available."
              : "Something went wrong."
          );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.email.trim()) {
      toast.error("Please fill in your name and email.");
      return;
    }
    if (form.number_of_travelers === "2" && !form.companion_first_name.trim()) {
      toast.error("Please fill in the second traveler's first name.");
      return;
    }
    if (!form.departure_state || !form.departure_city) {
      toast.error("Please select your city and state.");
      return;
    }
    const chosen = data?.cabinOptions?.find((c) => c.id === form.selected_cabin_option_id);
    if (chosen?.requires_double_occupancy && form.number_of_travelers !== "2") {
      toast.error(`${chosen.category_name} requires 2 travelers (double occupancy).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            token,
            ...form,
          }),
        }

      );
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Signup failed.");
        return;
      }
      setPayUrl(result.payUrl || null);
      setReservationUrl(result.reservationUrl || null);
      setDepositDue(Number(result.depositAmount || 0));
      setSubmitted(true);

    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-[420px] w-full" />
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {error || "Trip not found."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((data.trip.group_landing_content as any)?.proposal_config?.proposal_type === "hawaii_2027" && token) {
    return <HawaiiProposal token={token} data={data} />;
  }
  if ((data.trip.group_landing_content as any)?.proposal_config?.proposal_type === "resort_group_v1" && token) {
    return <ResortGroupProposal token={token} data={data} />;
  }

  const primaryColor = data.branding?.primary_color || "#1a365d";
  const accentColor = data.branding?.accent_color || "#d97706";
  const agentLogo =
    data.branding?.logo_url || data.advisor?.storefront_logo_url || crestwellLogo;
  const agentLogoAlt =
    data.branding?.agency_name || data.advisor?.agency_name || "Crestwell Travel Services";
  const content = data.trip.group_landing_content || {};
  const featureImages = content.feature_images || [];
  const additionalSections = content.additional_sections || [];
  const inclusions: string[] = content.inclusions || [];
  const celebration = content.celebration;
  const noticeText = content.notice_banner?.text?.trim() || "";
  const noticeEnabled = !!content.notice_banner?.enabled && noticeText.length > 0;
  const isClaireCelebration = token === "cccb3ae4b7d9178092ba9ca5";
  const celebrationPorts = Array.from(
    new Set(
      data.itineraryHighlights
        .filter((i) => i.location && /,/.test(i.location) && !/deck|ship/i.test(i.location))
        .map((i) => i.location as string)
    )
  ).filter((l) => !celebration?.embark_port || !l.includes(celebration.embark_port.split(",")[0]));
  const signupEnabled = content.signup_enabled !== false;
  const signupButtonLabel = content.signup_button_label || "Join This Trip";
  const openSignup = () => {
    if (data?.trip?.booking_flow_enabled && token) {
      window.location.assign(`/group/${token}/book`);
      return;
    }
    setShowSignupForm(true);
  };
  const ctaEnabled = content.cta_enabled || false;
  const ctaButtonLabel = content.cta_button_label || "Learn More";
  const ctaLink = content.cta_link || "";

  const headline = data.trip.group_landing_headline || data.trip.trip_name;
  const descriptionHtml = data.trip.group_landing_description || null;
  const descriptionPlain = data.trip.notes || null;

  const formatDateRange = () => {
    if (!data.trip.depart_date) return null;
    const depart = format(parseLocalDate(data.trip.depart_date), "MMMM d");
    const returnStr = data.trip.return_date
      ? format(parseLocalDate(data.trip.return_date), "MMMM d, yyyy")
      : null;
    return returnStr ? `${depart} – ${returnStr}` : depart;
  };

  // Featured pre-stay hotel: only the Hilton Hawaiian Village stay has saved
  // room rates (PRESTAY_ROOM_OPTIONS), so other trips' hotels stay in the
  // regular day-by-day itinerary instead of showing Hawaii pricing.
  const prestayHotel = data.itineraryHighlights.find(
    (i) =>
      i.category === "hotel" &&
      getItemImages(i).length > 0 &&
      /hilton hawaiian village/i.test(`${i.title || ""} ${i.location || ""}`)
  ) || null;

  // Group itinerary items by day (hotel with photos is featured separately)
  const itineraryByDay = data.itineraryHighlights
    .filter((i) => i !== prestayHotel)
    .reduce<
    Record<number, typeof data.itineraryHighlights>
  >((acc, item) => {
    if (!acc[item.day_number]) acc[item.day_number] = [];
    acc[item.day_number].push(item);
    return acc;
  }, {});

  const pageTitle = `${headline} — ${data.branding?.agency_name || data.advisor?.agency_name || "Crestwell Travel Network"}`;
  const pageDescription = data.trip.group_landing_description
    ? data.trip.group_landing_description.replace(/<[^>]+>/g, "").slice(0, 160)
    : data.trip.notes?.slice(0, 160) || `Join us for ${headline}`;
  const pageImage = data.trip.cover_image_url || agentLogo;
  const canonicalUrl = `${typeof window !== "undefined" ? window.location.origin : "https://app.crestwelltravels.com"}/group/${token}`;

  return (
    <div className={isClaireCelebration ? "luxury-celebration min-h-screen bg-background text-foreground" : "min-h-screen bg-white"}>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        {pageImage && <meta property="og:image" content={pageImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        {pageImage && <meta name="twitter:image" content={pageImage} />}
      </Helmet>
      {/* ─── NOTICE BANNER ────────────────────────── */}
      {noticeEnabled && (
        <div className="celebration-notice border-b" role="note">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-start gap-3">
            <Info className="h-4 w-4 shrink-0 mt-1" aria-hidden="true" />
            <p className="text-[13px] md:text-sm leading-relaxed">{noticeText}</p>
          </div>
        </div>
      )}

      {/* ─── HERO SECTION ─────────────────────────── */}
      <div className="celebration-hero relative w-full">
        {data.trip.cover_image_url ? (
          <>
            <div className="w-full h-[380px] md:h-[480px] relative overflow-hidden">
              <img
                src={data.trip.cover_image_url}
                alt={headline}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                sizes="100vw"
                className="w-full h-full object-cover"
              />
              <div className={isClaireCelebration ? "celebration-hero-shade absolute inset-0" : "absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              <div className="max-w-6xl mx-auto">
                  <img
                    src={agentLogo}
                    alt={agentLogoAlt}
                    className="h-[9rem] mb-4 object-contain object-left drop-shadow-lg"
                  />
                <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-3xl">
                  {headline}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  {formatDateRange() && (
                    <span className="inline-flex items-center gap-1.5 text-white/90 text-sm md:text-base font-medium bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <Calendar className="h-4 w-4" />
                      {formatDateRange()}
                    </span>
                  )}
                  {data.trip.destination && (
                    <span className="inline-flex items-center gap-1.5 text-white/90 text-sm md:text-base font-medium bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <MapPin className="h-4 w-4" />
                      {data.trip.destination}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            className="w-full h-[280px] md:h-[360px] flex items-end"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)`,
            }}
          >
            <div className="p-6 md:p-10 w-full">
              <div className="max-w-6xl mx-auto">
                  <img
                    src={agentLogo}
                    alt={agentLogoAlt}
                    className="h-[9rem] mb-4 object-contain object-left drop-shadow-lg"
                  />
                <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-3xl">
                  {headline}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  {formatDateRange() && (
                    <span className="inline-flex items-center gap-1.5 text-white/90 text-sm md:text-base">
                      <Calendar className="h-4 w-4" />
                      {formatDateRange()}
                    </span>
                  )}
                  {data.trip.destination && (
                    <span className="inline-flex items-center gap-1.5 text-white/90 text-sm md:text-base">
                      <MapPin className="h-4 w-4" />
                      {data.trip.destination}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MAIN CONTENT ─────────────────────────── */}
      <div className="celebration-main max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
        <div className="celebration-layout grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12 items-start">
          {/* ─── LEFT COLUMN ──────────────────────── */}
          <div className="celebration-content space-y-10">
            {/* Overview */}
            {descriptionHtml ? (
              <div
                className="text-gray-700 leading-relaxed prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(descriptionHtml) }}
              />
            ) : descriptionPlain ? (
              <SafeHtml html={descriptionPlain} className="text-gray-700 leading-relaxed text-[15px]" />
            ) : null}

            {celebration?.enabled && (
              <CelebrationSection
                config={celebration}
                departDate={data.trip.depart_date}
                returnDate={data.trip.return_date}
                ports={celebrationPorts}
                accentColor={accentColor}
              />
            )}

            {/* ─── INCLUDED IN YOUR TRIP ────────── */}
            {inclusions.length > 0 && (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowInclusions((v) => !v)}
                  aria-expanded={showInclusions}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg font-bold text-gray-900">Included in your trip</span>
                  {showInclusions ? (
                    <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
                  )}
                </button>
                {showInclusions && (
                  <ul className="px-5 pb-5 pt-1 space-y-2.5 border-t border-gray-100">
                    {inclusions.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-[15px] text-gray-700">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ─── FEATURED PRE-STAY HOTEL ──────── */}
            {prestayHotel && (
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex items-center gap-2">
                  <Hotel className="h-5 w-5" style={{ color: primaryColor }} />
                  <h2 className="text-xl font-bold text-gray-900">Pre-Cruise Hotel Stay</h2>
                </div>
                <div className="px-5 pb-5 space-y-4">
                  <ItineraryGallery
                    images={getItemImages(prestayHotel)}
                    alt={prestayHotel.title}
                    aspectClassName="aspect-[16/9]"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{prestayHotel.title}</h3>
                    {prestayHotel.location && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" /> {prestayHotel.location}
                      </p>
                    )}
                  </div>
                  {prestayHotel.description && (
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {prestayHotel.description.replace(/<[^>]+>/g, "")}
                    </p>
                  )}
                  {prestayHotel.item_price != null && (
                    <p className="text-base font-bold" style={{ color: primaryColor }}>
                      From {currency(prestayHotel.item_price)}
                    </p>
                  )}
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-xs text-gray-500">
                          <th className="px-3 py-2 font-medium">Room</th>
                          <th className="px-3 py-2 font-medium text-right">Prepaid / night</th>
                          <th className="px-3 py-2 font-medium text-right">Flexible / night</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PRESTAY_ROOM_OPTIONS.map((r) => (
                          <tr key={r.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-800">{r.name}</td>
                            <td className="px-3 py-2 text-right font-semibold">{currency(r.prepaid)}</td>
                            <td className="px-3 py-2 text-right">{currency(r.flexible)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400">
                    {PRESTAY_NIGHTS}-night stay, double occupancy. Plus a {currency(PRESTAY_RESORT_FEE_PER_NIGHT)}/night
                    resort fee paid at the hotel. Optional add-on — pick your room when you sign up below.
                  </p>

                </div>
              </div>
            )}

            {/* ─── ITINERARY LINK ───────────────── */}
            {Object.keys(itineraryByDay).length > 0 && (
              <a
                href={`/shared/${token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 hover:border-gray-300 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="p-2 rounded-lg shrink-0"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <Compass className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">View the full trip itinerary</p>
                    <p className="text-sm text-gray-500">
                      Day-by-day details for this trip
                    </p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </a>
            )}

            {/* ─── CABIN SELECTIONS: comparison table ────────── */}
            {data.cabinOptions && data.cabinOptions.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BedDouble className="h-6 w-6" style={{ color: primaryColor }} />
                  Cabin Selections
                </h2>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                              <th className="px-4 py-3 font-semibold">Option</th>
                              <th className="px-4 py-3 font-semibold text-right">{data.cabinOptions.every((c) => c.price_period === "cabin") ? "Cabin Total (USD)" : "Price (USD)"}</th>
                              {data.cabinOptions.some((c) => c.requires_double_occupancy) && (
                                <th className="px-4 py-3 font-semibold text-right">Cabin Total (2)</th>
                              )}
                              <th className="px-4 py-3 font-semibold text-right">Deposit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.cabinOptions.map((cabin, idx) => (
                              <tr
                                key={cabin.id}
                                className={`border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? "bg-gray-50/50" : ""}`}
                              >
                                <td className="px-4 py-3.5">
                                  <p className="font-semibold text-gray-900">{cabin.category_name}</p>
                                  {cabin.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 max-w-[280px]">{cabin.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                                    {cabin.requires_double_occupancy && <span>2 travelers min</span>}
                                    {cabin.capacity && <span>Max {cabin.capacity}</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <span className="text-base font-bold" style={{ color: primaryColor }}>
                                    {currency(cabin.price_per_person)}
                                  </span>
                                  {cabin.price_period !== "cabin" && (<span className="block text-[11px] text-muted-foreground">per person</span>)}
                                  {cabin.price_period === "night" && (
                                    <span className="block text-[11px] text-gray-400">per night</span>
                                  )}
                                </td>
                                {data.cabinOptions.some((c) => c.requires_double_occupancy) && (
                                  <td className="px-4 py-3.5 text-right font-semibold text-gray-700">
                                    {cabin.requires_double_occupancy
                                      ? currency(cabin.price_per_person * (cabin.price_period === "cabin" ? 1 : 2))
                                      : "—"}
                                  </td>
                                )}
                                <td className="px-4 py-3.5 text-right text-gray-600">
                                  {cabin.deposit_amount > 0 ? `${currency(cabin.deposit_amount)}/person` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Prices are per person based on double occupancy unless noted. Final taxes, fees, and availability are confirmed at booking.
                    </p>
              </div>
            )}

            {/* ─── GALLERY ────────────────────────── */}
            {featureImages.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Gallery
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {featureImages.map((img, idx) => (
                    <div
                      key={img.id}
                      role="button"
                      tabIndex={0}
                      aria-label={img.caption ? `View photo: ${img.caption}` : "View photo"}
                      onClick={() => setLightboxIndex(idx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setLightboxIndex(idx);
                        }
                      }}
                      className={`rounded-xl overflow-hidden group cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                        idx === 0 && featureImages.length >= 3
                          ? "col-span-2 row-span-2"
                          : ""
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.caption || "Trip photo"}
                        className={`w-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                          idx === 0 && featureImages.length >= 3
                            ? "h-64 sm:h-80"
                            : "h-36 sm:h-40"
                        }`}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── GALLERY LIGHTBOX ───────────────── */}
            <Dialog
              open={lightboxIndex !== null}
              onOpenChange={(open) => !open && setLightboxIndex(null)}
            >
              <DialogContent className="max-w-5xl w-[95vw] p-0 bg-black/95 border-none overflow-hidden [&>button]:hidden">
                <DialogTitle className="sr-only">
                  {lightboxIndex !== null
                    ? featureImages[lightboxIndex]?.caption || "Trip photo"
                    : "Trip photo"}
                </DialogTitle>
                {lightboxIndex !== null && featureImages[lightboxIndex] && (
                  <div className="relative flex flex-col">
                    <button
                      onClick={() => setLightboxIndex(null)}
                      aria-label="Close"
                      className="absolute top-3 right-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    {featureImages.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setLightboxIndex(
                              (lightboxIndex - 1 + featureImages.length) %
                                featureImages.length
                            )
                          }
                          aria-label="Previous photo"
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                          onClick={() =>
                            setLightboxIndex(
                              (lightboxIndex + 1) % featureImages.length
                            )
                          }
                          aria-label="Next photo"
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                      </>
                    )}
                    <img
                      src={featureImages[lightboxIndex].url}
                      alt={featureImages[lightboxIndex].caption || "Trip photo"}
                      className="w-full max-h-[78vh] object-contain"
                    />
                    <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-200">
                      <span>
                        {featureImages[lightboxIndex].caption || ""}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {lightboxIndex + 1} / {featureImages.length}
                      </span>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* ─── ADDITIONAL SECTIONS (accordion) ── */}
            {additionalSections.length > 0 && (
              <div className="celebration-events space-y-3">
                {additionalSections.map((section) => {
                  const isExpanded = expandedSections[section.id] ?? false;
                  return (
                    <div
                      key={section.id}
                      className="border border-gray-200 rounded-xl overflow-hidden"
                    >
                      <Button
                        variant="ghost"
                        onClick={() => toggleSection(section.id)}
                        aria-expanded={isExpanded}
                        className="w-full h-auto flex items-center justify-between gap-3 p-4 text-left whitespace-normal hover:bg-gray-50 transition-colors"
                      >
                        <h3 className="min-w-0 text-lg font-semibold text-gray-900">
                          {section.title || "Details"}
                        </h3>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
                        )}
                      </Button>
                      {isExpanded && section.content && (
                        <div className="px-4 pb-4 text-gray-600 leading-relaxed whitespace-pre-wrap text-[15px]">
                          {section.content}
                          {section.rsvp_enabled && token && (
                            <EventRsvpForm token={token} sectionId={section.id} accentColor={accentColor} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* CTA Button */}
            {ctaEnabled && ctaLink && (
              <div className="pt-2">
                <a href={ctaLink} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    className="text-base px-8 py-5"
                    style={{ backgroundColor: accentColor, color: "white" }}
                  >
                    {ctaButtonLabel}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN: Advisor Card (sticky) ── */}
          <div className="celebration-advisor lg:sticky lg:top-8 space-y-5">
            {/* Advisor Card */}
            {data.advisor && (
              <Card className="overflow-hidden shadow-xl border-0 rounded-2xl">
                {/* Banner */}
                <div
                  className="relative h-24"
                  style={{
                    background: isClaireCelebration ? "hsl(var(--primary))" : `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)`,
                  }}
                >
                  {data.branding?.tagline && (
                    <p className="absolute bottom-3 right-4 text-[11px] text-white/60 italic max-w-[180px] text-right">
                      {data.branding.tagline}
                    </p>
                  )}
                </div>

                {/* Avatar */}
                <div className="relative px-5">
                  <div className="-mt-10 mb-2">
                    {data.advisor.avatar_url ? (
                      <img
                        src={data.advisor.avatar_url}
                        alt={data.advisor.name || "Advisor"}
                        className="w-20 h-20 rounded-full object-cover border-[3px] border-white shadow-lg"
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-[3px] border-white shadow-lg"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(data.advisor.name || "A").charAt(0)}
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="px-5 pb-5 pt-0 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-gray-400 font-semibold">
                      Your Travel Advisor
                    </p>
                    <p className="font-bold text-gray-900 text-lg leading-snug mt-0.5">
                      {data.advisor.name}
                    </p>
                    {data.advisor.agency_name && (
                      <p className="text-sm text-gray-500">
                        {data.advisor.agency_name}
                      </p>
                    )}
                  </div>

                  {/* Credentials */}
                  {(data.advisor.clia_number ||
                    data.advisor.ccra_number ||
                    data.advisor.asta_number ||
                    data.advisor.embarc_number) && (
                    <div className="text-[11px] text-gray-400 space-y-0.5 font-medium">
                      {data.advisor.clia_number && (
                        <p>CLIA: {data.advisor.clia_number}</p>
                      )}
                      {data.advisor.ccra_number && (
                        <p>CCRA: {data.advisor.ccra_number}</p>
                      )}
                      {data.advisor.asta_number && (
                        <p>ASTA: {data.advisor.asta_number}</p>
                      )}
                      {data.advisor.embarc_number && (
                        <p>EMBARC: {data.advisor.embarc_number}</p>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <hr className="border-gray-100" />

                  {/* Contact */}
                  <div className="space-y-2 text-sm">
                    {data.branding?.email_address && (
                      <a
                        href={`mailto:${data.branding.email_address}`}
                        className="flex items-center gap-2.5 text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">
                          {data.branding.email_address}
                        </span>
                      </a>
                    )}
                    {data.advisor.phone && (
                      <a
                        href={`tel:${data.advisor.phone}`}
                        className="flex items-center gap-2.5 text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                        {data.advisor.phone}
                      </a>
                    )}
                  </div>

                  {/* Signup CTA */}
                  {signupEnabled && (
                    <Button
                      className="w-full text-base py-5 mt-1 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: primaryColor, color: "white" }}
                      onClick={openSignup}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {signupButtonLabel}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* If no advisor but signup enabled */}
            {!data.advisor && signupEnabled && (
              <Card className="shadow-xl border-0 overflow-hidden rounded-2xl">
                <div
                  className="p-6 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                  }}
                >
                  <h3 className="text-lg font-bold">Interested?</h3>
                  <p className="text-sm text-white/80 mt-1">
                    Sign up to reserve your spot.
                  </p>
                </div>
                <CardContent className="p-5">
                  <Button
                    className="w-full text-base py-5 rounded-xl font-semibold"
                    style={{ backgroundColor: primaryColor, color: "white" }}
                    onClick={openSignup}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {signupButtonLabel}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ─── Mobile sticky CTA ──────────────────── */}
        {signupEnabled && !showSignupForm && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t shadow-lg z-50">
            <Button
              className="w-full text-base py-5 rounded-xl font-semibold"
              style={{ backgroundColor: primaryColor, color: "white" }}
              onClick={openSignup}
            >
              <Users className="mr-2 h-4 w-4" />
              {signupButtonLabel}
            </Button>
          </div>
        )}
      </div>

      {/* ─── Signup Form Modal ────────────────────── */}
      {showSignupForm && signupEnabled && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden rounded-2xl flex flex-col max-h-[90vh]">
            <div
              className="p-6 text-white shrink-0"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
              }}
            >
              <h3 className="text-xl font-bold">
                {submitted ? "You're In!" : "Reserve Your Spot"}
              </h3>
              {!submitted && (
                <p className="text-sm text-white/80 mt-1">
                  Fill out the form below and your travel advisor will be in
                  touch.
                </p>
              )}
            </div>
            <CardContent className="p-6 overflow-y-auto flex-1">
              {submitted ? (
                <div className="text-center py-6 space-y-4">
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      Thank you, {form.first_name}!
                    </p>
                    {payUrl ? (
                      <p className="text-gray-500 mt-2">
                        Your reservation is held. Pay your deposit
                        {depositDue ? ` of ${currency(depositDue)}` : ""} now to
                        confirm your cabin — you can also pay later from the
                        link we emailed you.
                      </p>
                    ) : (
                      <p className="text-gray-500 mt-2">
                        Your travel advisor will reach out shortly to finalize
                        the details.
                      </p>
                    )}
                  </div>
                  {payUrl && (
                    <Button
                      className="w-full text-white"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => window.open(payUrl, "_blank", "noopener")}
                    >
                      Pay Deposit
                      {depositDue ? ` — ${currency(depositDue)}` : ""}
                    </Button>
                  )}
                  {reservationUrl && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(reservationUrl, "_blank", "noopener")}
                    >
                      View My Reservation
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSignupForm(false);
                      setSubmitted(false);
                      setPayUrl(null);
                      setReservationUrl(null);
                      setDepositDue(0);
                    }}
                  >
                    Close
                  </Button>
                </div>
              ) : (

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">First Name *</Label>
                      <Input
                        required
                        maxLength={100}
                        value={form.first_name}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            first_name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Last Name</Label>
                      <Input
                        maxLength={100}
                        value={form.last_name}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            last_name: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Email *</Label>
                    <Input
                      type="email"
                      required
                      maxLength={255}
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Phone</Label>
                    <Input
                      type="tel"
                      maxLength={20}
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Occupancy</Label>
                    <div className="flex gap-2">
                      {["1", "2"].map((val) => {
                        const doubleRequired = !!data.cabinOptions?.find(
                          (c) => c.id === form.selected_cabin_option_id
                        )?.requires_double_occupancy;
                        const disabled = val === "1" && doubleRequired;
                        return (
                        <button
                          key={val}
                          type="button"
                          disabled={disabled}
                          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            form.number_of_travelers === val
                              ? "border-2 shadow-sm"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                          style={
                            form.number_of_travelers === val
                              ? { borderColor: primaryColor, color: primaryColor, backgroundColor: `${primaryColor}08` }
                              : {}
                          }
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              number_of_travelers: val,
                              ...(val === "1" ? { companion_first_name: "", companion_last_name: "", companion_email: "", companion_phone: "" } : {}),
                            }))
                          }
                        >
                          {val === "1" ? "1 Traveler" : "2 Travelers"}
                        </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Second Traveler Info */}
                  {form.number_of_travelers === "2" && (
                    <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-sm font-semibold text-gray-700">Second Traveler</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">First Name *</Label>
                          <Input
                            required
                            maxLength={100}
                            value={form.companion_first_name}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, companion_first_name: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Last Name</Label>
                          <Input
                            maxLength={100}
                            value={form.companion_last_name}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, companion_last_name: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          maxLength={255}
                          value={form.companion_email}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, companion_email: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          type="tel"
                          maxLength={20}
                          value={form.companion_phone}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, companion_phone: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Departure location — city and state dropdowns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">State *</Label>
                      <select
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.departure_state}
                        onChange={(e) => {
                          const state = e.target.value;
                          setForm((f) => ({ ...f, departure_state: state, departure_city: "" }));
                        }}
                      >
                        <option value="">Select state</option>
                        {Object.keys(US_CITIES).sort().map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">City *</Label>
                      <select
                        required
                        disabled={!form.departure_state}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        value={form.departure_city}
                        onChange={(e) => setForm((f) => ({ ...f, departure_city: e.target.value }))}
                      >
                        <option value="">{form.departure_state ? "Select city" : "Choose state first"}</option>
                        {form.departure_state &&
                          US_CITIES[form.departure_state]?.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  {form.departure_city === "Other" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Your city</Label>
                      <Input
                        maxLength={100}
                        placeholder="Enter your city"
                        value=""
                        onChange={(e) => setForm((f) => ({ ...f, departure_city: e.target.value || "Other" }))}
                      />
                    </div>
                  )}


                  {/* Cabin Selection */}
                  {data.cabinOptions && data.cabinOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Cabin / Category *</Label>
                      <select
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.selected_cabin_option_id}
                        onChange={(e) => {
                          const id = e.target.value;
                          const opt = data.cabinOptions.find((c) => c.id === id);
                          setForm((f) => ({
                            ...f,
                            selected_cabin_option_id: id,
                            number_of_travelers: opt?.requires_double_occupancy ? "2" : f.number_of_travelers,
                          }));
                        }}
                      >
                        <option value="">Select a cabin type...</option>
                        {data.cabinOptions.map((cabin) => (
                          <option key={cabin.id} value={cabin.id}>
                            {cabin.category_name} — ${cabin.price_per_person.toLocaleString()}/{cabin.price_period === "cabin" ? "cabin" : "person"}{cabin.price_period === 'night' ? ' / night' : ''}{cabin.requires_double_occupancy ? ' (2 travelers min)' : ''}
                          </option>
                        ))}
                      </select>
                      {data.cabinOptions.find((c) => c.id === form.selected_cabin_option_id)?.requires_double_occupancy && (
                        <p className="text-xs text-amber-600">
                          This category requires 2 travelers (double occupancy).
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-sm">Notes or Questions</Label>
                    <Textarea
                      maxLength={500}
                      rows={3}
                      placeholder="Any questions or special requests..."
                      value={form.notes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                      }
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full text-base py-5 rounded-xl font-semibold"
                    style={{
                      backgroundColor: primaryColor,
                      color: "white",
                    }}
                  >
                    {submitting ? (
                      "Signing up..."
                    ) : (
                      <>
                        {signupButtonLabel}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-400">
                      No payment required. Your advisor will contact you.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSignupForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Footer ───────────────────────────────── */}
      {data.branding && (
        <div className="border-t bg-gray-50/80 py-10">
          <div className="max-w-6xl mx-auto px-6 text-center space-y-3">
            {data.branding.logo_url && (
              <img
                src={data.branding.logo_url}
                alt={data.branding.agency_name || "Agency"}
                className="h-9 mx-auto"
              />
            )}
            <p className="text-sm text-gray-500">
              {data.branding.agency_name}
              {data.branding.tagline && ` — ${data.branding.tagline}`}
            </p>
            {data.branding.website && (
              <a
                href={data.branding.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-gray-600 inline-block"
              >
                {data.branding.website}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
