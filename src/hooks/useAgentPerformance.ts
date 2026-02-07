import { useMemo } from "react";
import { useBookings } from "@/hooks/useBookings";
import { useClients } from "@/hooks/useClients";
import { useCommissions } from "@/hooks/useCommissions";
import { useTeamProfiles, TeamProfile } from "@/hooks/useTeamProfiles";

export interface AgentStats {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  totalBookings: number;
  totalRevenue: number;
  totalClients: number;
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  avgBookingValue: number;
  conversionRate: number;
}

export function useAgentPerformance() {
  const { data: profiles, isLoading: profilesLoading } = useTeamProfiles();
  const { bookings, loading: bookingsLoading } = useBookings();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: commissions, isLoading: commissionsLoading } = useCommissions();

  const loading = profilesLoading || bookingsLoading || clientsLoading || commissionsLoading;

  const agentStats = useMemo(() => {
    if (!profiles || !bookings || !clients || !commissions) {
      return [];
    }

    const stats: AgentStats[] = profiles.map((profile: TeamProfile) => {
      // Filter data by agent
      const agentBookings = bookings.filter(b => b.user_id === profile.user_id && b.status !== "cancelled");
      const agentClients = clients.filter(c => c.user_id === profile.user_id);
      const agentCommissions = commissions.filter(c => c.user_id === profile.user_id);

      const totalRevenue = agentBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const pendingCommissions = agentCommissions
        .filter(c => c.status === "pending")
        .reduce((sum, c) => sum + (c.amount || 0), 0);
      const paidCommissions = agentCommissions
        .filter(c => c.status === "paid")
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      // Calculate conversion rate (clients with bookings / total clients)
      const clientsWithBookings = new Set(agentBookings.map(b => b.client_id)).size;
      const conversionRate = agentClients.length > 0 
        ? (clientsWithBookings / agentClients.length) * 100 
        : 0;

      return {
        userId: profile.user_id,
        fullName: profile.full_name || "Unknown Agent",
        avatarUrl: profile.avatar_url,
        jobTitle: profile.job_title,
        totalBookings: agentBookings.length,
        totalRevenue,
        totalClients: agentClients.length,
        totalCommissions: pendingCommissions + paidCommissions,
        pendingCommissions,
        paidCommissions,
        avgBookingValue: agentBookings.length > 0 ? totalRevenue / agentBookings.length : 0,
        conversionRate,
      };
    });

    // Sort by total revenue descending
    return stats.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [profiles, bookings, clients, commissions]);

  // Calculate totals for the agency
  const agencyTotals = useMemo(() => {
    if (!agentStats.length) return null;

    return {
      totalAgents: agentStats.length,
      totalRevenue: agentStats.reduce((sum, a) => sum + a.totalRevenue, 0),
      totalBookings: agentStats.reduce((sum, a) => sum + a.totalBookings, 0),
      totalClients: agentStats.reduce((sum, a) => sum + a.totalClients, 0),
      totalCommissions: agentStats.reduce((sum, a) => sum + a.totalCommissions, 0),
      avgRevenuePerAgent: agentStats.length > 0 
        ? agentStats.reduce((sum, a) => sum + a.totalRevenue, 0) / agentStats.length 
        : 0,
    };
  }, [agentStats]);

  return {
    agentStats,
    agencyTotals,
    loading,
  };
}
