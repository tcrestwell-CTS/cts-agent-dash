import { useMemo, useState } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmailActivityFilters } from "@/components/email/EmailActivityFilters";
import { EmailActivityStats } from "@/components/email/EmailActivityStats";
import { EmailActivityChart } from "@/components/email/EmailActivityChart";
import { EmailActivityTable } from "@/components/email/EmailActivityTable";
import {
  useEmailActivity,
  useEmailActivityStats,
  useEmailTemplatesList,
} from "@/hooks/useEmailActivity";
import { exportToCSV } from "@/lib/csvExport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function EmailActivity() {
  const [from, setFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 6)));
  const [to, setTo] = useState<Date>(() => endOfDay(new Date()));
  const [template, setTemplate] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      from,
      to,
      templates: template === "all" ? undefined : [template],
      statuses: status === "all" ? undefined : [status],
      search: search.trim() || undefined,
    }),
    [from, to, template, status, search]
  );

  const { data: templates = [] } = useEmailTemplatesList();
  const { data: stats } = useEmailActivityStats(filters);
  const { data: activity, isLoading } = useEmailActivity(filters, page);

  const handleFilterChange = (next: { from: Date; to: Date; template: string; status: string; search: string }) => {
    setFrom(next.from);
    setTo(next.to);
    setTemplate(next.template);
    setStatus(next.status);
    setSearch(next.search);
    setPage(0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let q = supabase
        .from("email_logs")
        .select("created_at,template,to_email,subject,status,attempt_count,error_message,provider_message_id")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);
      if (filters.templates) q = q.in("template", filters.templates);
      if (filters.statuses) q = q.in("status", filters.statuses);
      const { data, error } = await q;
      if (error) throw error;
      exportToCSV(data ?? [], `email-activity-${Date.now()}.csv`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              Email Activity
            </h1>
            <p className="text-sm text-muted-foreground">
              Sends, failures, and retries across all email templates.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <EmailActivityFilters
          from={from}
          to={to}
          template={template}
          status={status}
          search={search}
          templates={templates}
          onChange={handleFilterChange}
        />

        <EmailActivityStats
          total={stats?.total ?? 0}
          sent={stats?.sent ?? 0}
          failed={stats?.failed ?? 0}
          retries={stats?.retries ?? 0}
          successRate={stats?.successRate ?? 0}
        />

        <EmailActivityChart data={stats?.series ?? []} />

        <EmailActivityTable
          rows={activity?.rows ?? []}
          loading={isLoading}
          page={page}
          pageSize={activity?.pageSize ?? 25}
          total={activity?.total ?? 0}
          onPageChange={setPage}
        />
      </div>
    </DashboardLayout>
  );
}