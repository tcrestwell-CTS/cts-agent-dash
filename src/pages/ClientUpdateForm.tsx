import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PassportScanButton, { type ParsedPassport } from "@/components/passport/PassportScanButton";

type ClientInfo = Record<string, string | null>;
type Branding = {
  agency_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
};

interface CompanionData {
  id?: string;
  first_name: string;
  last_name: string;
  relationship: string;
  birthday: string;
  email: string;
  phone: string;
  passport_info: string;
  known_traveler_number: string;
  redress_number: string;
}

const EMPTY_COMPANION: CompanionData = {
  first_name: "",
  last_name: "",
  relationship: "spouse",
  birthday: "",
  email: "",
  phone: "",
  passport_info: "",
  known_traveler_number: "",
  redress_number: "",
};

const RELATIONSHIP_OPTIONS = [
  "spouse",
  "partner",
  "child",
  "parent",
  "sibling",
  "friend",
  "other",
];

const FIELDS = [
  { section: "Personal Information", fields: [
    { key: "first_name", label: "First Name", type: "text" },
    { key: "last_name", label: "Last Name", type: "text" },
    { key: "preferred_first_name", label: "Preferred First Name", type: "text" },
    { key: "birthday", label: "Birthday", type: "date" },
    { key: "anniversary", label: "Anniversary", type: "date" },
  ]},
  { section: "Contact", fields: [
    { key: "email", label: "Email", type: "email" },
    { key: "secondary_email", label: "Secondary Email", type: "email" },
    { key: "phone", label: "Phone", type: "tel" },
    { key: "secondary_phone", label: "Secondary Phone", type: "tel" },
  ]},
  { section: "Address", fields: [
    { key: "address_line_1", label: "Address Line 1", type: "text" },
    { key: "address_line_2", label: "Address Line 2", type: "text" },
    { key: "address_city", label: "City", type: "text" },
    { key: "address_state", label: "State / Province", type: "text" },
    { key: "address_zip_code", label: "ZIP / Postal Code", type: "text" },
    { key: "address_country", label: "Country", type: "text" },
  ]},
  { section: "Travel Documents", fields: [
    { key: "known_traveler_number", label: "Known Traveler Number", type: "text" },
    { key: "redress_number", label: "Redress Number", type: "text" },
    { key: "passport_full_name", label: "Name as printed on passport", type: "text" },
    { key: "passport_number", label: "Passport Number", type: "text" },
    { key: "passport_nationality", label: "Nationality", type: "text" },
    { key: "passport_issuing_country", label: "Issuing Country", type: "text" },
    { key: "passport_date_of_birth", label: "Date of Birth (passport)", type: "date" },
    { key: "passport_expiry", label: "Passport Expiration Date", type: "date" },
    { key: "passport_sex", label: "Sex", type: "text" },
    { key: "passport_info", label: "Passport Info", type: "textarea" },
  ]},
  { section: "Preferences", fields: [
    { key: "food_drink_allergies", label: "Food & Drink Allergies", type: "textarea" },
    { key: "activities_interests", label: "Activities & Interests", type: "textarea" },
    { key: "loyalty_programs", label: "Loyalty Programs", type: "textarea" },
  ]},
];

const ClientUpdateForm = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<ClientInfo>({});
  const [hasCompanions, setHasCompanions] = useState(false);
  const [companions, setCompanions] = useState<CompanionData[]>([]);
  const [branding, setBranding] = useState<Branding>({
    agency_name: "Crestwell Travel Services",
    logo_url: "",
    primary_color: "#1e3a5f",
    accent_color: "#e8782a",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ action: "get-client-info", token }),
          }
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Invalid or expired link");
        }
        const data = await res.json();
        setFormData(data.client);
        setBranding(data.branding);
        if (data.companions && data.companions.length > 0) {
          setHasCompanions(true);
          setCompanions(data.companions);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "submit-update",
            token,
            updates: formData,
            companions: hasCompanions ? companions : [],
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const applyParsedPassport = (parsed: ParsedPassport) => {
    setFormData((prev) => ({
      ...prev,
      first_name: prev.first_name || parsed.first_name || "",
      last_name: prev.last_name || parsed.last_name || "",
      passport_full_name: parsed.passport_full_name ?? prev.passport_full_name ?? "",
      passport_number: parsed.passport_number ?? prev.passport_number ?? "",
      passport_nationality: parsed.passport_nationality ?? prev.passport_nationality ?? "",
      passport_issuing_country:
        parsed.passport_issuing_country ?? prev.passport_issuing_country ?? "",
      passport_date_of_birth:
        parsed.passport_date_of_birth ?? prev.passport_date_of_birth ?? "",
      passport_expiry: parsed.passport_expiry ?? prev.passport_expiry ?? "",
      passport_sex: parsed.passport_sex ?? prev.passport_sex ?? "",
      birthday: prev.birthday || parsed.passport_date_of_birth || "",
    }));
  };

  const addCompanion = () => {
    setCompanions((prev) => [...prev, { ...EMPTY_COMPANION }]);
  };

  const removeCompanion = (index: number) => {
    setCompanions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCompanion = (index: number, field: keyof CompanionData, value: string) => {
    setCompanions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Link Unavailable</h2>
            <p className="text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <CheckCircle2 className="h-12 w-12" style={{ color: branding.primary_color }} />
            <h2 className="text-xl font-semibold text-foreground">Information Updated!</h2>
            <p className="text-muted-foreground text-center">
              Thank you for updating your contact details. Your travel advisor has been notified.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div
        className="py-8 px-4"
        style={{ background: `linear-gradient(135deg, ${branding.primary_color}, ${branding.primary_color}dd)` }}
      >
        <div className="max-w-2xl mx-auto text-center">
          {branding.logo_url && (
            <img
              src={branding.logo_url}
              alt={branding.agency_name}
              className="h-12 mx-auto mb-3 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-white">{branding.agency_name}</h1>
          <p className="text-white/80 mt-1 text-sm">Update Your Contact Information</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-6 pb-12">
        <p className="text-muted-foreground text-sm">
          Please review and update any fields below. When finished, click <strong>Save Changes</strong> at the bottom.
        </p>

        {FIELDS.map((section) => (
          <Card key={section.section}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{section.section}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {section.section === "Travel Documents" && (
                <div className="sm:col-span-2">
                  <PassportScanButton updateToken={token} onParsed={applyParsedPassport} />
                </div>
              )}
              {section.fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "sm:col-span-2" : ""}
                >
                  <Label htmlFor={field.key} className="text-sm">
                    {field.label}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.key}
                      value={formData[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type}
                      value={formData[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Travel Companions Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Travel Companions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="has_companions"
                checked={hasCompanions}
                onCheckedChange={(checked) => {
                  setHasCompanions(!!checked);
                  if (checked && companions.length === 0) {
                    addCompanion();
                  }
                }}
              />
              <Label htmlFor="has_companions" className="text-sm cursor-pointer">
                I have travel companions to add or update
              </Label>
            </div>

            {hasCompanions && (
              <div className="space-y-6 mt-4">
                {companions.map((companion, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg p-4 space-y-4 relative"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">
                        Companion {index + 1}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCompanion(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove companion ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-sm">First Name *</Label>
                        <Input
                          value={companion.first_name}
                          onChange={(e) => updateCompanion(index, "first_name", e.target.value)}
                          className="mt-1"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Last Name</Label>
                        <Input
                          value={companion.last_name}
                          onChange={(e) => updateCompanion(index, "last_name", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Relationship *</Label>
                        <Select
                          value={companion.relationship}
                          onValueChange={(val) => updateCompanion(index, "relationship", val)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATIONSHIP_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Birthday</Label>
                        <Input
                          type="date"
                          value={companion.birthday}
                          onChange={(e) => updateCompanion(index, "birthday", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Email</Label>
                        <Input
                          type="email"
                          value={companion.email}
                          onChange={(e) => updateCompanion(index, "email", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Phone</Label>
                        <Input
                          value={companion.phone}
                          onChange={(e) => updateCompanion(index, "phone", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Known Traveler Number</Label>
                        <Input
                          value={companion.known_traveler_number}
                          onChange={(e) => updateCompanion(index, "known_traveler_number", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Redress Number</Label>
                        <Input
                          value={companion.redress_number}
                          onChange={(e) => updateCompanion(index, "redress_number", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-sm">Passport Info</Label>
                        <Textarea
                          value={companion.passport_info}
                          onChange={(e) => updateCompanion(index, "passport_info", e.target.value)}
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addCompanion}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Companion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full text-white font-semibold py-6"
          style={{ backgroundColor: branding.primary_color }}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
};

export default ClientUpdateForm;
