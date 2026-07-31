import { useEffect, useState } from "react";
import { usePortalProfile, useUpdatePortalProfile } from "@/hooks/usePortalData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import PassportScanButton, { type ParsedPassport } from "@/components/passport/PassportScanButton";
import { supabase } from "@/integrations/supabase/client";

const FIELDS = [
  "first_name", "last_name", "preferred_first_name",
  "phone", "secondary_phone", "secondary_email",
  "birthday",
  "address_line_1", "address_line_2", "address_city",
  "address_state", "address_zip_code", "address_country",
  "passport_info", "known_traveler_number", "redress_number",
  "passport_number", "passport_full_name", "passport_nationality",
  "passport_issuing_country", "passport_date_of_birth", "passport_sex",
  "passport_expiry",
  "food_drink_allergies", "activities_interests",
  "flight_seating_preference", "flight_bulkhead_preference",
  "lodging_floor_preference", "lodging_elevator_preference",
  "cruise_cabin_floor_preference", "cruise_cabin_location_preference",
  "loyalty_programs",
] as const;

type FormState = Partial<Record<(typeof FIELDS)[number], string>>;

function Field({ id, label, value, onChange, type = "text", placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default function PortalProfile() {
  const { data, isLoading } = usePortalProfile();
  const update = useUpdatePortalProfile();
  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    const next: FormState = {};
    for (const k of FIELDS) next[k] = (p as any)[k] ?? "";
    setForm(next);
  }, [data]);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const getPortalHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { authorization: `Bearer ${session.access_token}` };
    }
    try {
      const stored = localStorage.getItem("portal_session");
      const token = stored ? JSON.parse(stored).token : null;
      if (token) return { "x-portal-token": token };
    } catch {}
    return {};
  };

  const applyParsedPassport = (parsed: ParsedPassport) => {
    setForm((f) => ({
      ...f,
      first_name: f.first_name || parsed.first_name || "",
      last_name: f.last_name || parsed.last_name || "",
      passport_full_name: parsed.passport_full_name ?? f.passport_full_name ?? "",
      passport_number: parsed.passport_number ?? f.passport_number ?? "",
      passport_nationality: parsed.passport_nationality ?? f.passport_nationality ?? "",
      passport_issuing_country:
        parsed.passport_issuing_country ?? f.passport_issuing_country ?? "",
      passport_date_of_birth:
        parsed.passport_date_of_birth ?? f.passport_date_of_birth ?? "",
      passport_expiry: parsed.passport_expiry ?? f.passport_expiry ?? "",
      passport_sex: parsed.passport_sex ?? f.passport_sex ?? "",
      birthday: f.birthday || parsed.passport_date_of_birth || "",
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Keep your personal details up to date. Your travel advisor uses this information for bookings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Email is managed through your sign-in account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="first_name" label="First Name" value={form.first_name ?? ""} onChange={set("first_name")} />
          <Field id="last_name"  label="Last Name"  value={form.last_name ?? ""}  onChange={set("last_name")} />
          <Field id="preferred_first_name" label="Preferred First Name" value={form.preferred_first_name ?? ""} onChange={set("preferred_first_name")} />
          <Field id="birthday" label="Birthday" type="date" value={form.birthday ?? ""} onChange={set("birthday")} />
          {data?.profile?.email && (
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={data.profile.email} disabled />
            </div>
          )}
          <Field id="phone" label="Phone" value={form.phone ?? ""} onChange={set("phone")} />
          <Field id="secondary_email" label="Secondary Email" type="email" value={form.secondary_email ?? ""} onChange={set("secondary_email")} />
          <Field id="secondary_phone" label="Secondary Phone" value={form.secondary_phone ?? ""} onChange={set("secondary_phone")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Address</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="address_line_1" label="Address Line 1" value={form.address_line_1 ?? ""} onChange={set("address_line_1")} />
          <Field id="address_line_2" label="Address Line 2" value={form.address_line_2 ?? ""} onChange={set("address_line_2")} />
          <Field id="address_city" label="City" value={form.address_city ?? ""} onChange={set("address_city")} />
          <Field id="address_state" label="State / Region" value={form.address_state ?? ""} onChange={set("address_state")} />
          <Field id="address_zip_code" label="Zip / Postal Code" value={form.address_zip_code ?? ""} onChange={set("address_zip_code")} />
          <Field id="address_country" label="Country" value={form.address_country ?? ""} onChange={set("address_country")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Travel Documents</CardTitle>
          <CardDescription>Used to issue flights and complete bookings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PassportScanButton getHeaders={getPortalHeaders} onParsed={applyParsedPassport} />
          </div>
          <Field id="passport_full_name" label="Name as printed on passport" value={form.passport_full_name ?? ""} onChange={set("passport_full_name")} />
          <Field id="passport_number" label="Passport Number" value={form.passport_number ?? ""} onChange={set("passport_number")} />
          <Field id="passport_nationality" label="Nationality" value={form.passport_nationality ?? ""} onChange={set("passport_nationality")} />
          <Field id="passport_issuing_country" label="Issuing Country" value={form.passport_issuing_country ?? ""} onChange={set("passport_issuing_country")} />
          <Field id="passport_date_of_birth" label="Date of Birth (passport)" type="date" value={form.passport_date_of_birth ?? ""} onChange={set("passport_date_of_birth")} />
          <Field id="passport_expiry" label="Expiration Date" type="date" value={form.passport_expiry ?? ""} onChange={set("passport_expiry")} />
          <Field id="passport_sex" label="Sex" value={form.passport_sex ?? ""} onChange={set("passport_sex")} />
          <div className="sm:col-span-2">
            <Label htmlFor="passport_info">Passport Information</Label>
            <Textarea
              id="passport_info"
              rows={3}
              placeholder="Anything else we should know about your travel documents"
              value={form.passport_info ?? ""}
              onChange={(e) => set("passport_info")(e.target.value)}
            />
          </div>
          <Field id="known_traveler_number" label="Known Traveler Number (TSA Pre✓)" value={form.known_traveler_number ?? ""} onChange={set("known_traveler_number")} />
          <Field id="redress_number" label="Redress Number" value={form.redress_number ?? ""} onChange={set("redress_number")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Travel Preferences</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="flight_seating_preference" label="Flight Seating Preference" placeholder="Window / Aisle" value={form.flight_seating_preference ?? ""} onChange={set("flight_seating_preference")} />
          <Field id="flight_bulkhead_preference" label="Bulkhead Preference" value={form.flight_bulkhead_preference ?? ""} onChange={set("flight_bulkhead_preference")} />
          <Field id="lodging_floor_preference" label="Hotel Floor Preference" value={form.lodging_floor_preference ?? ""} onChange={set("lodging_floor_preference")} />
          <Field id="lodging_elevator_preference" label="Hotel Elevator Preference" value={form.lodging_elevator_preference ?? ""} onChange={set("lodging_elevator_preference")} />
          <Field id="cruise_cabin_floor_preference" label="Cruise Cabin Floor" value={form.cruise_cabin_floor_preference ?? ""} onChange={set("cruise_cabin_floor_preference")} />
          <Field id="cruise_cabin_location_preference" label="Cruise Cabin Location" value={form.cruise_cabin_location_preference ?? ""} onChange={set("cruise_cabin_location_preference")} />
          <div className="sm:col-span-2">
            <Label htmlFor="food_drink_allergies">Food &amp; Drink Allergies</Label>
            <Textarea id="food_drink_allergies" rows={2} value={form.food_drink_allergies ?? ""} onChange={(e) => set("food_drink_allergies")(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="activities_interests">Activities &amp; Interests</Label>
            <Textarea id="activities_interests" rows={2} value={form.activities_interests ?? ""} onChange={(e) => set("activities_interests")(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="loyalty_programs">Loyalty Programs</Label>
            <Textarea id="loyalty_programs" rows={2} placeholder="Airline, hotel, cruise loyalty numbers" value={form.loyalty_programs ?? ""} onChange={(e) => set("loyalty_programs")(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}