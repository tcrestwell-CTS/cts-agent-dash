import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  Plane,
  Hotel,
  Utensils,
  Camera,
  ArrowRight,
  Phone,
  Mail,
  ExternalLink,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Skeleton className="h-[50vh] w-full" />
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
  const signupButtonLabel = content.signup_button_label || "Sign Up Now";
  const ctaEnabled = content.cta_enabled || false;
  const ctaButtonLabel = content.cta_button_label || "Learn More";
  const ctaLink = content.cta_link || "";

  // Use builder headline if set, otherwise trip name
  const headline = data.trip.group_landing_headline || data.trip.trip_name;
  // Use builder rich description if set, otherwise trip notes
  const descriptionHtml = data.trip.group_landing_description || null;
  const descriptionPlain = data.trip.notes || null;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative w-full min-h-[55vh] overflow-hidden flex items-end">
        {data.trip.cover_image_url ? (
          <img
            src={data.trip.cover_image_url}
            alt={headline}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-12 pt-20">
          {data.branding?.logo_url && (
            <img
              src={data.branding.logo_url}
              alt={data.branding.agency_name || "Agency"}
              className="h-10 mb-6 brightness-0 invert"
            />
          )}
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg leading-tight">
            {headline}
          </h1>
          <div className="flex flex-wrap items-center gap-5 mt-4 text-white/90">
            {data.trip.destination && (
              <span className="flex items-center gap-1.5 text-lg">
                <MapPin className="h-5 w-5" />
                {data.trip.destination}
              </span>
            )}
            {data.trip.depart_date && (
              <span className="flex items-center gap-1.5 text-lg">
                <Calendar className="h-5 w-5" />
                {format(new Date(data.trip.depart_date), "MMM d, yyyy")}
                {data.trip.return_date &&
                  ` – ${format(new Date(data.trip.return_date), "MMM d, yyyy")}`}
              </span>
            )}
            {data.signupCount > 0 && (
              <span className="flex items-center gap-1.5 text-lg">
                <Users className="h-5 w-5" />
                {data.signupCount} signed up
              </span>
            )}
          </div>
          {data.trip.budget_range && (
            <Badge
              className="mt-4 text-sm px-3 py-1"
              style={{ backgroundColor: accentColor, color: "white", border: "none" }}
            >
              Starting from {data.trip.budget_range}
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-10">
            {/* Overview — rich HTML from builder, or plain text fallback */}
            {descriptionHtml ? (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  About This Trip
                </h2>
                <div
                  className="text-gray-600 leading-relaxed text-lg prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              </div>
            ) : descriptionPlain ? (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  About This Trip
                </h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-lg">
                  {descriptionPlain}
                </p>
              </div>
            ) : null}

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

            {/* Itinerary Highlights */}
            {data.itineraryHighlights.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  What's Included
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

            {/* Additional Sections from Builder */}
            {additionalSections.map((section) => (
              <div key={section.id}>
                {section.title && (
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {section.title}
                  </h2>
                )}
                {section.content && (
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap text-lg">
                    {section.content}
                  </p>
                )}
              </div>
            ))}

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

            {/* Advisor Card */}
            {data.advisor && (
              <Card className="overflow-hidden">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Your Travel Advisor
                  </h3>
                  <div className="flex items-center gap-4">
                    {data.advisor.avatar_url ? (
                      <img
                        src={data.advisor.avatar_url}
                        alt={data.advisor.name || "Advisor"}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {(data.advisor.name || "A").charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {data.advisor.name}
                      </p>
                      {data.advisor.job_title && (
                        <p className="text-sm text-gray-500">
                          {data.advisor.job_title}
                        </p>
                      )}
                      {data.advisor.agency_name && (
                        <p className="text-sm text-gray-500">
                          {data.advisor.agency_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {data.advisor.phone && (
                      <a
                        href={`tel:${data.advisor.phone}`}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <Phone className="h-4 w-4" /> {data.advisor.phone}
                      </a>
                    )}
                    {data.branding?.email_address && (
                      <a
                        href={`mailto:${data.branding.email_address}`}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <Mail className="h-4 w-4" /> {data.branding.email_address}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Signup Form (Sticky Sidebar) */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8">
              {signupEnabled && (
                <Card className="shadow-xl border-0 overflow-hidden">
                  <div
                    className="p-6 text-white"
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
                  <CardContent className="p-6">
                    {submitted ? (
                      <div className="text-center py-6 space-y-4">
                        <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                        <div>
                          <p className="text-lg font-semibold text-gray-900">
                            Thank you, {form.first_name}!
                          </p>
                          <p className="text-gray-500 mt-2">
                            Your travel advisor will reach out shortly to finalize
                            the details.
                          </p>
                        </div>
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

                        <p className="text-xs text-gray-400 text-center">
                          No payment required. Your advisor will contact you to
                          finalize.
                        </p>
                      </form>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

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
