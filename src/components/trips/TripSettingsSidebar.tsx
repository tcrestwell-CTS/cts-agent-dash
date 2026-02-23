import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, Shield } from "lucide-react";

interface TripSettings {
  currency: string;
  pricing_visibility: string;
  tags: string[];
  allow_pdf_downloads: boolean;
  itinerary_style: string;
  deposit_required: boolean;
  deposit_amount: number;
}

interface TripSettingsSidebarProps {
  tripId: string;
  settings: TripSettings;
  agencyName?: string;
  onSettingsChange: () => void;
}

export function TripSettingsSidebar({
  tripId,
  settings,
  agencyName,
  onSettingsChange,
}: TripSettingsSidebarProps) {
  const [localSettings, setLocalSettings] = useState<TripSettings>(settings);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateSetting = async (field: string, value: any) => {
    const updated = { ...localSettings, [field]: value };
    setLocalSettings(updated);

    const { error } = await supabase
      .from("trips")
      .update({ [field]: value } as any)
      .eq("id", tripId);

    if (error) {
      toast.error("Failed to update setting");
      setLocalSettings(settings); // revert
    } else {
      onSettingsChange();
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !localSettings.tags.includes(tag)) {
      updateSetting("tags", [...localSettings.tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateSetting("tags", localSettings.tags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip Settings</CardTitle>
          <p className="text-xs text-muted-foreground">
            Set the default options for this trip.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Currency</Label>
            <Select
              value={localSettings.currency}
              onValueChange={(v) => updateSetting("currency", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">United States Dollar (USD)</SelectItem>
                <SelectItem value="EUR">Euro (EUR)</SelectItem>
                <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                <SelectItem value="CAD">Canadian Dollar (CAD)</SelectItem>
                <SelectItem value="AUD">Australian Dollar (AUD)</SelectItem>
                <SelectItem value="MXN">Mexican Peso (MXN)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Visibility */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Pricing visibility</Label>
            <Select
              value={localSettings.pricing_visibility}
              onValueChange={(v) => updateSetting("pricing_visibility", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="show_all">Show all prices</SelectItem>
                <SelectItem value="totals_only">Totals only</SelectItem>
                <SelectItem value="hide_all">Hide all prices</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tags</Label>
            <Input
              placeholder="Search tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            {localSettings.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {localSettings.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Allow PDF Downloads */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Allow PDF Downloads</Label>
            <Switch
              checked={localSettings.allow_pdf_downloads}
              onCheckedChange={(v) => updateSetting("allow_pdf_downloads", v)}
            />
          </div>

          {/* Deposit Required */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Deposit Required</Label>
            <Switch
              checked={localSettings.deposit_required}
              onCheckedChange={(v) => updateSetting("deposit_required", v)}
            />
          </div>

          {/* Deposit Amount */}
          {localSettings.deposit_required && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Deposit Amount ($)</Label>
              <Input
                type="number"
                min="0"
                value={localSettings.deposit_amount || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLocalSettings((s) => ({ ...s, deposit_amount: val }));
                }}
                onBlur={(e) => updateSetting("deposit_amount", parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          {/* Itinerary Style */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Itinerary Style</Label>
            <Select
              value={localSettings.itinerary_style}
              onValueChange={(v) => updateSetting("itinerary_style", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical_list">Vertical list</SelectItem>
                <SelectItem value="day_cards">Day cards</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agency Sharing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agency sharing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Managed by</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{agencyName || "My Agency"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Agency-managed trip</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
