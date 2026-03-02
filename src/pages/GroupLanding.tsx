import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { format } from "date-fns";

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
      <div className="min-h-screen bg-white">
        <Skeleton className="h-[350px] w-full" />
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
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
            <p className="text-lg font-medium text-gray-500">
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
  const signupButtonLabel = content.signup_button_label || "Join Us";
  const ctaEnabled = content.cta_enabled || false;
  const ctaButtonLabel = content.cta_button_label || "Learn More";
  const ctaLink = content.cta_link || "";

  const headline = data.trip.group_landing_headline || data.trip.trip_name;
  const descriptionHtml = data.trip.group_landing_description || null;
  const descriptionPlain = data.trip.notes || null;

  return (
    <div className="min-h-screen bg-white">
      {/* Clean Hero Banner — no text overlay */}
      {data.trip.cover_image_url && (
        <div className="w-full max-w-5xl mx-auto px-6 pt-8">
          <div className="rounded-xl overflow-hidden">
            <img
              src={data.trip.cover_image_url}
              alt={headline}
              className="w-full h-[300px] md:h-[380px] object-cover"
            />
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Two-column: Content left, Advisor right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 items-start">
          {/* ─── LEFT COLUMN: Content ─────────────── */}
          <div className="space-y-8">
            {/* Title + Dates */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                {headline}
              </h1>
              {(data.trip.depart_date || data.trip.return_date) && (
                <p className="text-gray-500 mt-2 text-lg">
                  {data.trip.depart_date &&
                    format(new Date(data.trip.depart_date), "MMM d")}
                  {data.trip.return_date &&
                    ` - ${format(new Date(data.trip.return_date), "d, yyyy")}`}
                </p>
              )}
            </div>

            {/* Description / Overview */}
            {descriptionHtml ? (
              <div
                className="text-gray-700 leading-relaxed text-[15px] prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            ) : descriptionPlain ? (
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-[15px]">
                {descriptionPlain}
              </p>
            ) : null}

            {/* Separator */}
            {(descriptionHtml || descriptionPlain) && (
              <hr className="border-gray-200" />
            )}

            {/* Itinerary Highlights */}
            {data.itineraryHighlights.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Itinerary
                </h2>
                <div className="space-y-4">
                  {data.itineraryHighlights.map((item, i) => {
                    const Icon = categoryIcons[item.category] || Camera;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50"
                      >
                        <div
                          className="p-2 rounded-lg shrink-0"
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          <Icon
                            className="h-5 w-5"
                            style={{ color: primaryColor }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {item.title}
                            </span>
                            <span className="text-xs text-gray-400">
                              Day {item.day_number}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {item.description}
                            </p>
                          )}
                          {item.location && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {item.location}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Feature Images Gallery */}
            {featureImages.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Gallery
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {featureImages.map((img) => (
                    <div key={img.id} className="rounded-xl overflow-hidden">
                      <img
                        src={img.url}
                        alt={img.caption || "Trip photo"}
                        className="w-full h-40 object-cover"
                        loading="lazy"
                      />
                      {img.caption && (
                        <p className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50">
                          {img.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Sections — collapsible like Tern */}
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
          <div className="lg:sticky lg:top-8">
            {/* Advisor Card */}
            {data.advisor && (
              <Card className="overflow-hidden shadow-lg border-0">
                {/* Advisor avatar + branding banner */}
                <div
                  className="relative h-28"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                  }}
                >
                  {data.branding?.logo_url && (
                    <img
                      src={data.branding.logo_url}
                      alt={data.branding.agency_name || "Agency"}
                      className="absolute top-3 right-3 h-12 brightness-0 invert opacity-80"
                    />
                  )}
                  {data.branding?.tagline && (
                    <p className="absolute bottom-3 right-3 text-xs text-white/70 italic">
                      {data.branding.tagline}
                    </p>
                  )}
                </div>

                {/* Avatar overlapping the banner */}
                <div className="relative px-5">
                  <div className="-mt-10 mb-3">
                    {data.advisor.avatar_url ? (
                      <img
                        src={data.advisor.avatar_url}
                        alt={data.advisor.name || "Advisor"}
                        className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-md"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(data.advisor.name || "A").charAt(0)}
                      </div>
                    )}
                  </div>
                </div>

                <CardContent className="px-5 pb-5 pt-0 space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                      Your Advisor
                    </p>
                    <p className="font-bold text-gray-900 text-lg">
                      {data.advisor.name}
                    </p>
                    {data.advisor.agency_name && (
                      <p className="text-sm text-gray-600">
                        {data.advisor.agency_name}
                      </p>
                    )}
                  </div>

                  {/* Credentials */}
                  {(data.advisor.clia_number ||
                    data.advisor.ccra_number ||
                    data.advisor.asta_number ||
                    data.advisor.embarc_number) && (
                    <div className="text-xs text-gray-500 space-y-0.5">
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

                  {/* Contact */}
                  <div className="space-y-1.5 text-sm">
                    {data.branding?.email_address && (
                      <a
                        href={`mailto:${data.branding.email_address}`}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {data.branding.email_address}
                        </span>
                      </a>
                    )}
                    {data.advisor.phone && (
                      <a
                        href={`tel:${data.advisor.phone}`}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {data.advisor.phone}
                      </a>
                    )}
                  </div>

                  {/* Agency logo small */}
                  {data.branding?.logo_url && (
                    <div className="flex justify-end pt-1">
                      <img
                        src={data.branding.logo_url}
                        alt={data.branding.agency_name || "Agency"}
                        className="h-10 object-contain"
                      />
                    </div>
                  )}

                  {/* Join Us / Signup CTA */}
                  {signupEnabled && (
                    <Button
                      className="w-full text-base py-5 mt-2"
                      style={{ backgroundColor: primaryColor, color: "white" }}
                      onClick={() => setShowSignupForm(true)}
                    >
                      {signupButtonLabel}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* If no advisor but signup enabled, still show CTA */}
            {!data.advisor && signupEnabled && (
              <Card className="shadow-lg border-0 overflow-hidden">
                <div
                  className="p-5 text-white"
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
                    className="w-full text-base py-5"
                    style={{ backgroundColor: primaryColor, color: "white" }}
                    onClick={() => setShowSignupForm(true)}
                  >
                    {signupButtonLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* ─── Mobile sticky CTA ──────────────────── */}
        {signupEnabled && !showSignupForm && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-50">
            <Button
              className="w-full text-base py-5"
              style={{ backgroundColor: primaryColor, color: "white" }}
              onClick={() => setShowSignupForm(true)}
            >
              {signupButtonLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ─── Signup Form Modal ────────────────────── */}
      {showSignupForm && signupEnabled && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
            <div
              className="p-5 text-white"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
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
            <CardContent className="p-5">
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
                    <Label className="text-sm">Number of Travelers</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={form.number_of_travelers}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          number_of_travelers: e.target.value,
                        }))
                      }
                    />
                  </div>

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
                    className="w-full text-base py-5"
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

      {/* Footer */}
      {data.branding && (
        <div className="border-t bg-gray-50 py-8">
          <div className="max-w-5xl mx-auto px-6 text-center">
            {data.branding.logo_url && (
              <img
                src={data.branding.logo_url}
                alt={data.branding.agency_name || "Agency"}
                className="h-8 mx-auto mb-3"
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
                className="text-sm text-gray-400 hover:text-gray-600 mt-1 inline-block"
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
