import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Sparkles, Mail, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CircleMember,
  useCircleMembers,
} from "@/hooks/useCircleMembers";
import { CircleStatsBar } from "./CircleStatsBar";
import { CircleMemberDrawer } from "./CircleMemberDrawer";
import { CircleTierRoadmap } from "./CircleTierRoadmap";
import { CircleBriefingComposer } from "./CircleBriefingComposer";
import { CircleFoundingInviteComposer } from "./CircleFoundingInviteComposer";

const tierBadge = (tier: CircleMember["tier"]) => {
  if (tier === "founders_society")
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Founders Society</Badge>;
  if (tier === "premier")
    return <Badge className="bg-amber-200 hover:bg-amber-200 text-amber-900">Premier</Badge>;
  return <Badge className="bg-[#0a1f44] hover:bg-[#0a1f44] text-white">Circle</Badge>;
};

const statusBadge = (s: CircleMember["status"]) => {
  if (s === "active")
    return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">Active</Badge>;
  if (s === "unsubscribed")
    return <Badge variant="secondary">Unsubscribed</Badge>;
  return <Badge variant="destructive">Cancelled</Badge>;
};

export function CircleMembersManager() {
  const { data: members = [], isLoading } = useCircleMembers();
  const [tier, setTier] = useState<string>("all");
  const [founding, setFounding] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openMember, setOpenMember] = useState<CircleMember | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter((m) => {
      if (tier !== "all" && m.tier !== tier) return false;
      if (founding === "yes" && !m.founding_member) return false;
      if (founding === "no" && m.founding_member) return false;
      if (status !== "all" && m.status !== status) return false;
      if (q && !(m.name || "").toLowerCase().includes(q) && !m.email.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [members, tier, founding, status, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            The Crestwell Circle
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage members, briefings, and founding invitations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            <Mail className="h-4 w-4 mr-1.5" />
            Send Founding Invitation
          </Button>
          <Button onClick={() => setBriefingOpen(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Send Port Intel Briefing
          </Button>
        </div>
      </div>

      <CircleTierRoadmap />
      <CircleStatsBar />

      <Card className="p-4 space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger><SelectValue placeholder="Tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="circle">Circle</SelectItem>
              <SelectItem value="premier">Premier</SelectItem>
              <SelectItem value="founders_society">Founders Society</SelectItem>
            </SelectContent>
          </Select>
          <Select value={founding} onValueChange={setFounding}>
            <SelectTrigger><SelectValue placeholder="Founding" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              <SelectItem value="yes">Founding only</SelectItem>
              <SelectItem value="no">Non-founding</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Founding</TableHead>
                <TableHead>Trial Ends</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No members match these filters.</TableCell></TableRow>
              )}
              {filtered.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  onClick={() => setOpenMember(m)}
                >
                  <TableCell className="font-medium">{m.name || "—"}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>{tierBadge(m.tier)}</TableCell>
                  <TableCell>
                    {m.founding_member ? <Sparkles className="h-4 w-4 text-amber-500" /> : ""}
                  </TableCell>
                  <TableCell>
                    {m.trial_ends_at ? format(new Date(m.trial_ends_at), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell>{statusBadge(m.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.source || "—"}</TableCell>
                  <TableCell>{format(new Date(m.joined_at), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CircleMemberDrawer member={openMember} onClose={() => setOpenMember(null)} />
      <CircleBriefingComposer open={briefingOpen} onClose={() => setBriefingOpen(false)} />
      <CircleFoundingInviteComposer open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}