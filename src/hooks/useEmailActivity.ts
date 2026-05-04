import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailActivityRow {
  id: string;
  to_email: string;
  subject: string;
  template: string;
  status: string;
  attempt_count: number;
  provider_message_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailActivityFilters {
  from: Date;
  to: Date;
  templates?: string[];
  statuses?: string[];
  search?: string;
}

const PAGE_SIZE = 25;

export function useEmailActivity(filters: EmailActivityFilters, page: number) {
  return useQuery({
    queryKey: ["email-activity", filters, page],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select("*", { count: "exact" })
        .gte("created_at", filters.from.toISOString())
        .lte("created_at", filters.to.toISOString())
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (filters.templates && filters.templates.length > 0) {
        query = query.in("template", filters.templates);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }
      if (filters.search) {
        query = query.or(
          `to_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        rows: (data ?? []) as EmailActivityRow[],
        total: count ?? 0,
        pageSize: PAGE_SIZE,
      };
    },
  });
}

export function useEmailActivityStats(filters: EmailActivityFilters) {
  return useQuery({
    queryKey: ["email-activity-stats", filters],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select("status,attempt_count,created_at,template")
        .gte("created_at", filters.from.toISOString())
        .lte("created_at", filters.to.toISOString());

      if (filters.templates && filters.templates.length > 0) {
        query = query.in("template", filters.templates);
      }

      const { data, error } = await query.limit(10000);
      if (error) throw error;

      const rows = data ?? [];
      const total = rows.length;
      const sent = rows.filter((r) => r.status === "sent").length;
      const failed = rows.filter((r) => r.status === "failed").length;
      const retries = rows.reduce(
        (acc, r) => acc + Math.max(0, (r.attempt_count ?? 1) - 1),
        0
      );
      const successRate = total > 0 ? (sent / total) * 100 : 0;

      // Daily timeseries
      const buckets = new Map<string, { date: string; sent: number; failed: number }>();
      for (const r of rows) {
        const day = new Date(r.created_at).toISOString().slice(0, 10);
        if (!buckets.has(day)) buckets.set(day, { date: day, sent: 0, failed: 0 });
        const b = buckets.get(day)!;
        if (r.status === "sent") b.sent += 1;
        else if (r.status === "failed") b.failed += 1;
      }
      const series = Array.from(buckets.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      return { total, sent, failed, retries, successRate, series };
    },
  });
}

export function useEmailTemplatesList() {
  return useQuery({
    queryKey: ["email-templates-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("template")
        .limit(1000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r) => r.template && set.add(r.template));
      return Array.from(set).sort();
    },
    staleTime: 5 * 60 * 1000,
  });
}