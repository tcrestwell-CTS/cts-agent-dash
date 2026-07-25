import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamProfiles } from "@/hooks/useTeamProfiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Assignment {
  id: string;
  mentee_user_id: string;
  mentor_user_id: string;
  split_percent: number;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
}

export function MentorAssignmentsManager() {
  const qc = useQueryClient();
  const { data: profiles, isLoading: profilesLoading } = useTeamProfiles();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["mentor-assignments-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mentor_assignments")
        .select("id,mentee_user_id,mentor_user_id,split_percent,is_active,effective_from,effective_to")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    (profiles ?? []).forEach((p) => m.set(p.user_id, p.full_name || p.user_id.slice(0, 8)));
    return m;
  }, [profiles]);

  const [mentee, setMentee] = useState<string>("");
  const [mentor, setMentor] = useState<string>("");
  const [percent, setPercent] = useState<number>(10);
  const [effectiveFrom, setEffectiveFrom] = useState<string>("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mentor-assignments-admin"] });
    qc.invalidateQueries({ queryKey: ["mentor-rules"] });
  };

  const addOrUpdate = useMutation({
    mutationFn: async () => {
      if (!mentee || !mentor) throw new Error("Choose an agent and a mentor");
      if (mentee === mentor) throw new Error("An agent cannot mentor themselves");
      const { error } = await (supabase as any)
        .from("mentor_assignments")
        .upsert(
          {
            mentee_user_id: mentee,
            mentor_user_id: mentor,
            split_percent: percent,
            is_active: true,
            effective_from: effectiveFrom || null,
            assigned_by: (await supabase.auth.getUser()).data.user?.id,
          },
          { onConflict: "mentee_user_id,mentor_user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mentor split saved");
      setPercent(10);
      setEffectiveFrom("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const patchRow = useMutation({
    mutationFn: async (patch: Partial<Assignment> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await (supabase as any).from("mentor_assignments").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const removeRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("mentor_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment removed");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  if (profilesLoading || isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading mentor assignments…
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle>Mentor Splits</CardTitle>
        </div>
        <CardDescription>
          Apply a mentor split to any agent. The mentor's percent is taken from the agent's
          share of each commission and appears as its own line on the statement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end border border-dashed border-border rounded-lg p-3">
          <div className="md:col-span-1">
            <label className="text-xs text-muted-foreground">Agent (mentee)</label>
            <Select value={mentee} onValueChange={setMentee}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Choose agent" /></SelectTrigger>
              <SelectContent>
                {(profiles ?? []).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || p.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs text-muted-foreground">Mentor</label>
            <Select value={mentor} onValueChange={setMentor}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Choose mentor" /></SelectTrigger>
              <SelectContent>
                {(profiles ?? []).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || p.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Mentor %</label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Effective from</label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <Button onClick={() => addOrUpdate.mutate()} disabled={addOrUpdate.isPending} className="h-9">
            {addOrUpdate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1">Save</span>
          </Button>
        </div>

        {/* Existing rows */}
        <div className="space-y-2">
          {(assignments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No mentor splits configured yet.</p>
          ) : (
            (assignments ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3 border border-border/60 rounded-lg p-3"
              >
                <div className="min-w-[220px]">
                  <p className="text-sm font-medium">{profileMap.get(a.mentee_user_id) || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    Mentor: {profileMap.get(a.mentor_user_id) || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">%</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    defaultValue={a.split_percent}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== Number(a.split_percent)) patchRow.mutate({ id: a.id, split_percent: v });
                    }}
                    className="h-8 w-20 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input
                    type="date"
                    defaultValue={a.effective_from ?? ""}
                    onBlur={(e) =>
                      patchRow.mutate({ id: a.id, effective_from: e.target.value || null })
                    }
                    className="h-8 w-[140px] text-xs"
                  />
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input
                    type="date"
                    defaultValue={a.effective_to ?? ""}
                    onBlur={(e) =>
                      patchRow.mutate({ id: a.id, effective_to: e.target.value || null })
                    }
                    className="h-8 w-[140px] text-xs"
                  />
                </div>
                <Badge
                  variant={a.is_active ? "secondary" : "outline"}
                  className="cursor-pointer"
                  onClick={() => patchRow.mutate({ id: a.id, is_active: !a.is_active })}
                >
                  {a.is_active ? "Active" : "Paused"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => removeRow.mutate(a.id)}
                  aria-label="Remove assignment"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}