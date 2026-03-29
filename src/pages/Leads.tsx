import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Phone, Mail, RefreshCw, Brain, Users, DollarSign, Calendar, MapPin, MessageSquare, ArrowUpDown, UserPlus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type QuoteRequest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  trip_type: string;
  destination: string | null;
  departure_date: string | null;
  flexibility: string | null;
  travelers_adults: number;
  travelers_children: number;
  budget: string | null;
  message: string | null;
  status: string | null;
  ai_score: number | null;
  ai_stage: string | null;
  ai_summary: string | null;
  ai_tags: string[] | null;
  ai_next_action: string | null;
  ai_processed_at: string | null;
  wants_financing: boolean | null;
  created_at: string | null;
};

const stageConfig: Record<string, { color: string; label: string }> = {
  "Qualified": { color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", label: "Qualified" },
  "Quote Needed": { color: "bg-amber-500/15 text-amber-700 border-amber-500/30", label: "Quote Needed" },
  "Call Needed": { color: "bg-orange-500/15 text-orange-700 border-orange-500/30", label: "Call Needed" },
  "new": { color: "bg-muted text-muted-foreground border-border", label: "New" },
};

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "date">("date");
  const [requalifyingId, setRequalifyingId] = useState<string | null>(null);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ["leads-quote-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as QuoteRequest[];
    },
  });

  const requalify = async (leadId: string) => {
    setRequalifyingId(leadId);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await supabase.functions.invoke("qualify-lead", {
        body: { lead_id: leadId },
      });
      clearTimeout(timeout);
      if (res.error) throw res.error;
      toast.success("Lead re-qualified successfully");
      refetch();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        toast.error("Qualification timed out — try again");
      } else {
        toast.error("Failed to qualify lead");
      }
    } finally {
      setRequalifyingId(null);
    }
  };

  const addToClients = async (lead: QuoteRequest) => {
    if (!user) return;
    try {
      const name = `${lead.first_name} ${lead.last_name}`.trim();
      const { error } = await supabase.from("clients").insert({
        user_id: user.id,
        name,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        lead_source: "Website",
        status: "lead",
        notes: [
          lead.ai_summary,
          lead.destination ? `Destination: ${lead.destination}` : null,
          lead.trip_type ? `Trip type: ${lead.trip_type}` : null,
          lead.budget ? `Budget: ${lead.budget}` : null,
        ].filter(Boolean).join("\n"),
      });
      if (error) throw error;
      toast.success(`${name} added to Contacts`);
    } catch {
      toast.error("Failed to add client");
    }
  };

  const filtered = leads
    .filter((l) => {
      if (stageFilter !== "all") {
        const stage = l.ai_stage || "new";
        if (stageFilter === "new" && l.ai_stage !== null) return false;
        if (stageFilter !== "new" && stage !== stageFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.destination || "").toLowerCase().includes(q) ||
          (l.trip_type || "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.ai_score ?? 0) - (a.ai_score ?? 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const counts = {
    total: leads.length,
    qualified: leads.filter((l) => l.ai_stage === "Qualified").length,
    quoteNeeded: leads.filter((l) => l.ai_stage === "Quote Needed").length,
    callNeeded: leads.filter((l) => l.ai_stage === "Call Needed").length,
    unscored: leads.filter((l) => !l.ai_stage).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground">AI-qualified travel inquiries from your quote form</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: counts.total, icon: Users },
            { label: "Qualified", value: counts.qualified, icon: Brain },
            { label: "Quote Needed", value: counts.quoteNeeded, icon: DollarSign },
            { label: "Call Needed", value: counts.callNeeded, icon: Phone },
            { label: "Unscored", value: counts.unscored, icon: RefreshCw },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="Qualified">Qualified</SelectItem>
              <SelectItem value="Quote Needed">Quote Needed</SelectItem>
              <SelectItem value="Call Needed">Call Needed</SelectItem>
              <SelectItem value="new">Unscored</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setSortBy(sortBy === "score" ? "date" : "score")}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === "score" ? "By Score" : "By Date"}
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Trip</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden lg:table-cell">AI Summary</TableHead>
                  <TableHead className="hidden md:table-cell">Next Action</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading leads...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No leads found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => {
                    const stage = lead.ai_stage || "new";
                    const cfg = stageConfig[stage] || stageConfig["new"];
                    return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                            <p className="text-xs text-muted-foreground">{lead.email}</p>
                            {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {lead.destination || "—"}
                            </div>
                            <p className="text-xs text-muted-foreground">{lead.trip_type}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{lead.travelers_adults}A {lead.travelers_children > 0 ? `${lead.travelers_children}C` : ""}</span>
                              {lead.budget && <span>· {lead.budget}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><ScoreBar score={lead.ai_score} /></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                          {lead.wants_financing && (
                            <Badge variant="outline" className="ml-1 bg-violet-500/15 text-violet-700 border-violet-500/30 text-[10px]">$</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px]">
                          <p className="text-xs text-muted-foreground truncate">{lead.ai_summary || "—"}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px]">
                          <p className="text-xs text-muted-foreground truncate">{lead.ai_next_action || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {lead.created_at ? format(new Date(lead.created_at), "MMM d") : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                  <a href={`mailto:${lead.email}`}><Mail className="h-3.5 w-3.5" /></a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Email</TooltipContent>
                            </Tooltip>
                            {lead.phone && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                    <a href={`tel:${lead.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Call</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={requalifyingId === lead.id}
                                  onClick={() => requalify(lead.id)}
                                >
                                  {requalifyingId === lead.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Brain className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Re-qualify with AI</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addToClients(lead)}>
                                  <UserPlus className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Add to Contacts</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
