import { calculateAgentCommission, CommissionTier } from "@/lib/commissionTiers";

/**
 * Agency owner accounts. Commission earned on their own bookings is agency
 * revenue — never an advisor payout (no tier split, no payout row, no 1099).
 */
export const AGENCY_OWNER_USER_IDS: string[] = [
  "5c2d70a4-a902-47fa-aaf0-f29fc2eb1562", // Tim Crestwell (owner/admin)
  "ff0cb943-51c9-4e3d-a38a-577dc7a01370", // Timothy Crestwell (advisor login)
];

export function isAgencyOwnerAgent(userId?: string | null): boolean {
  return !!userId && AGENCY_OWNER_USER_IDS.includes(userId);
}

/**
 * Advisor payout for a commission row. Owner rows pay out $0 because the
 * full amount stays with the agency.
 */
export function agentPayoutShare(
  userId: string | null | undefined,
  amount: number,
  tier: CommissionTier,
): number {
  if (isAgencyOwnerAgent(userId)) return 0;
  return calculateAgentCommission(amount, tier);
}
