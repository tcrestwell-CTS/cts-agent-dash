import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data, error } = await supabase.rpc("get_proposal", { p_token: token });
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        setProposal(null);
      } else {
        setProposal(row as Proposal);
        setApproved(["approved", "converted"].includes(String(row.proposal_status)));
        supabase.rpc("mark_proposal_viewed", { p_token: token });
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token]);

  const handleApprove = async () => {
    if (!token) return;
    setApproving(true);
    const { error } = await supabase.rpc("approve_proposal", {
      p_token: token,
      p_option: proposal?.selected_option ?? "primary",
    });
    setApproving(false);
    if (error) {
      toast.error("We couldn't record your approval. Please contact your advisor.");
      return;
    }
    setApproved(true);
    toast.success("Thank you! Your advisor has been notified.");
  };

  const expired =
    proposal?.proposal_expires_at
      ? new Date(proposal.proposal_expires_at).getTime() < Date.now()
      : false;

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
              <CardTitle className="text-2xl">
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
                  <div>Pricing held through: {new Date(proposal.proposal_expires_at).toLocaleDateString()}</div>
                )}
              </div>

              <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                {proposal.proposal_draft}
              </div>

              {approved ? (
                <div className="rounded-md border border-border bg-muted p-4 text-sm">
                  You've approved this proposal. Your advisor will be in touch with next steps.
                </div>
              ) : expired ? (
                <div className="rounded-md border border-border bg-muted p-4 text-sm">
                  This pricing has expired. Contact your advisor for a refreshed quote.
                </div>
              ) : (
                <Button onClick={handleApprove} disabled={approving} size="lg">
                  {approving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Approve this proposal
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProposalView;
