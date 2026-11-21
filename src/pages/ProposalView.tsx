import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { toast } from "sonner";

interface Proposal {
  first_name: string | null;
  destination: string | null;
  departure_date: string | null;
  trip_type: string | null;
  travelers_adults: number | null;
  travelers_children: number | null;
  proposal_draft: string | null;
  proposal_options: unknown;
  proposal_status: string | null;
  proposal_expires_at: string | null;
  selected_option: string | null;
}

const ProposalView = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const approvalInFlight = useRef<string | null>(null);
  const currentToken = useRef(token);
  currentToken.current = token;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setProposal(null);
    setApproved(false);
    setApproving(false);
    setApprovalError(null);
    (async () => {
      if (!token) { setLoading(false); return; }
      try {
        const { data, error } = await supabase.rpc("get_proposal", { p_token: token });
        if (!active) return;
        const row = Array.isArray(data) ? data[0] : null;
        if (!error && row) {
          setProposal(row as Proposal);
          setApproved(["approved", "converted"].includes(String(row.proposal_status)));
          if (["sent", "viewed"].includes(String(row.proposal_status))) {
            void supabase.rpc("mark_proposal_viewed", { p_token: token }).then(() => {}, () => {});
          }
        }
      } catch {
        if (active) setProposal(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const handleApprove = async () => {
    if (!token || !proposal || approved || approvalInFlight.current === token) return;
    approvalInFlight.current = token;
    setApproving(true);
    setApprovalError(null);
    try {
      const { data, error } = await supabase.rpc("approve_proposal", {
        p_token: token,
        p_option: proposal.selected_option ?? "primary",
      });
      if (currentToken.current !== token) return;
      if (error) throw error;
      if (data === "expired") {
        setProposal((previous) => previous ? { ...previous, proposal_status: "expired" } : null);
        return;
      }
      if (data === "not_found") {
        setProposal(null);
        return;
      }
      if (data !== "approved" && data !== "already_approved") throw new Error("Approval not recorded");
      setApproved(true);
      setProposal((previous) => previous ? { ...previous, proposal_status: "approved" } : null);
      toast.success("Your proposal approval has been recorded.");
    } catch {
      if (currentToken.current !== token) return;
      const message = "We couldn't record your approval. Please try again or contact your advisor.";
      setApprovalError(message);
      toast.error(message);
    } finally {
      if (approvalInFlight.current === token) approvalInFlight.current = null;
      if (currentToken.current === token) setApproving(false);
    }
  };

  const expired =
    proposal?.proposal_status === "expired" || (proposal?.proposal_expires_at
      ? parseLocalDate(proposal.proposal_expires_at).getTime() < Date.now()
      : false);

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <Helmet>
        <title>Your Travel Proposal | Crestwell Travels</title>
        <meta name="description" content="View and approve your personalized travel proposal from your Crestwell travel advisor." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="mx-auto w-full max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your proposal…
          </div>
        ) : !proposal ? (
          <Card>
            <CardHeader>
              <CardTitle>Proposal not found</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>This proposal link is no longer valid or has expired.</p>
              <p>Please reach out to your travel advisor for an updated link.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl break-words">
                {proposal.first_name ? `${proposal.first_name}, ` : ""}your proposal for{" "}
                {proposal.destination ?? "your trip"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                {proposal.departure_date && <div>Departure: {proposal.departure_date}</div>}
                {proposal.trip_type && <div>Trip type: {proposal.trip_type}</div>}
                {(proposal.travelers_adults ?? 0) > 0 && (
                  <div>
                    Travelers: {proposal.travelers_adults} adult
                    {(proposal.travelers_adults ?? 0) > 1 ? "s" : ""}
                    {(proposal.travelers_children ?? 0) > 0
                      ? `, ${proposal.travelers_children} child${(proposal.travelers_children ?? 0) > 1 ? "ren" : ""}`
                      : ""}
                  </div>
                )}
                {proposal.proposal_expires_at && (
                  <div>Pricing held through: {parseLocalDate(proposal.proposal_expires_at).toLocaleDateString()}</div>
                )}
              </div>

              <div className="whitespace-pre-wrap break-words leading-relaxed text-foreground">
                {proposal.proposal_draft}
              </div>

              {approved ? (
                <div role="status" aria-live="polite" className="rounded-md border border-border bg-muted p-4 space-y-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
                    Proposal approved
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Your advisor will confirm availability and contact you with the next steps.
                  </p>
                </div>
              ) : expired ? (
                <div className="rounded-md border border-border bg-muted p-4 text-sm">
                  This pricing has expired. Contact your advisor for a refreshed quote.
                </div>
              ) : (
                <div className="space-y-3">
                  {approvalError && <p role="alert" className="text-sm text-destructive">{approvalError}</p>}
                  <Button onClick={handleApprove} disabled={approving} size="lg" className="h-auto min-h-11 w-full whitespace-normal sm:w-auto">
                    {approving && <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin mr-2" />}
                    Approve this proposal
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProposalView;
