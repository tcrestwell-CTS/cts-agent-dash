import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Plus, RefreshCw, Trash2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type Mailbox = {
  id: string;
  provider: string;
  email_address: string | null;
  last_synced_at: string | null;
  is_active: boolean;
  paused_at: string | null;
};

export default function InboxSync() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("inbox_watched_mailboxes")
      .select("id, provider, email_address, last_synced_at, is_active, paused_at")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setMailboxes((data ?? []) as Mailbox[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("inbox_watched_mailboxes").insert({
      user_id: u.user.id,
      provider: "gmail",
      email_address: newEmail.trim().toLowerCase(),
      is_active: true,
    });
    setAdding(false);
    if (error) {
      toast({ title: "Could not add mailbox", description: error.message, variant: "destructive" });
      return;
    }
    setNewEmail("");
    toast({ title: "Mailbox added", description: "Iris will start watching on the next sync." });
    load();
  };

  const toggleActive = async (m: Mailbox, next: boolean) => {
    const { error } = await supabase
      .from("inbox_watched_mailboxes")
      .update({ is_active: next, paused_at: next ? null : new Date().toISOString() })
      .eq("id", m.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (m: Mailbox) => {
    if (!confirm(`Stop watching ${m.email_address}?`)) return;
    const { error } = await supabase.from("inbox_watched_mailboxes").delete().eq("id", m.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    load();
  };

  const sync = async (m: Mailbox) => {
    setSyncing(m.id);
    const { error } = await supabase.functions.invoke("iris-poll", {
      body: { mailbox_id: m.id },
    });
    setSyncing(null);
    if (error) {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Sync complete", description: "Check Approvals for new proposals." });
    load();
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Inbox Sync — Iris
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Iris watches connected mailboxes, classifies incoming email, and posts proposed actions to your Approvals inbox.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a mailbox</CardTitle>
            <CardDescription>
              The Gmail account must already be connected at the workspace level. Currently watching Gmail only.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="you@crestwelltravels.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} disabled={adding || !newEmail.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Watched mailboxes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : mailboxes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mailboxes yet. Add one above.</p>
            ) : (
              mailboxes.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-4 border rounded-lg p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{m.email_address}</span>
                      <Badge variant="outline" className="capitalize">
                        {m.provider}
                      </Badge>
                      {!m.is_active && <Badge variant="secondary">Paused</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last sync:{" "}
                      {m.last_synced_at
                        ? formatDistanceToNow(new Date(m.last_synced_at), { addSuffix: true })
                        : "never"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sync(m)}
                      disabled={syncing === m.id}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${syncing === m.id ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={(v) => toggleActive(m, v)}
                      aria-label="Active"
                    />
                    <Button variant="ghost" size="icon" onClick={() => remove(m)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}