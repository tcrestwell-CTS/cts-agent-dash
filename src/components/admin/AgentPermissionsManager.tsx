import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import { useAllUserRoles } from "@/hooks/useUserRoles";
import { useUserFeaturePermissions } from "@/hooks/useFeaturePermissions";
import { FEATURE_REGISTRY, type FeatureKey } from "@/lib/featureRegistry";

/**
 * Admin UI: pick an agent, toggle each feature on/off.
 * Admins and office admins are not gated, so we hide them from the picker.
 */
export function AgentPermissionsManager() {
  const queryClient = useQueryClient();
  const { data: profiles, isLoading: profilesLoading } = useTeamProfiles();
  const { data: userRoles, isLoading: rolesLoading } = useAllUserRoles();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: overrides, isLoading: permsLoading } =
    useUserFeaturePermissions(selectedUserId);

  // Filter to plain agents only (admin/office_admin always have full access)
  const agentProfiles = useMemo(() => {
    if (!profiles || !userRoles) return [];
    const elevated = new Set(
      userRoles
        .filter((r) => r.role === "admin" || r.role === "office_admin")
        .map((r) => r.user_id)
    );
    return profiles.filter((p) => !elevated.has(p.user_id));
  }, [profiles, userRoles]);

  const isAllowed = (key: FeatureKey): boolean => {
    if (overrides && key in overrides) return overrides[key];
    return FEATURE_REGISTRY.find((f) => f.key === key)?.defaultAllowed ?? false;
  };

  const togglePermission = async (key: FeatureKey, next: boolean) => {
    if (!selectedUserId) return;
    setSavingKey(key);
    try {
      const { error } = await supabase
        .from("user_feature_permissions")
        .upsert(
          { user_id: selectedUserId, feature_key: key, allowed: next },
          { onConflict: "user_id,feature_key" }
        );
      if (error) throw error;
      await queryClient.invalidateQueries({
        queryKey: ["user-feature-permissions", selectedUserId],
      });
      // Invalidate the affected agent's own cached permissions in case they're logged in
      await queryClient.invalidateQueries({
        queryKey: ["feature-permissions", selectedUserId],
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update permission");
    } finally {
      setSavingKey(null);
    }
  };

  const groups = useMemo(() => {
    const byGroup: Record<string, typeof FEATURE_REGISTRY> = {};
    for (const f of FEATURE_REGISTRY) {
      (byGroup[f.group] ??= []).push(f);
    }
    return byGroup;
  }, []);

  if (profilesLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[280px] max-w-md">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Select an agent
          </label>
          <Select
            value={selectedUserId ?? ""}
            onValueChange={(v) => setSelectedUserId(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an agent..." />
            </SelectTrigger>
            <SelectContent>
              {agentProfiles.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No agents to manage
                </div>
              ) : (
                agentProfiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || "Unnamed"}{" "}
                    {p.job_title ? `· ${p.job_title}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Admins and Office Admins always have full access.
        </div>
      </div>

      {!selectedUserId ? (
        <div className="bg-muted/40 border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          Pick an agent above to view and edit their feature access.
        </div>
      ) : permsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([group, features]) => (
            <div
              key={group}
              className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-medium text-card-foreground">{group}</h3>
              </div>
              <div className="divide-y divide-border/50">
                {features.map((f) => {
                  const allowed = isAllowed(f.key);
                  const hasOverride = overrides && f.key in overrides;
                  return (
                    <div
                      key={f.key}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                          {f.label}
                          {hasOverride ? (
                            <Badge variant="outline" className="text-[10px]">
                              Custom
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {f.defaultAllowed
                            ? "Allowed for agents by default"
                            : "Hidden from agents by default"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {savingKey === f.key && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={allowed}
                          onCheckedChange={(v) => togglePermission(f.key, v)}
                          disabled={savingKey === f.key}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}