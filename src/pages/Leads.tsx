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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Phone, Mail, RefreshCw, Brain, Users, DollarSign, Calendar, MapPin, MessageSquare, ArrowUpDown, UserPlus, Loader2, CheckCircle, Info, Send, Copy, Link2, Trash2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// Simple Markdown to HTML converter for proposal preview
function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const cells = row.split('|').map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, (m) => `<table class="border-collapse w-full">${m}</table>`)
    .replace(/\|[-:]+\|/g, '')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)/, '<p>$1')
    .replace(/(.+)$/, '$1</p>');
}

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
  proposal_draft: string | null;
  proposal_status: string | null;
  proposal_token: string | null;
  proposal_sent_at: string | null;
  proposal_viewed_at: string | null;
  proposal_approved_at: string | null;
  proposal_expires_at: string | null;
  selected_option: string | null;
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

function LeadProposalSheet({
  lead,
  onClose,
  onRequalify,
  onAddToClients,
  onDelete,
  requalifyingId,
  refetch,
}: {
  lead: QuoteRequest | null;
  onClose: () => void;
  onRequalify: (id: string) => void;
  onAddToClients: (lead: QuoteRequest) => void;
  onDelete: (id: string) => void;
  requalifyingId: string | null;
  refetch: () => void;
}) {
  const [markingContacted, setMarkingContacted] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [sentLink, setSentLink] = useState<string | null>(null);

  if (!lead) return null;

  const stage = lead.ai_stage || "new";
  const cfg = stageConfig[stage] || stageConfig["new"];

  const handleMarkContacted = async () => {
    setMarkingContacted(true);
    try {
      await supabase
        .from("quote_requests")
        .update({ status: "contacted" })
        .eq("id", lead.id);
      toast.success("Lead marked as contacted");
      refetch();
    } catch {
      toast.error("Failed to update lead");
    } finally {
      setMarkingContacted(false);
    }
  };

  const hasProposal = lead.proposal_draft && (lead.proposal_status === "draft" || lead.proposal_status === "draft_ready" || lead.proposal_status === "sent" || lead.proposal_status === "quote_sent");
  const needsCall = !lead.proposal_draft && lead.ai_stage === "Call Needed";
  const canGenerate = !lead.proposal_draft && (lead.ai_stage === "Quote Needed" || lead.ai_stage === "Qualified");
  const canApproveQuote = (lead.proposal_status === "draft" || lead.proposal_status === "draft_ready") && lead.proposal_draft;
  const quoteAlreadySent = lead.proposal_status === "quote_sent";

  const propStatus = lead.proposal_status || "draft";
  const proposalDecided = propStatus === "approved" || propStatus === "converted";
  const canSendProposal = !!(lead.proposal_draft && lead.proposal_draft.trim()) && !proposalDecided;
  const proposalStatusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    draft_ready: "bg-muted text-muted-foreground border-border",
    sent: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    quote_sent: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    viewed: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
    approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    converted: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  };
  const proposalStatusLabel: Record<string, string> = {
    draft: "Draft",
    draft_ready: "Draft Ready",
    sent: "Sent",
    quote_sent: "Sent",
    viewed: "Viewed",
    approved: "Approved",
    converted: "Converted",
  };

  const handleCopyQualifyLink = async () => {
    if (!lead.proposal_token) {
      toast.error("No qualify token on this lead");
      return;
    }
    const url = `https://crestwellgetaways.com/qualify/${lead.proposal_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Qualify link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleSendProposal = async () => {
    if (!canSendProposal) return;
    if (!window.confirm(`Email this proposal to ${lead.email}?`)) return;
    setSendingProposal(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("You're signed out — please log in again.");
        return;
      }
      const res = await fetch(
        "https://zbtnulzvwreqzbmxulpv.supabase.co/functions/v1/send-proposal",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ lead_id: lead.id }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        toast.success("Proposal sent ✓");
        setSentLink(json.link || null);
        refetch();
      } else {
        const err = json?.error;
        if (err === "no_draft") toast.error("Generate a proposal before sending.");
        else if (err === "no_email") toast.error("This lead has no email address.");
        else if (err === "already_decided") toast.error(`This proposal was already ${json.proposal_status || "decided"}.`);
        else if (err === "email_failed") toast.error("Email failed to send — check the sender address.");
        else toast.error("Couldn't send — please try again.");
      }
    } catch {
      toast.error("Couldn't send — please try again.");
    } finally {
      setSendingProposal(false);
    }
  };

  const handleCopySentLink = async () => {
    if (!sentLink) return;
    try {
      await navigator.clipboard.writeText(sentLink);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const relTime = (iso: string | null) =>
    iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : null;
  const expiresInFuture =
    lead.proposal_expires_at && new Date(lead.proposal_expires_at) > new Date();

  const handleApproveQuote = async () => {
    if (!lead.id) return;
    setSendingQuote(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("ashley", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      if (result?.success) {
        toast.success(`✅ Ashley sent quote to ${lead.first_name || "client"}`);
        refetch();
      } else {
        toast.error(result?.error || "Ashley failed to send quote");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to invoke Ashley");
    } finally {
      setSendingQuote(false);
    }
  };

  return (
    <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-lg">
            {lead.first_name} {lead.last_name}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 mt-4 overflow-y-auto pb-24">
          {/* Section A — Lead Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
              {(lead.proposal_status === "sent" || lead.proposal_status === "quote_sent") && (
                <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30">Proposal Sent</Badge>
              )}
              {lead.wants_financing && (
                <Badge variant="outline" className="bg-violet-500/15 text-violet-700 border-violet-500/30">Financing</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Email</p>
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline text-sm">{lead.email}</a>
              </div>
              {lead.phone && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <a href={`tel:${lead.phone}`} className="text-primary hover:underline text-sm">{lead.phone}</a>
                </div>
              )}
              {lead.destination && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Destination</p>
                  <p>{lead.destination}</p>
                </div>
              )}
              {lead.departure_date && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Departure</p>
                  <p>{format(new Date(lead.departure_date), "MMM d, yyyy")}</p>
                </div>
              )}
              {lead.budget && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs">Budget</p>
                  <p>{lead.budget}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Travelers</p>
                <p>{lead.travelers_adults} Adults{lead.travelers_children > 0 ? `, ${lead.travelers_children} Children` : ""}</p>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground text-xs mb-1">AI Score</p>
              <ScoreBar score={lead.ai_score} />
            </div>
          </div>

          {/* Section B — AI Summary & Next Action */}
          {(lead.ai_summary || lead.ai_next_action || (lead.ai_tags && lead.ai_tags.length > 0)) && (
            <div className="space-y-3">
              {lead.ai_summary && (
                <Card className="bg-muted/50 border">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">AI Summary</p>
                    <p className="text-sm">{lead.ai_summary}</p>
                  </CardContent>
                </Card>
              )}

              {lead.ai_next_action && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-700 mb-0.5">Next Action</p>
                    <p className="text-sm text-blue-900">{lead.ai_next_action}</p>
                  </div>
                </div>
              )}

              {lead.ai_tags && lead.ai_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lead.ai_tags.map((tag, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section C — Proposal Draft */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Proposal</h3>
              <Badge variant="outline" className={`${proposalStatusColors[propStatus] || proposalStatusColors.draft} text-[10px]`}>
                {proposalStatusLabel[propStatus] || propStatus}
              </Badge>
            </div>

            {/* Proposal delivery status + actions */}
            <Card className="border">
              <CardContent className="p-3 space-y-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  {lead.proposal_sent_at && <div>Sent {relTime(lead.proposal_sent_at)}</div>}
                  {lead.proposal_viewed_at && <div>Viewed {relTime(lead.proposal_viewed_at)}</div>}
                  {lead.proposal_approved_at && (
                    <div>
                      Approved {relTime(lead.proposal_approved_at)}
                      {lead.selected_option ? ` · Selected: ${lead.selected_option}` : ""}
                    </div>
                  )}
                  {expiresInFuture && (
                    <div>Pricing held until {format(new Date(lead.proposal_expires_at!), "MMM d, yyyy")}</div>
                  )}
                  {!lead.proposal_sent_at && !lead.proposal_viewed_at && !lead.proposal_approved_at && !expiresInFuture && (
                    <div>Proposal has not been sent yet.</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!proposalDecided && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="sm"
                            disabled={!canSendProposal || sendingProposal}
                            onClick={handleSendProposal}
                          >
                            {sendingProposal ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {sendingProposal ? "Sending..." : "Send Proposal"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canSendProposal && (
                        <TooltipContent>Generate a proposal first</TooltipContent>
                      )}
                    </Tooltip>
                  )}

                  <Button variant="outline" size="sm" onClick={handleCopyQualifyLink}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    Copy Qualify Link
                  </Button>

                  {sentLink && (
                    <Button variant="ghost" size="sm" onClick={handleCopySentLink}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy Proposal Link
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {hasProposal ? (
              <Card className="border">
                <CardContent className="p-4">
                  <div className="max-h-[40vh] overflow-y-auto">
                    <div
                      className="prose prose-sm max-w-none text-foreground [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h3]:font-semibold [&_table]:text-xs [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left"
                      dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(lead.proposal_draft || "") }}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : canGenerate ? (
              <Card className="border bg-muted/30">
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">No proposal drafted yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={requalifyingId === lead.id}
                    onClick={() => onRequalify(lead.id)}
                  >
                    {requalifyingId === lead.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Brain className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Generate Proposal
                  </Button>
                </CardContent>
              </Card>
            ) : needsCall ? (
              <Card className="border bg-orange-500/5">
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">This lead needs a phone call before a proposal can be drafted.</p>
                  {lead.phone && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${lead.phone}`}>
                        <Phone className="h-3.5 w-3.5 mr-1.5" />
                        Call {lead.phone}
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border bg-muted/30">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No proposal available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background flex flex-wrap items-center gap-2">
          {canApproveQuote && !quoteAlreadySent && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              disabled={sendingQuote}
              onClick={handleApproveQuote}
            >
              {sendingQuote ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <span className="mr-1.5">✅</span>
              )}
              {sendingQuote ? "Sending Quote..." : "Approve & Send Quote to Client"}
            </Button>
          )}
          {quoteAlreadySent && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <span>✓</span> Quote Sent to Client
            </span>
          )}
          <Button variant="outline" size="sm" disabled={markingContacted} onClick={handleMarkContacted}>
            {markingContacted ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
            Mark as Contacted
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAddToClients(lead)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add to Clients
          </Button>
          <Button variant="ghost" size="sm" disabled={requalifyingId === lead.id} onClick={() => onRequalify(lead.id)}>
            {requalifyingId === lead.id ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5 mr-1.5" />
            )}
            Re-qualify
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Leads() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "date">("date");
  const [requalifyingId, setRequalifyingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<QuoteRequest | null>(null);

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

  // Keep selectedLead in sync with latest data
  const activeSelectedLead = selectedLead
    ? leads.find((l) => l.id === selectedLead.id) || selectedLead
    : null;

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
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedLead(lead)}
                      >
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
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

      <LeadProposalSheet
        lead={activeSelectedLead}
        onClose={() => setSelectedLead(null)}
        onRequalify={requalify}
        onAddToClients={addToClients}
        requalifyingId={requalifyingId}
        refetch={refetch}
      />
    </DashboardLayout>
  );
}
