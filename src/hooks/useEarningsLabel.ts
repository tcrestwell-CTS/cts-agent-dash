import { useIsAdmin } from "@/hooks/useAdmin";

/**
 * For agency owners (admin role), commissions on their own bookings are
 * effectively the company's margin (they ARE the company).
 * Returns the right user-facing label set based on whether the current
 * user is an admin/owner.
 *
 * Use these strings in UI ONLY. Do not rename DB columns / variables.
 */
export function useEarningsLabel() {
  const { data: isAdmin } = useIsAdmin();
  const owner = !!isAdmin;

  return {
    isOwner: owner,
    /** "Margin" / "Commission" */
    singular: owner ? "Margin" : "Commission",
    /** "Margins" / "Commissions" */
    plural: owner ? "Margins" : "Commissions",
    /** "margin" / "commission" (lowercase, mid-sentence) */
    singularLower: owner ? "margin" : "commission",
    /** "margins" / "commissions" (lowercase, mid-sentence) */
    pluralLower: owner ? "margins" : "commissions",
    /** e.g. "Margin Revenue" / "Commission Revenue" */
    revenue: owner ? "Margin Revenue" : "Commission Revenue",
    /** e.g. "Upcoming Margins" / "Upcoming Commissions" */
    upcoming: owner ? "Upcoming Margins" : "Upcoming Commissions",
    /** e.g. "Your earned margin" / "Your earned commission" */
    earned: owner ? "Your earned margin" : "Your earned commission",
    /** e.g. "Margin History" / "Commission History" */
    history: owner ? "Margin History" : "Commission History",
    /** Section heading for the standalone page */
    pageTitle: owner ? "Margins" : "Commissions",
    /** Plural team-view title */
    teamTitle: owner ? "Team Margins" : "Team Commissions",
    /** Singular personal title */
    myTitle: owner ? "My Margins" : "My Commissions",
    /** Report title */
    reportTitle: owner ? "Margin Report" : "Commission Report",
  };
}