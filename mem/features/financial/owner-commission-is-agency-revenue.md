---
name: Owner commission counts as agency revenue
description: Tim Crestwell's commissions are agency revenue, never advisor payouts (no tier split, no payout row, no 1099)
type: feature
---

Commission earned on the owner's own bookings belongs to the agency.

- `src/lib/agencyOwnerAgents.ts` holds `AGENCY_OWNER_USER_IDS` (Tim Crestwell `5c2d70a4-…`, Timothy Crestwell `ff0cb943-…`), `isAgencyOwnerAgent()`, and `agentPayoutShare(userId, amount, tier)` which returns 0 for owners.
- Applied in: Commission Report (KPIs, advisor profitability, CSV), `CommissionReportTable` rows + totals, `Commissions.tsx` (row agentShare + team leaderboard), Bookkeeper Agent Payouts (owner excluded, retained amount noted), Bookkeeper 1099 prep (owner excluded).
- `CommissionSummary.tsx` already had its own admin-owned rule (100% to agency).
