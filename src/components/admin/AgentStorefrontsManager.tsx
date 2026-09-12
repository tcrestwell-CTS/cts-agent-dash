import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Store } from "lucide-react";
import { isHiddenAgent } from "@/lib/hiddenAgents";
import { toast } from "sonner";
import { StorefrontLogoUpload } from "@/components/storefront/StorefrontLogoUpload";

interface StorefrontRow {
  id: string;
  user_id: string;
  full_name: string | null;
  agency_name: string | null;
  storefront_enabled: boolean | null;
  storefront_slug: string | null;
  storefront_headline: string | null;
  storefront_email: string | null;
  storefront_logo_url: string | null;
  avatar_url: string | null;
}

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const AgentStorefrontsManager = () => {
  const [rows, setRows] = useState<StorefrontRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);

  const visibleRows = showDisabled ? rows : rows.filter((r) => !!r.storefront_enabled);
  const hiddenCount = rows.length - rows.filter((r) => !!r.storefront_enabled).length;

  const load = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, agency_name, storefront_enabled, storefront_slug, storefront_headline, storefront_email, storefront_logo_url, avatar_url")
      .order("agency_name", { ascending: true, nullsFirst: false });
    if (error) {
      console.error("Failed to load storefronts:", error);
      toast.error("Unable to load agent storefronts");
    } else {
      setRows(((data ?? []) as StorefrontRow[]).filter((r) => !isHiddenAgent(r.user_id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const patchLocal = (id: string, patch: Partial<StorefrontRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (row: StorefrontRow) => {
    setSavingId(row.id);
    const { error } = await supabase
      .from("profiles")
      .update({
        storefront_enabled: row.storefront_enabled ?? false,
        storefront_slug: row.storefront_slug ? slugify(row.storefront_slug) : null,
        storefront_headline: row.storefront_headline,
        storefront_email: row.storefront_email,
        storefront_logo_url: row.storefront_logo_url,
        avatar_url: row.avatar_url,
      } as any)
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      console.error("Failed to save storefront:", error);
      toast.error(error.message.includes("duplicate") ? "That storefront address is already taken" : "Could not save storefront");
      return;
    }
    toast.success(`Storefront saved for ${row.agency_name || row.full_name || "agent"}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hiddenCount > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{hiddenCount} disabled storefront{hiddenCount === 1 ? "" : "s"} hidden</span>
          <Switch checked={showDisabled} onCheckedChange={setShowDisabled} />
          <span>{showDisabled ? "Showing all" : "Show all"}</span>
        </div>
      )}
      {visibleRows.map((row) => {
        const storefrontName = row.agency_name?.trim() || row.full_name || "Unnamed agency";
        const url = row.storefront_slug ? `https://${slugify(row.storefront_slug)}.crestwelltravels.com` : null;
        return (
          <Card key={row.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="h-4 w-4 text-primary" />
                  {storefrontName}
                  {row.storefront_enabled ? (
                    <Badge variant="secondary">Live</Badge>
                  ) : (
                    <Badge variant="outline">Off</Badge>
                  )}
                </CardTitle>
                <CardDescription>{row.full_name}</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {url && (
                  <a
                    href={row.storefront_slug ? `/storefront/${slugify(row.storefront_slug)}` : "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary inline-flex items-center gap-1"
                  >
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Switch
                  checked={!!row.storefront_enabled}
                  onCheckedChange={(checked) => patchLocal(row.id, { storefront_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Storefront address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={row.storefront_slug ?? ""}
                      onChange={(e) => patchLocal(row.id, { storefront_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                      placeholder="agency-name"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">.crestwelltravels.com</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!row.agency_name}
                    onClick={() => patchLocal(row.id, { storefront_slug: slugify(row.agency_name ?? "") })}
                  >
                    Use agency name
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Headline</Label>
                  <Input
                    value={row.storefront_headline ?? ""}
                    onChange={(e) => patchLocal(row.id, { storefront_headline: e.target.value })}
                    placeholder="Your Personal Cruise & Vacation Expert"
                  />
                  {url && <p className="text-xs text-muted-foreground">{url}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <StorefrontLogoUpload
                    userId={row.user_id}
                    value={row.storefront_logo_url}
                    onChange={(logoUrl) => patchLocal(row.id, { storefront_logo_url: logoUrl })}
                    compact
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profile photo</Label>
                  <StorefrontLogoUpload
                    userId={row.user_id}
                    value={row.avatar_url}
                    onChange={(avatarUrl) => patchLocal(row.id, { avatar_url: avatarUrl })}
                    noun="photo"
                    fileBase="storefront-avatar"
                    shape="circle"
                    fit="cover"
                    compact
                  />
                </div>
              </div>
              <Button size="sm" onClick={() => save(row)} disabled={savingId === row.id}>
                {savingId === row.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
