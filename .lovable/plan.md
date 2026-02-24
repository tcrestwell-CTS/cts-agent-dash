

# Level 3: Agent Performance Intelligence

Upgrade from tracking metrics to decision intelligence -- giving agency leaders the data to coach agents and optimize operations.

---

## What Already Exists

The platform already calculates per-agent:
- **Revenue** (total booking amounts)
- **Bookings count** and **Avg Booking Value**
- **Conversion rate** (clients with bookings / total clients)
- **Commission totals** (pending + paid)
- Revenue bar chart + commissions chart
- Agent ranking table with progress bars
- Advisor profitability on Commission Report page (gross sales, commission, margin %, trips)

---

## What's New

### 1. Enhanced AgentStats with Margin, Close Rate by Trip Type, and Lead Response Time

Expand the `AgentStats` interface and `useAgentPerformance` hook to calculate:

- **Margin per advisor**: `(total_commission_revenue / total_gross_sales) * 100` using booking-level financial data (already available on bookings)
- **Close rate by trip type**: Group bookings by `booking_type`, count confirmed vs total per type per agent
- **Lead response time**: Average days between client `created_at` (lead creation) and their first booking's `created_at` -- a proxy for how quickly the agent converts leads

No database changes needed -- all data is already available in existing tables.

### 2. New: Agent Intelligence Dashboard Tab

Add a new **"Agent Intelligence"** tab on the Analytics page (visible to admins/office admins) that shows:

- **Scorecard grid**: Revenue, Margin %, Conversion Rate, Avg Booking Value, Avg Lead Response Time per agent
- **Close Rate by Trip Type heatmap**: Table with agents as rows, trip types as columns, close rates as colored cells
- **Agent Comparison radar chart**: Select 2 agents to compare across 5 dimensions (revenue, margin, conversion, avg value, response time)

### 3. Individual Agent View Enhancement

For regular agents viewing their own performance, add:
- Margin % display
- Lead response time metric
- Close rate breakdown by trip type (simple bar chart)

---

## Technical Details

### Changes to `useAgentPerformance` hook

Add to `AgentStats`:
```typescript
marginPct: number;           // commission_revenue / gross_sales * 100
avgLeadResponseDays: number; // avg days from client creation to first booking
closeRateByType: Record<string, { total: number; closed: number; rate: number }>;
totalGrossSales: number;
totalCommissionRevenue: number;
```

Calculation logic:
- **Margin**: Sum `commission_revenue` and `gross_sales` from agent's bookings (these columns already exist)
- **Lead response time**: For each client, find their earliest booking `created_at`, subtract client `created_at`, average across all clients
- **Close rate by type**: Group agent's bookings by `booking_type`, count those with status "confirmed" or "completed" vs total

### New Component: `AgentIntelligenceTab`

A new component `src/components/analytics/AgentIntelligenceTab.tsx` containing:

1. **Intelligence Scorecard** -- A sortable table with columns: Agent, Revenue, Gross Sales, Margin %, Avg Booking Value, Conversion %, Avg Lead Response (days), Total Bookings
2. **Trip Type Performance** -- A table/heatmap showing close rates by booking type per agent
3. **Agent Comparison** -- A Recharts RadarChart comparing two selected agents across normalized metrics

### Modified: Analytics Page

Add a new tab "Agent Intelligence" alongside existing "Overview", "Agent Performance", and "Agency Sales" tabs.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/analytics/AgentIntelligenceTab.tsx` | Full intelligence dashboard with scorecard, trip type heatmap, and comparison chart |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAgentPerformance.ts` | Add margin, lead response time, close rate by type, gross sales, commission revenue to AgentStats |
| `src/components/analytics/AgentPerformanceSection.tsx` | Add margin %, response time, and trip type breakdown to single-agent view |
| `src/pages/Analytics.tsx` | Add "Agent Intelligence" tab (admin only) |

## No Database Changes

All metrics are derived from existing columns: `bookings.commission_revenue`, `bookings.gross_sales`, `bookings.booking_type`, `bookings.status`, `clients.created_at`, and `bookings.created_at`.

## Implementation Order

1. Enhance `useAgentPerformance` hook with new calculated fields
2. Create `AgentIntelligenceTab` component
3. Add new tab to Analytics page
4. Enhance single-agent view in `AgentPerformanceSection`
