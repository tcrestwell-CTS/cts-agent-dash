// ═══════════════════════════════════════════════════════════════

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Panel, PanelBody } from "@/components/patterns/Panel";
import { SemanticStatusPill } from "@/components/patterns/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useApprovalTasks, useApproveTask, useRejectTask, ApprovalTask } from "@/hooks/useRecon";
import { useAuth } from "@/contexts/AuthContext";

const ACTION_LABELS: Record<string, string> = {
  create_qbo_payment:     "Create QBO Payment",
  create_qbo_deposit:     "Create QBO Deposit",
  create_qbo_billpayment: "Create QBO Bill Payment",
  create_qbo_invoice:     "Create QBO Invoice",
  create_qbo_customer:    "Create QBO Customer",
  manual_match:           "Manual Match",
  mark_duplicate:         "Mark as Duplicate",
};

function TaskDetail({ task }: { task: ApprovalTask }) {
  const payload = task.action_payload as Record<string, unknown> | null;
  if (!payload) return null;

  return (
    <div className="space-y-3 text-sm">
      <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-auto max-h-48">
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </div>
      {task.requires_admin && (
        <div className="flex items-center gap-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          Admin approval required — transaction exceeds approval threshold
        </div>
      )}
    </div>
  );
}

export function ReconApprovals() {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useApprovalTasks("pending");
  const approve = useApproveTask();
  const reject = useRejectTask();

  const [selected, setSelected] = useState<ApprovalTask | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalTask | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async (task: ApprovalTask) => {
    await approve.mutateAsync({
      taskId: task.id,
      approvedBy: user?.id || "",
      approvedByEmail: user?.email || "",
    });
    if (selected?.id === task.id) setSelected(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-[18px]">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.025em] text-foreground">
            <ShieldCheck className="h-4 w-4 text-info" />
            Approval Center
          </h1>
          <p className="text-[13.5px] text-muted-foreground">
            Review and approve proposed QBO writes — nothing posts without your sign-off
          </p>
        </div>

        {!isLoading && tasks?.length === 0 && (
          <Panel>
            <PanelBody className="py-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
              <p className="text-[14px] font-medium text-foreground">No pending approvals</p>
              <p className="mt-1 text-[13px] text-muted-foreground">All proposed QBO writes have been reviewed</p>
            </PanelBody>
          </Panel>
        )}

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Panel key={i}><PanelBody><Skeleton className="h-16 w-full" /></PanelBody></Panel>
            ))
          ) : (
            tasks?.map((task) => (
              <Panel
                key={task.id}
                className={`transition-shadow hover:shadow-md ${task.requires_admin ? "border-warning/40" : ""}`}
              >
                <PanelBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SemanticStatusPill status="info" label={ACTION_LABELS[task.action_type] || task.action_type} />
                        {task.requires_admin && (
                          <SemanticStatusPill status="warning" label="Admin Required" />
                        )}
                      </div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground truncate">
                        Amount: ${String((task.action_payload as Record<string, unknown>)?.TotalAmt ?? "—")}
                        {" · "}
                        Date: {(((task.action_payload as Record<string, unknown>)?.TxnDate as string) ?? "—")}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {format(new Date(task.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(selected?.id === task.id ? null : task)}
                      >
                        <ChevronRight className={`h-4 w-4 transition-transform ${selected?.id === task.id ? "rotate-90" : ""}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => { setRejecting(task); setRejectReason(""); }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={approve.isPending}
                        onClick={() => handleApprove(task)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Approve & Post
                      </Button>
                    </div>
                  </div>

                  {selected?.id === task.id && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.13em] text-muted-foreground">QBO Payload Preview</p>
                      <TaskDetail task={task} />
                    </div>
                  )}
                </PanelBody>
              </Panel>
            ))
          )}
        </div>

        {/* Reject Dialog */}
        <Dialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Approval Task</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Reason for rejection (required)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={async () => {
                  if (!rejecting) return;
                  await reject.mutateAsync({ taskId: rejecting.id, reason: rejectReason });
                  setRejecting(null);
                }}
              >
                Reject Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default ReconApprovals;


// ═══════════════════════════════════════════════════════════════
