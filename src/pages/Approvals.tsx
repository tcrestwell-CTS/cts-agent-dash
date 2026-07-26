import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useProposedActions, type ProposedAction } from "@/hooks/useProposedActions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelHeader, PanelBody, EmptyState } from "@/components/patterns/Panel";
import { SemanticStatusPill, type SemanticStatus } from "@/components/patterns/StatusPill";
import { formatDistanceToNow } from "date-fns";
import { Check, X, Bot, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const AGENT_LABEL: Record<string, string> = {
  tiara: "Tiara",
  richard: "Richard",
  terrance: "Terrance",
  ashley: "Ashley",
  kandi: "Kandi",
  iris: "Iris",
};

const STATUS_SEMANTIC: Record<string, SemanticStatus> = {
  pending: "warning",
  applied: "success",
  auto_applied: "success",
  rejected: "muted",
  failed: "destructive",
};

export default function Approvals() {
  const [status, setStatus] = useState<string>("pending");
  const { actions, isLoading, decide } = useProposedActions({ status });

  const handle = async (a: ProposedAction, decision: "approve" | "reject") => {
    try {
      await decide.mutateAsync({ id: a.id, decision });
      toast({
        title: decision === "approve" ? "Applied" : "Rejected",
        description: a.summary,
      });
    } catch (e) {
      toast({
        title: "Failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.025em] text-foreground">Approvals</h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            Actions your AI agents want to take. Approve, reject, or let them act on their own.
          </p>
        </div>

        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="pending" className="text-[13px]">Pending</TabsTrigger>
            <TabsTrigger value="applied" className="text-[13px]">Applied</TabsTrigger>
            <TabsTrigger value="rejected" className="text-[13px]">Rejected</TabsTrigger>
            <TabsTrigger value="failed" className="text-[13px]">Failed</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-[11px]" />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <Panel>
            <PanelBody>
              <EmptyState
                title={`No ${status} actions`}
                message="Agent-proposed actions will show up here when there's something to review."
              />
            </PanelBody>
          </Panel>
        ) : (
          <div className="space-y-3">
            {actions.map((a) => (
              <Panel key={a.id}>
                <PanelHeader
                  title={a.summary}
                  actions={
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  }
                />
                <PanelBody className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-[20px] border border-border px-[9px] py-[2px] text-[11.5px] font-medium capitalize text-muted-foreground">
                      <Bot className="h-3 w-3" />
                      {AGENT_LABEL[a.agent_name] ?? a.agent_name}
                    </span>
                    <SemanticStatusPill status={STATUS_SEMANTIC[a.status] ?? "muted"} label={a.status} />
                    <span className="text-[12px] capitalize text-muted-foreground">
                      {a.action_type.split("_").join(" ")}
                    </span>
                    {typeof a.confidence === "number" && (
                      <span className="text-[12px] text-muted-foreground">
                        · {Math.round(a.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  {a.reasoning && (
                    <p className="text-[13px] text-muted-foreground">{a.reasoning}</p>
                  )}
                  {a.proposed_changes && Object.keys(a.proposed_changes).length > 0 && (
                    <pre className="overflow-x-auto rounded-[9px] bg-card-2 px-3 py-2 text-[12px]">
                      {JSON.stringify(a.proposed_changes, null, 2)}
                    </pre>
                  )}
                  {a.source && (
                    <p className="text-[12px] text-muted-foreground">Source: {a.source}</p>
                  )}
                  {a.error_message && (
                    <div className="flex items-start gap-2 rounded-[9px] border border-destructive/30 bg-destructive/5 p-2 text-[12px] text-destructive">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{a.error_message}</span>
                    </div>
                  )}
                  {a.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handle(a, "approve")}
                        disabled={decide.isPending}
                        className="text-[13px]"
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve & apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handle(a, "reject")}
                        disabled={decide.isPending}
                        className="text-[13px]"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}