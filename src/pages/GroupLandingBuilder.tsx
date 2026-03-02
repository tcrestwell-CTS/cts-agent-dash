import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Globe,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Users,
  Palette,
  FileText,
  CheckCircle2,
  ImagePlus,
  Link,
  X,
  Loader2,
} from "lucide-react";

const GroupLandingBuilder = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState<any>(null);

  const [landingEnabled, setLandingEnabled] = useState(false);
  const [landingHeadline, setLandingHeadline] = useState("");
  const [landingDescription, setLandingDescription] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroUrlInput, setHeroUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  const fetchTrip = async () => {
    if (!tripId) return;
    const { data, error } = await supabase
      .from("trips")
      .select("id, trip_name, destination, depart_date, return_date, trip_type, share_token, group_landing_enabled, status, cover_image_url")
      .eq("id", tripId)
      .single();

    if (error || !data) {
      toast.error("Trip not found");
      navigate("/trips");
      return;
    }

    if ((data as any).trip_type !== "group") {
      toast.error("Landing pages are only available for group trips");
      navigate(`/trips/${tripId}`);
      return;
    }

    // Fetch the new columns separately to avoid type issues
    const { data: extraData } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    setTrip(data);
    setLandingEnabled((data as any).group_landing_enabled || false);
    setLandingHeadline((extraData as any)?.group_landing_headline || "");
    setLandingDescription((extraData as any)?.group_landing_description || "");
    setLoading(false);

    if (error || !data) {
      toast.error("Trip not found");
      navigate("/trips");
      return;
    }

    if (data.trip_type !== "group") {
      toast.error("Landing pages are only available for group trips");
      navigate(`/trips/${tripId}`);
      return;
    }

    setTrip(data);
    setLandingEnabled(data.group_landing_enabled || false);
    setLandingHeadline((data as any).group_landing_headline || "");
    setLandingDescription((data as any).group_landing_description || "");
    setLoading(false);
  };

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const handleToggle = async (enabled: boolean) => {
    setLandingEnabled(enabled);
    const { error } = await supabase
      .from("trips")
      .update({ group_landing_enabled: enabled } as any)
      .eq("id", tripId!);

    if (error) {
      toast.error("Failed to update");
      setLandingEnabled(!enabled);
    } else {
      toast.success(enabled ? "Landing page enabled" : "Landing page disabled");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("trips")
      .update({
        group_landing_headline: landingHeadline || null,
        group_landing_description: landingDescription || null,
      } as any)
      .eq("id", tripId!);

    if (error) {
      toast.error("Failed to save changes");
    } else {
      toast.success("Landing page content saved");
    }
    setSaving(false);
  };

  const PRODUCTION_DOMAIN = "https://app.crestwelltravels.com";
  const landingUrl = trip?.share_token
    ? `${PRODUCTION_DOMAIN}/group/${trip.share_token}`
    : null;

  const copyUrl = () => {
    if (landingUrl) {
      navigator.clipboard.writeText(landingUrl);
      toast.success("Link copied!");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/trips/${tripId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Group Landing Page</h1>
            <p className="text-muted-foreground text-sm">
              {trip?.trip_name} — Build and manage the public signup page
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              landingEnabled
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-muted text-muted-foreground"
            }
          >
            {landingEnabled ? (
              <>
                <Eye className="h-3 w-3 mr-1" />
                Live
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                Draft
              </>
            )}
          </Badge>
        </div>

        {/* Enable / Disable Toggle */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Page Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Landing Page</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, clients can visit the public URL and sign up for your group trip.
                </p>
              </div>
              <Switch
                checked={landingEnabled}
                onCheckedChange={handleToggle}
              />
            </div>

            {landingUrl && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Public URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={landingUrl}
                    className="text-xs font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button size="sm" variant="outline" onClick={copyUrl}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {landingEnabled && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={landingUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
                {!landingEnabled && (
                  <p className="text-xs text-destructive/80">
                    Enable the landing page to make this URL accessible to clients.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Builder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Page Content
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Customize the headline and description shown on the landing page.
              Trip details (destination, dates, cover image) are pulled automatically.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Headline</Label>
              <Input
                placeholder={trip?.trip_name || "Join Our Amazing Group Trip!"}
                value={landingHeadline}
                onChange={(e) => setLandingHeadline(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the trip name if left blank.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                placeholder="Share what makes this trip special — highlights, inclusions, what's planned..."
                value={landingDescription}
                onChange={(e) => setLandingDescription(e.target.value)}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Shown below the headline on the landing page. Supports plain text.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Content"}
            </Button>
          </CardContent>
        </Card>

        {/* Preview checklist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Landing Page Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <ChecklistItem done={!!trip?.destination} label="Destination set" />
              <ChecklistItem done={!!trip?.depart_date} label="Travel dates added" />
              <ChecklistItem done={!!trip?.cover_image_url} label="Cover image uploaded" />
              <ChecklistItem done={!!landingHeadline} label="Custom headline written" />
              <ChecklistItem done={!!landingDescription} label="Description added" />
              <ChecklistItem done={landingEnabled} label="Page enabled" />
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <div
        className={`h-4 w-4 rounded-full flex items-center justify-center text-xs ${
          done
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "✓" : "–"}
      </div>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </li>
  );
}

export default GroupLandingBuilder;
