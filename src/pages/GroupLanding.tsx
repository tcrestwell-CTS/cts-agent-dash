import { useEffect, useState } from "react";
import crestwellLogo from "@/assets/CTN-Logo.png";
import { useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
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
  Globe,
  Anchor,
  Compass,
  Users,
  BedDouble,
} from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

interface FeatureImage {
  id: string;
  url: string;
  caption?: string;
}

interface AdditionalSection {
  id: string;
  title: string;
  content: string;
}

interface LandingContent {
  feature_images?: FeatureImage[];
  additional_sections?: AdditionalSection[];
  signup_button_label?: string;
  signup_enabled?: boolean;
  cta_enabled?: boolean;
  cta_button_label?: string;
  cta_link?: string;
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
}

interface GroupLandingData {
  trip: {
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
  }[];
}

const categoryIcons: Record<string, typeof Plane> = {
  flight: Plane,
  hotel: Hotel,
  dining: Utensils,
  activity: Camera,
  cruise: Anchor,
  transport: Compass,
};

export default function GroupLanding() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<GroupLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    number_of_travelers: "1",
    notes: "",
    selected_cabin_option_id: "",
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
          body: JSON.stringify({ token, ...form }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Signup failed.");
        return;
      }
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

  const primaryColor = data.branding?.primary_color || "#1a365d";
  const accentColor = data.branding?.accent_color || "#d97706";
  const content = data.trip.group_landing_content || {};
  const featureImages = content.feature_images || [];
  const additionalSections = content.additional_sections || [];
  const signupEnabled = content.signup_enabled !== false;
  const signupButtonLabel = content.signup_button_label || "Join This Trip";
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

  // Group itinerary items by day
  const itineraryByDay = data.itineraryHighlights.reduce<
    Record<number, typeof data.itineraryHighlights>
  >((acc, item) => {
    if (!acc[item.day_number]) acc[item.day_number] = [];
    acc[item.day_number].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO SECTION ─────────────────────────── */}
      <div className="relative w-full">
        {data.trip.cover_image_url ? (
          <>
            <div className="w-full h-[380px] md:h-[480px] relative overflow-hidden">
              <img
                src={data.trip.cover_image_url}
                alt={headline}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              <div className="max-w-6xl mx-auto">
                  <img
                    src={crestwellLogo}
                    alt={data.branding?.agency_name || "Crestwell Travel Services"}
                    className="h-16 mb-4 object-contain drop-shadow-lg"
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
                    src={crestwellLogo}
                    alt={data.branding?.agency_name || "Crestwell Travel Services"}
                    className="h-16 mb-4 object-contain drop-shadow-lg"
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
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12 items-start">
          {/* ─── LEFT COLUMN ──────────────────────── */}
          <div className="space-y-10">
            {/* Overview */}
            {descriptionHtml ? (
              <div
                className="text-gray-700 leading-relaxed prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            ) : descriptionPlain ? (
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-[15px]">
                {descriptionPlain}
              </p>
            ) : null}

            {/* ─── ITINERARY & CABINS TABS ──────── */}
            {(Object.keys(itineraryByDay).length > 0 || (data.cabinOptions && data.cabinOptions.length > 0)) && (
              <Tabs defaultValue={Object.keys(itineraryByDay).length > 0 ? "itinerary" : "cabins"} className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-12 rounded-xl bg-gray-100">
                  {Object.keys(itineraryByDay).length > 0 && (
                    <TabsTrigger value="itinerary" className="rounded-lg text-sm font-semibold data-[state=active]:shadow-sm">
                      <Compass className="h-4 w-4 mr-2" />
                      Trip Itinerary
                    </TabsTrigger>
                  )}
                  {data.cabinOptions && data.cabinOptions.length > 0 && (
                    <TabsTrigger value="cabins" className="rounded-lg text-sm font-semibold data-[state=active]:shadow-sm">
                      <BedDouble className="h-4 w-4 mr-2" />
                      Cabin Selections
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* ─── ITINERARY TAB ──────────────── */}
                {Object.keys(itineraryByDay).length > 0 && (
                  <TabsContent value="itinerary" className="mt-6">
                    <div className="relative">
                      {/* Timeline line */}
                      <div
                        className="absolute left-[18px] top-6 bottom-6 w-[2px] hidden md:block"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      />

                      <div className="space-y-6">
                        {Object.entries(itineraryByDay)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([day, items]) => (
                            <div key={day} className="relative">
                              <div className="flex items-start gap-4">
                                <div
                                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md z-10"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  {day}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                                    style={{ color: primaryColor }}
                                  >
                                    Day {day}
                                  </p>
                                  <div className="space-y-2">
                                    {items.map((item, i) => {
                                      const Icon = categoryIcons[item.category] || Camera;
                                      return (
                                        <div
                                          key={i}
                                          className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
                                        >
                                          <div
                                            className="p-1.5 rounded-lg shrink-0 mt-0.5"
                                            style={{ backgroundColor: `${primaryColor}10` }}
                                          >
                                            <Icon className="h-4 w-4" style={{ color: primaryColor }} />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 text-[15px]">
                                              {item.title}
                                            </p>
                                            {item.description && (
                                              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                                {item.description}
                                              </p>
                                            )}
                                            {item.location && (
                                              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {item.location}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </TabsContent>
                )}

                {/* ─── CABIN SELECTIONS TAB ────────── */}
                {data.cabinOptions && data.cabinOptions.length > 0 && (
                  <TabsContent value="cabins" className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {data.cabinOptions.map((cabin) => (
                        <div
                          key={cabin.id}
                          className="rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                        >
                          {cabin.image_url && (
                            <img
                              src={cabin.image_url}
                              alt={cabin.category_name}
                              className="w-full h-36 object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-900">{cabin.category_name}</h3>
                              <span
                                className="text-lg font-bold"
                                style={{ color: primaryColor }}
                              >
                                ${cabin.price_per_person.toLocaleString()}
                                <span className="text-xs font-normal text-gray-500">/person</span>
                              </span>
                            </div>
                            {cabin.description && (
                              <p className="text-sm text-gray-500">{cabin.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              {cabin.deposit_amount > 0 && (
                                <span>${cabin.deposit_amount.toLocaleString()} deposit</span>
                              )}
                              {cabin.capacity && (
                                <span>Max {cabin.capacity} travelers</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
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
                      className={`rounded-xl overflow-hidden group ${
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

            {/* ─── ADDITIONAL SECTIONS (accordion) ── */}
            {additionalSections.length > 0 && (
              <div className="space-y-3">
                {additionalSections.map((section) => {
                  const isExpanded = expandedSections[section.id] ?? false;
                  return (
                    <div
                      key={section.id}
                      className="border border-gray-200 rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <h3 className="text-lg font-semibold text-gray-900">
                          {section.title || "Details"}
                        </h3>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
                        )}
                      </button>
                      {isExpanded && section.content && (
                        <div className="px-4 pb-4 text-gray-600 leading-relaxed whitespace-pre-wrap text-[15px]">
                          {section.content}
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
          <div className="lg:sticky lg:top-8 space-y-5">
            {/* Advisor Card */}
            {data.advisor && (
              <Card className="overflow-hidden shadow-xl border-0 rounded-2xl">
                {/* Banner */}
                <div
                  className="relative h-24"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}bb)`,
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
                      onClick={() => setShowSignupForm(true)}
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
                    onClick={() => setShowSignupForm(true)}
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
              onClick={() => setShowSignupForm(true)}
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
          <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden rounded-2xl">
            <div
              className="p-6 text-white"
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
            <CardContent className="p-6">
              {submitted ? (
                <div className="text-center py-6 space-y-4">
                  <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      Thank you, {form.first_name}!
                    </p>
                    <p className="text-gray-500 mt-2">
                      Your travel advisor will reach out shortly to finalize the
                      details.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSignupForm(false);
                      setSubmitted(false);
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
                      {["1", "2"].map((val) => (
                        <button
                          key={val}
                          type="button"
                          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                            form.number_of_travelers === val
                              ? "border-2 shadow-sm"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
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
                      ))}
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

                  {/* Cabin Selection */}
                  {data.cabinOptions && data.cabinOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Cabin / Category *</Label>
                      <select
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.selected_cabin_option_id}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, selected_cabin_option_id: e.target.value }))
                        }
                      >
                        <option value="">Select a cabin type...</option>
                        {data.cabinOptions.map((cabin) => (
                          <option key={cabin.id} value={cabin.id}>
                            {cabin.category_name} — ${cabin.price_per_person.toLocaleString()}/person
                          </option>
                        ))}
                      </select>
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
