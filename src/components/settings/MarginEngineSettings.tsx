import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Percent, Lock, Eye } from "lucide-react";
import { useState } from "react";

/**
 * Scaffolded Margin Engine settings UI.
 * Backend endpoints are not yet wired — this is a visual placeholder
 * so the settings page is organized for future controls.
 */
export function MarginEngineSettings() {
  // Local state for scaffolding — will be replaced with real hook
  const [settings, setSettings] = useState({
    default_markup_mode: "net" as "net" | "gross" | "commission",
    minimum_margin_pct: 0,
    allow_manual_overrides: true,
    show_splits_to_advisors: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Margin Engine</h3>
          <p className="text-sm text-muted-foreground">
            Controls how booking margins are calculated and displayed
          </p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs">Coming Soon</Badge>
      </div>

      {/* Default Markup Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-primary" />
            Default Pricing Mode
          </CardTitle>
          <CardDescription>
            How new bookings calculate margin by default
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Mode</Label>
            <Select
              value={settings.default_markup_mode}
              onValueChange={(v) =>
                setSettings((p) => ({ ...p, default_markup_mode: v as any }))
              }
              disabled
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="net">
                  Net Rate — Margin = Sell − Cost
                </SelectItem>
                <SelectItem value="commission">
                  Commission — Supplier pays % of sale
                </SelectItem>
                <SelectItem value="gross">
                  Gross Markup — Cost + fixed markup
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Individual bookings can override this on a per-booking basis.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Minimum Margin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-primary" />
            Minimum Margin Guard
          </CardTitle>
          <CardDescription>
            Warn or block bookings below a minimum margin threshold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="min-margin">Minimum Margin %</Label>
            <Input
              id="min-margin"
              type="number"
              min="0"
              max="100"
              step="1"
              value={settings.minimum_margin_pct}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  minimum_margin_pct: Number(e.target.value),
                }))
              }
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to disable. When active, bookings with margin below this
              threshold will show a warning.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Override Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-primary" />
            Manual Override Rules
          </CardTitle>
          <CardDescription>
            Whether advisors can manually override calculated margins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-card-foreground">Allow Manual Overrides</p>
              <p className="text-sm text-muted-foreground">
                Advisors can lock a custom margin that bypasses auto-calculation
              </p>
            </div>
            <Switch
              checked={settings.allow_manual_overrides}
              onCheckedChange={(v) =>
                setSettings((p) => ({ ...p, allow_manual_overrides: v }))
              }
              disabled
            />
          </div>
        </CardContent>
      </Card>

      {/* Advisor Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            Advisor Visibility
          </CardTitle>
          <CardDescription>
            Control what financial details advisors can see
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-card-foreground">Show Split Breakdown</p>
              <p className="text-sm text-muted-foreground">
                Advisors see their share vs agency retained share on bookings
              </p>
            </div>
            <Switch
              checked={settings.show_splits_to_advisors}
              onCheckedChange={(v) =>
                setSettings((p) => ({ ...p, show_splits_to_advisors: v }))
              }
              disabled
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
