import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TripStatus {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_STATUSES = [
  { name: "Inbound", color: "#f59e0b", sort_order: 0 },
  { name: "Planning", color: "#3b82f6", sort_order: 1 },
  { name: "Proposal Sent", color: "#f97316", sort_order: 2 },
  { name: "Deposit Authorized", color: "#8b5cf6", sort_order: 3 },
  { name: "Deposit Paid", color: "#10b981", sort_order: 4 },
  { name: "Final Paid", color: "#059669", sort_order: 5 },
  { name: "Booked", color: "#22c55e", sort_order: 6 },
  { name: "Traveling", color: "#a855f7", sort_order: 7 },
  { name: "Traveled", color: "#6b7280", sort_order: 8 },
  { name: "Commission Pending", color: "#d97706", sort_order: 9 },
  { name: "Commission Received", color: "#16a34a", sort_order: 10 },
  { name: "Cancelled", color: "#ef4444", sort_order: 11 },
  { name: "Archived", color: "#64748b", sort_order: 12 },
];

// Statuses that map to "planning" on the kanban board
// These are internal workflow indicators, not separate kanban columns
const KANBAN_PLANNING_STATUSES = new Set([
  "proposal_sent",
  "option_selected",
  "deposit_authorized",
  "deposit_paid",
  "final_paid",
  "booked",
]);

// Only these statuses get their own kanban columns
const KANBAN_COLUMN_SLUGS = new Set([
  "inbound",
  "planning",
  "traveling",
  "traveled",
  "commission_pending",
  "commission_received",
  "cancelled",
  "archived",
]);

// Map old hardcoded status ids to display names for backward compat
const LEGACY_STATUS_MAP: Record<string, string> = {
  inbound: "Inbound",
  planning: "Planning",
  proposal_sent: "Proposal Sent",
  option_selected: "Planning",
  deposit_authorized: "Deposit Authorized",
  deposit_paid: "Deposit Paid",
  final_paid: "Final Paid",
  booked: "Booked",
  traveling: "Traveling",
  traveled: "Traveled",
  completed: "Traveled",
  commission_pending: "Commission Pending",
  commission_received: "Commission Received",
  cancelled: "Cancelled",
  archived: "Archived",
};

export function useTripStatuses() {
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<TripStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchStatuses = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("trip_statuses")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const list = (data as TripStatus[]) || [];
      if (list.length === 0 && !seeding) {
        await seedDefaults();
        return;
      }
      setStatuses(list);
    } catch (err) {
      console.error("Error fetching trip statuses:", err);
    } finally {
      setLoading(false);
    }
  }, [user, seeding]);

  const seedDefaults = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const rows = DEFAULT_STATUSES.map((s) => ({
        user_id: user.id,
        name: s.name,
        color: s.color,
        sort_order: s.sort_order,
        is_default: true,
      }));
      const { error } = await supabase.from("trip_statuses").insert(rows as any);
      if (error) throw error;
      await fetchStatuses();
    } catch (err) {
      console.error("Error seeding default statuses:", err);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const addStatus = async (name: string, color: string = "#6366f1") => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from("trip_statuses")
        .insert({ user_id: user.id, name, color, sort_order: statuses.length } as any)
        .select()
        .single();
      if (error) throw error;
      toast.success(`Status "${name}" added`);
      await fetchStatuses();
      return data as TripStatus;
    } catch (err: any) {
      if (err?.code === "23505") {
        toast.error("A status with that name already exists");
      } else {
        toast.error("Failed to add status");
      }
      return null;
    }
  };

  const renameStatus = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("trip_statuses")
        .update({ name } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("Status renamed");
      await fetchStatuses();
      return true;
    } catch (err: any) {
      if (err?.code === "23505") {
        toast.error("A status with that name already exists");
      } else {
        toast.error("Failed to rename status");
      }
      return false;
    }
  };

  const updateStatusColor = async (id: string, color: string) => {
    try {
      const { error } = await supabase
        .from("trip_statuses")
        .update({ color } as any)
        .eq("id", id);
      if (error) throw error;
      await fetchStatuses();
      return true;
    } catch {
      toast.error("Failed to update color");
      return false;
    }
  };

  const deleteStatus = async (id: string) => {
    try {
      const { error } = await supabase
        .from("trip_statuses")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Status deleted");
      await fetchStatuses();
      return true;
    } catch {
      toast.error("Failed to delete status");
      return false;
    }
  };

  const reorderStatuses = async (reordered: TripStatus[]) => {
    setStatuses(reordered); // optimistic
    try {
      for (let i = 0; i < reordered.length; i++) {
        await supabase
          .from("trip_statuses")
          .update({ sort_order: i } as any)
          .eq("id", reordered[i].id);
      }
      await fetchStatuses();
    } catch {
      toast.error("Failed to reorder");
      await fetchStatuses();
    }
  };

  // Convert a status name to a slug for storing on trips
  const statusToSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "_");

  // Get the display label for a trip's status slug
  const getStatusLabel = (slug: string) => {
    const found = statuses.find((s) => statusToSlug(s.name) === slug);
    if (found) return found.name;
    return LEGACY_STATUS_MAP[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
  };

  // Get color for a status slug
  const getStatusColor = (slug: string) => {
    const found = statuses.find((s) => statusToSlug(s.name) === slug);
    return found?.color || "#6366f1";
  };

  // Build kanban columns from statuses — only columns that are kanban-visible
  const kanbanColumns = statuses
    .filter((s) => KANBAN_COLUMN_SLUGS.has(statusToSlug(s.name)))
    .map((s) => ({
      id: statusToSlug(s.name),
      label: s.name,
      color: s.color,
      statusId: s.id,
    }));

  // Map any trip status slug to the kanban column it belongs to
  // Intermediate workflow statuses (proposal_sent → booked) all map to "planning"
  const getKanbanStatus = (slug: string): string => {
    if (KANBAN_PLANNING_STATUSES.has(slug)) return "planning";
    return slug;
  };

  return {
    statuses,
    loading: loading || seeding,
    kanbanColumns,
    addStatus,
    renameStatus,
    updateStatusColor,
    deleteStatus,
    reorderStatuses,
    statusToSlug,
    getStatusLabel,
    getStatusColor,
    getKanbanStatus,
    refetch: fetchStatuses,
  };
}
