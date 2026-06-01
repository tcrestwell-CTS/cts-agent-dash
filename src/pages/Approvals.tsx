import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useProposedActions, type ProposedAction } from "@/hooks/useProposedActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  applied: "secondary",
  auto_applied: "secondary",
  rejected: "outline",
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
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
          <p className="text-muted-foreground">
            Actions your AI agents want to take. Approve, reject, or let them act on their own.
          </p>
        </div>

        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="applied">Applied</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="mb-3 h-10 w-10 opacity-50" />
              <p>No {status} actions.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {actions.map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          <Bot className="mr-1 h-3 w-3" />
                          {AGENT_LABEL[a.agent_name] ?? a.agent_name}
                        </Badge>
                        <Badge variant={STATUS_VARIANT[a.status] ?? "default"}>{a.status}</Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {a.action_type.replaceAll("_", " ")}
                        </span>
                        {typeof a.confidence === "number" && (
                          <span className="text-xs text-muted-foreground">
                            · {Math.round(a.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base">{a.summary}</CardTitle>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.reasoning && (
                    <p className="text-sm text-muted-foreground">{a.reasoning}</p>
                  )}
                  {a.proposed_changes && Object.keys(a.proposed_changes).length > 0 && (
                    <pre className="overflow-x-auto rounded bg-muted px-3 py-2 text-xs">
                      {JSON.stringify(a.proposed_changes, null, 2)}
                    </pre>
                  )}
                  {a.source && (
                    <p className="text-xs text-muted-foreground">Source: {a.source}</p>
                  )}
                  {a.error_message && (
                    <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
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
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve & apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handle(a, "reject")}
                        disabled={decide.isPending}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}