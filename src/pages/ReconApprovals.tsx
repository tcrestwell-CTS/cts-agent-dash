// ═══════════════════════════════════════════════════════════════

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-200 rounded p-2 text-xs">
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
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Approval Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and approve proposed QBO writes — nothing posts without your sign-off
          </p>
        </div>

        {!isLoading && tasks?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <p className="font-medium">No pending approvals</p>
              <p className="text-sm text-muted-foreground mt-1">All proposed QBO writes have been reviewed</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : (
            tasks?.map((task) => (
              <Card
                key={task.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${task.requires_admin ? "border-orange-200" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                          {ACTION_LABELS[task.action_type] || task.action_type}
                        </Badge>
                        {task.requires_admin && (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
                            Admin Required
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground truncate">
                        Amount: ${(task.action_payload as Record<string, unknown>)?.TotalAmt ?? "—"}
                        {" · "}
                        Date: {(task.action_payload as Record<string, unknown>)?.TxnDate as string ?? "—"}
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
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => { setRejecting(task); setRejectReason(""); }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">QBO Payload Preview</p>
                      <TaskDetail task={task} />
                    </div>
                  )}
                </CardContent>
              </Card>
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
