// =============================================================================
// src/types/margin.ts  — NEW FILE
// Add to cts-agent-dash/src/types/margin.ts
//
// These types mirror the actual DB schema and commissionTiers.ts constants.
// =============================================================================

import { CommissionTier } from "@/lib/commissionTiers";

// ---------------------------------------------------------------------------
// Line item types
// ---------------------------------------------------------------------------

export type MarginLineType =
  | "hotel"
  | "flight"
  | "transfer"
  | "cruise"
  | "insurance"
  | "service_fee"
  | "package"
  | "excursion"
  | "other";

export type MarginLineSource =
  | "manual"      // entered by agent
  | "synthetic"   // migrated from legacy gross_sales/supplier_payout
  | "hotelbeds"
  | "duffel"
  | "amadeus"
  | "sabre";

export type PricingMode = "commission" | "net" | "gross" | "package";

// ---------------------------------------------------------------------------
// BookingMarginLine — maps to booking_margin_lines table
//
// IMPORTANT: total_cost, total_sell, margin_amount are GENERATED ALWAYS columns.
// On INSERT, only send: booking_id, user_id, line_type, description, source,
// quantity, unit_cost, unit_sell, is_pass_through, sort_order
// ---------------------------------------------------------------------------
export interface BookingMarginLine {
  id: string;
  booking_id: string;
  user_id: string;
  line_type: MarginLineType;
  description: string;
  source: MarginLineSource;
  quantity: number;
  unit_cost: number;
  unit_sell: number;
  // Generated columns — read-only from DB:
  total_cost: number;
  total_sell: number;
  margin_amount: number;
  // Optional
  margin_rule_id: string | null;
  is_pass_through: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type BookingMarginLineInsert = Pick<
  BookingMarginLine,
  | "booking_id"
  | "user_id"
  | "line_type"
  | "description"
  | "source"
  | "quantity"
  | "unit_cost"
  | "unit_sell"
  | "is_pass_through"
  | "sort_order"
> & { margin_rule_id?: string | null };

// ---------------------------------------------------------------------------
// New fields added to bookings table by margin engine migration
// Add these to the existing Booking interface in useBookings.ts
// ---------------------------------------------------------------------------
export interface BookingMarginFields {
  agency_gross_margin: number;
  advisor_split_pct: number;
  agency_split_pct: number;
  advisor_margin_amount: number;
  agency_margin_amount: number;
  pricing_mode: PricingMode;
  margin_locked: boolean;
  margin_version: number;
  // supplier_payout already existed — just typing it here for completeness
  supplier_payout: number;
}

// ---------------------------------------------------------------------------
// Response from calculate_booking_margin() RPC
// ---------------------------------------------------------------------------
export interface MarginCalculationResult {
  booking_id: string;
  status: "calculated" | "locked" | "error";
  total_sell: number;
  total_cost: number;
  agency_gross_margin: number;
  advisor_split_pct: number;
  agency_split_pct: number;
  advisor_margin_amount: number;
  agency_margin_amount: number;
  margin_version: number;
  margin_pct: number;
  source: "margin_lines" | "legacy_fields";
  warnings?: Array<{
    rule_id: string;
    rule_name: string;
    rule_type: string;
    required_value: number;
    actual_value: number;
    message: string;
  }>;
  // Only on error:
  error?: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Display summary — used by BookingFinancialsDisplay
// ---------------------------------------------------------------------------
export interface MarginDisplaySummary {
  grossSales: number;       // what client pays
  supplierPayout: number;   // what we pay supplier
  netSales: number;         // gross - supplier (legacy commission basis)
  commissionRevenue: number; // what supplier pays us
  agencyGrossMargin: number; // engine: gross_sales - supplier_payout
  marginPct: number;
  advisorAmount: number;
  agencyAmount: number;
  advisorSplitPct: number;  // 0–100 (percentage, not decimal)
  agencySplitPct: number;
  marginVersion: number;
  marginLocked: boolean;
  pricingMode: PricingMode;
  commissionTier: CommissionTier | null;
}

// ---------------------------------------------------------------------------
// Utility: build MarginDisplaySummary from a booking with margin fields
// ---------------------------------------------------------------------------
export function buildMarginDisplaySummary(
  booking: {
    gross_sales: number;
    supplier_payout?: number;
    net_sales?: number;
    commission_revenue?: number;
    agency_gross_margin?: number;
    advisor_margin_amount?: number;
    agency_margin_amount?: number;
    advisor_split_pct?: number;
    agency_split_pct?: number;
    margin_version?: number;
    margin_locked?: boolean;
    pricing_mode?: string;
  },
  commissionTier?: CommissionTier | null
): MarginDisplaySummary {
  const grossSales = booking.gross_sales ?? 0;
  const supplierPayout = booking.supplier_payout ?? 0;
  const netSales = booking.net_sales ?? grossSales - supplierPayout;
  const commissionRevenue = booking.commission_revenue ?? 0;
  const agencyGrossMargin = booking.agency_gross_margin ?? grossSales - supplierPayout;
  const advisorSplitPct = (booking.advisor_split_pct ?? 0) * 100;
  const agencySplitPct = (booking.agency_split_pct ?? 0) * 100;
  const marginPct = grossSales > 0 ? (agencyGrossMargin / grossSales) * 100 : 0;

  return {
    grossSales,
    supplierPayout,
    netSales,
    commissionRevenue,
    agencyGrossMargin,
    marginPct,
    advisorAmount: booking.advisor_margin_amount ?? 0,
    agencyAmount: booking.agency_margin_amount ?? 0,
    advisorSplitPct,
    agencySplitPct,
    marginVersion: booking.margin_version ?? 1,
    marginLocked: booking.margin_locked ?? false,
    pricingMode: (booking.pricing_mode as PricingMode) ?? "commission",
    commissionTier: commissionTier ?? null,
  };
}

// ---------------------------------------------------------------------------
// Utility: build a synthetic margin line from legacy booking fields
// Used in MVP Phase 1 before full line-item entry exists
// ---------------------------------------------------------------------------
export function buildSyntheticMarginLine(
  bookingId: string,
  userId: string,
  grossSales: number,
  supplierPayout: number,
  description = "Full booking package"
): BookingMarginLineInsert {
  return {
    booking_id: bookingId,
    user_id: userId,
    line_type: "package",
    description,
    source: "synthetic",
    quantity: 1,
    unit_sell: grossSales,
    unit_cost: supplierPayout,
    is_pass_through: false,
    sort_order: 0,
  };
}

// =============================================================================
// Phase 2 + 3 additions
// =============================================================================

export type MarginRuleType = "markup_pct" | "markup_flat" | "min_margin_pct";

export interface AgencyMarginRule {
  id: string;
  name: string;
  line_type: MarginLineType | null;
  supplier_id: string | null;
  rule_type: MarginRuleType;
  rule_value: number;
  is_active: boolean;
  priority: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AgencyMarginRuleInsert = Pick<
  AgencyMarginRule,
  "name" | "rule_type" | "rule_value" | "is_active" | "priority"
> & {
  line_type?: MarginLineType | null;
  supplier_id?: string | null;
  notes?: string | null;
};

export interface BookingMarginAudit {
  id: string;
  booking_id: string;
  calculated_by: string | null;
  margin_version: number;
  total_sell: number;
  total_cost: number;
  agency_gross_margin: number;
  advisor_split_pct: number;
  agency_split_pct: number;
  advisor_margin_amount: number;
  agency_margin_amount: number;
  pricing_mode: string;
  source: string;
  triggered_by: "create" | "update" | "manual" | "backfill" | "api";
  created_at: string;
}

// Phase 3: margin rule warning returned by RPC
export interface MarginRuleWarning {
  rule_id: string;
  rule_name: string;
  rule_type: MarginRuleType;
  required_value: number;
  actual_value: number;
  message: string;
}

export const RULE_TYPE_LABELS: Record<MarginRuleType, string> = {
  markup_pct:     "% Markup on Cost",
  markup_flat:    "Flat $ Markup",
  min_margin_pct: "Minimum Margin %",
};

export const LINE_TYPE_LABELS: Record<MarginLineType, string> = {
  hotel:       "Hotel",
  flight:      "Flight",
  transfer:    "Transfer",
  cruise:      "Cruise",
  insurance:   "Insurance",
  service_fee: "Service Fee",
  package:     "Package",
  excursion:   "Excursion",
  other:       "Other",
};

/**
 * Given a line type and supplier, find the best matching active rule.
 * Supplier-specific rules beat type-only rules; higher priority wins ties.
 */
export function findApplicableRule(
  rules: AgencyMarginRule[],
  lineType: MarginLineType,
  supplierId: string | null,
  ruleType?: MarginRuleType
): AgencyMarginRule | null {
  const active = rules.filter(r =>
    r.is_active &&
    (ruleType ? r.rule_type === ruleType : true) &&
    (r.line_type === null || r.line_type === lineType) &&
    (r.supplier_id === null || r.supplier_id === supplierId)
  );

  if (active.length === 0) return null;

  // Sort: supplier-specific first, then by priority desc
  return active.sort((a, b) => {
    const aSpecific = a.supplier_id !== null ? 1 : 0;
    const bSpecific = b.supplier_id !== null ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;
    return b.priority - a.priority;
  })[0];
}

/**
 * Calculate suggested sell price for a line based on cost and applicable rules.
 */
export function applySuggestedMarkup(
  unitCost: number,
  rule: AgencyMarginRule | null
): number | null {
  if (!rule) return null;
  if (rule.rule_type === "markup_pct") {
    return Math.round(unitCost * (1 + rule.rule_value / 100) * 100) / 100;
  }
  if (rule.rule_type === "markup_flat") {
    return Math.round((unitCost + rule.rule_value) * 100) / 100;
  }
  return null; // min_margin_pct doesn't suggest a price
}
