export type CommissionTier = "tier_1" | "tier_2" | "tier_3";

export interface TierConfig {
  label: string;
  agentSplit: number;
  agencySplit: number;
  description: string;
}

export const COMMISSION_TIERS: Record<CommissionTier, TierConfig> = {
  tier_1: {
    label: "Tier 1",
    agentSplit: 70,
    agencySplit: 30,
    description: "70% Agent / 30% Agency",
  },
  tier_2: {
    label: "Tier 2",
    agentSplit: 80,
    agencySplit: 20,
    description: "80% Agent / 20% Agency",
  },
  tier_3: {
    label: "Tier 3",
    agentSplit: 95,
    agencySplit: 5,
    description: "95% Agent / 5% Agency",
  },
};

export function getTierConfig(tier: CommissionTier | null | undefined): TierConfig {
  return COMMISSION_TIERS[tier || "tier_1"];
}

export function calculateAgentCommission(
  totalCommission: number,
  tier: CommissionTier | null | undefined
): number {
  const config = getTierConfig(tier);
  return (totalCommission * config.agentSplit) / 100;
}

export function calculateAgencyCommission(
  totalCommission: number,
  tier: CommissionTier | null | undefined
): number {
  const config = getTierConfig(tier);
  return (totalCommission * config.agencySplit) / 100;
}
