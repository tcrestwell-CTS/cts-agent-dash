import React, { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmailStatusBadge } from "./EmailStatusBadge";
import type { EmailActivityRow } from "@/hooks/useEmailActivity";

interface Props {
  rows: EmailActivityRow[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}

export function EmailActivityTable({ rows, loading, page, pageSize, total, onPageChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drawerRow, setDrawerRow] = useState<EmailActivityRow | null>(null);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Time</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No emails in this range.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <React.Fragment key={r.id}>
                  <TableRow>
                    <TableCell>
                      {r.error_message ? (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggle(r.id)}>
                          {expanded.has(r.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(r.created_at), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.template}</TableCell>
                    <TableCell className="text-sm">{r.to_email}</TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate">{r.subject}</TableCell>
                    <TableCell><EmailStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{r.attempt_count}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDrawerRow(r)}>
                        <Info className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded.has(r.id) && r.error_message ? (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={7} className="bg-muted/40">
                        <p className="text-xs text-red-700 font-mono whitespace-pre-wrap">{r.error_message}</p>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
        <span>
          {total > 0
            ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} of ${total}`
            : "0 results"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>

      <Sheet open={!!drawerRow} onOpenChange={(open) => !open && setDrawerRow(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Email details</SheetTitle>
          </SheetHeader>
          {drawerRow && (
            <div className="mt-4 space-y-3 text-sm">
              <Field label="To" value={drawerRow.to_email} />
              <Field label="Subject" value={drawerRow.subject} />
              <Field label="Template" value={drawerRow.template} mono />
              <Field label="Status" value={drawerRow.status} />
              <Field label="Attempts" value={String(drawerRow.attempt_count)} />
              <Field label="Sent at" value={drawerRow.sent_at ? format(new Date(drawerRow.sent_at), "PPpp") : "—"} />
              <Field label="Created" value={format(new Date(drawerRow.created_at), "PPpp")} />
              <Field label="Provider message ID" value={drawerRow.provider_message_id || "—"} mono />
              {drawerRow.error_message && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Error</p>
                  <pre className="bg-red-50 text-red-700 text-xs p-2 rounded whitespace-pre-wrap">{drawerRow.error_message}</pre>
                </div>
              )}
              {drawerRow.metadata && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Metadata</p>
                  <pre className="bg-muted text-xs p-2 rounded whitespace-pre-wrap">{JSON.stringify(drawerRow.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-xs break-all" : "text-sm break-words"}>{value}</p>
    </div>
  );
}