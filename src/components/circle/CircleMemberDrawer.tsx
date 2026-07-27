import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mail, FileText, ExternalLink } from "lucide-react";
import {
  CircleMember,
  useUpdateCircleMember,
} from "@/hooks/useCircleMembers";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Props {
  member: CircleMember | null;
  onClose: () => void;
}

export function CircleMemberDrawer({ member, onClose }: Props) {
  const update = useUpdateCircleMember();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<CircleMember["status"]>("active");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (member) {
      setNotes(member.notes || "");
      setStatus(member.status);
    }
  }, [member?.id]);

  if (!member) return null;

  const monthsSinceJoin = (() => {
    const join = new Date(member.joined_at).getTime();
    return (Date.now() - join) / (1000 * 60 * 60 * 24 * 30);
  })();

  const canUpgradePremier = monthsSinceJoin >= 12;
  const canUpgradeFounders = monthsSinceJoin >= 18;

  const saveNotes = async () => {
    await update.mutateAsync({ id: member.id, patch: { notes } });
    toast({ title: "Notes saved" });
  };

  const onStatusChange = async (next: string) => {
    setStatus(next as any);
    await update.mutateAsync({ id: member.id, patch: { status: next as any } });
    toast({ title: "Status updated" });
  };

  const upgradeTier = async (tier: CircleMember["tier"]) => {
    await update.mutateAsync({ id: member.id, patch: { tier } });
    toast({ title: `Upgraded to ${tier}` });
  };

  const sendWelcome = async () => {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-circle-email", {
        body: { kind: "welcome", member_id: member.id },
      });
      if (error) throw error;
      toast({ title: "Welcome email sent" });
    } catch (e: any) {
      toast({
        title: "Failed to send welcome",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={!!member} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {member.name || member.email}
            {member.founding_member && (
              <Sparkles className="h-4 w-4 text-warning" />
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p>{member.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tier</p>
              <Badge variant="secondary">{member.tier}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              <p>{member.source || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p>{format(new Date(member.joined_at), "MMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trial ends</p>
              <p>
                {member.trial_ends_at
                  ? format(new Date(member.trial_ends_at), "MMM d, yyyy")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Linked client</p>
              {member.client_id ? (
                <Link
                  to={`/contacts/${member.client_id}`}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View client <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <p className="text-muted-foreground">Not linked</p>
              )}
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={4}
              placeholder="Internal notes about this member…"
              className="mt-1"
            />
          </div>

          <div className="space-y-2">
            <Label>Tier upgrades</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canUpgradePremier || member.tier === "premier"}
                onClick={() => upgradeTier("premier")}
              >
                Upgrade to Premier
                {!canUpgradePremier && " (Month 12+)"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !canUpgradeFounders || member.tier === "founders_society"
                }
                onClick={() => upgradeTier("founders_society")}
              >
                Upgrade to Founders Society
                {!canUpgradeFounders && " (Month 18+)"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Actions</Label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={sendWelcome} disabled={sending}>
                <Mail className="h-4 w-4 mr-1.5" />
                Send Welcome Email
              </Button>
              {member.client_id && (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/contacts/${member.client_id}`}>
                    <FileText className="h-4 w-4 mr-1.5" />
                    View Trip History
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}