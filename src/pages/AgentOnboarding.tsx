import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useMyMentor } from "@/hooks/useMentorAssignment";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelHeader } from "@/components/patterns/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  Compass,
  GraduationCap,
  Loader2,
  Palette,
  Phone,
  User,
  Users,
} from "lucide-react";

const steps = [
  {
    key: "profile_completed" as const,
    label: "Complete your profile",
    description: "Your name, agency and contact details",
    icon: User,
    href: "/settings",
  },
  {
    key: "first_client_added" as const,
    label: "Add your first client",
    description: "Create or import a client record",
    icon: Users,
    href: "/contacts",
  },
  {
    key: "first_trip_created" as const,
    label: "Create your first trip",
    description: "Dates, destination and travelers",
    icon: Compass,
    href: "/trips",
  },
  {
    key: "first_booking_added" as const,
    label: "Add a booking",
    description: "Link a supplier booking to a trip",
    icon: Calendar,
    href: "/bookings",
  },
  {
    key: "branding_configured" as const,
    label: "Set up your branding",
    description: "Your logo, agency name and colors",
    icon: Palette,
    href: "/branding",
  },
  {
    key: "training_started" as const,
    label: "Start training",
    description: "Begin your certification path",
    icon: GraduationCap,
    href: "/training",
  },
];

export default function AgentOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { progress, isLoading, completedSteps, totalSteps, progressPercent } = useOnboarding();
  const { data: mentorData } = useMyMentor();

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    agency_name: "",
    job_title: "Travel Advisor",
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, agency_name, job_title")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setForm({
          full_name: data.full_name || "",
          phone: data.phone || "",
          agency_name: data.agency_name || "",
          job_title: data.job_title || "Travel Advisor",
        });
      }
      setLoadingProfile(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    if (!form.full_name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      agency_name: form.agency_name.trim() || null,
      job_title: form.job_title.trim() || "Travel Advisor",
    };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("We couldn't save your details. Please try again.");
      return;
    }
    toast.success("Your details are saved.");
  };

  const nextStep = steps.find((s) => progress && !progress[s.key]);
  const firstName = form.full_name.trim().split(" ")[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">
            Crestwell Travel Services
          </p>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">
            {firstName ? `Welcome, ${firstName}` : "Welcome aboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Finish these steps to get your account fully set up.
          </p>
        </div>

        <Panel className="overflow-hidden border-primary/20">
          <PanelHeader
            className="bg-gradient-to-r from-primary/10 to-accent/10"
            title="Your setup checklist"
            subtitle={`${completedSteps}/${totalSteps} steps completed`}
            actions={
              <Badge variant="secondary" className="text-[11.5px]">
                {progressPercent}%
              </Badge>
            }
          />
          <div className="px-[17px] py-2">
            <Progress value={progressPercent} className="h-1.5" />
          </div>
          <div className="grid grid-cols-1 gap-3 px-[17px] py-[14px] md:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[74px] animate-pulse rounded-[9px] bg-muted/40" />
                ))
              : steps.map((step) => {
                  const done = progress?.[step.key] ?? false;
                  const isNext = step === nextStep;
                  return (
                    <button
                      key={step.key}
                      onClick={() => navigate(step.href)}
                      className={cn(
                        "flex items-start gap-3 rounded-[9px] p-3 text-left transition-all",
                        done
                          ? "border border-success/20 bg-success/5"
                          : isNext
                          ? "border border-primary/20 bg-primary/5 hover:bg-primary/10"
                          : "border border-border bg-muted/30 hover:bg-muted/50"
                      )}
                    >
                      <div className="mt-0.5">
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Circle
                            className={cn(
                              "h-5 w-5",
                              isNext ? "text-primary" : "text-muted-foreground/40"
                            )}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[13.5px] font-medium",
                            done ? "text-success line-through" : "text-card-foreground"
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                      {isNext && <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Your details"
            subtitle="This is how your name appears on client documents and emails"
          />
          <div className="grid grid-cols-1 gap-4 px-[17px] py-[14px] md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                disabled={loadingProfile}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Elvira Cruz"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job_title">Title</Label>
              <Input
                id="job_title"
                value={form.job_title}
                disabled={loadingProfile}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="Travel Advisor"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agency_name">Agency name</Label>
              <Input
                id="agency_name"
                value={form.agency_name}
                disabled={loadingProfile}
                onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                placeholder="Your agency or brand"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                disabled={loadingProfile}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 555-5555"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-[17px] py-3">
            <Button onClick={saveProfile} disabled={saving || loadingProfile}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save my details
            </Button>
            <Button variant="outline" onClick={() => navigate("/training")}>
              Go to training
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              Skip to dashboard
            </Button>
          </div>
        </Panel>

        {mentorData?.mentor && (
          <Panel>
            <PanelHeader title="Your mentor" subtitle="Reach out any time with questions" />
            <div className="flex items-center gap-3 px-[17px] py-[14px]">
              {mentorData.mentor.avatar_url ? (
                <img
                  src={mentorData.mentor.avatar_url}
                  alt={mentorData.mentor.full_name || "Mentor"}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                  <User className="h-5 w-5 text-accent" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-card-foreground">
                  {mentorData.mentor.full_name}
                </p>
                <p className="text-[12.5px] text-muted-foreground">
                  {mentorData.mentor.job_title || "Senior Advisor"}
                </p>
              </div>
              {mentorData.mentor.phone && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`tel:${mentorData.mentor.phone}`}>
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </a>
                </Button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </DashboardLayout>
  );
}
