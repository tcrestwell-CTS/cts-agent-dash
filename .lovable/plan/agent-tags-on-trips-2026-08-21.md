# Agent tags on trips

Make it obvious at a glance which advisor owns each trip, and let you filter the trip list by advisor.

## What you'll see

1. **Advisor tag on every trip row** — a small badge (avatar initials + advisor name, e.g. "Janay Harris") in a new "Advisor" column of the Trips table, and on each card in the Kanban board view.
2. **"Filter by advisor" dropdown** next to the existing status filter — All advisors, plus one entry per team member. Combines with search and status filters.
3. **Advisor tag on the Trip Detail header** so the owner is visible when you open a trip.
4. **Unassigned handling** — trips with no advisor show a muted "Unassigned" tag, and the filter has an "Unassigned" option so gaps are easy to find.

Admins and office admins see all advisors; a regular advisor only sees their own trips as today (no access changes).

## Technical notes

- No schema change needed: `trips.advisor_id` (falling back to `trips.user_id`) already carries ownership. Names come from the existing `useTeamProfiles` hook (which already merges the bookkeeper-safe profiles view), so no new query per row.
- New presentational component `src/components/trips/AdvisorTag.tsx` — takes a user id, resolves name/avatar from a memoized map, renders a compact badge using existing semantic tokens (no hardcoded colors).
- `src/pages/Trips.tsx`: add `advisorFilter` state, extend the `filteredTrips` predicate, add the Select next to the status filter, add the "Advisor" column header/cell.
- `src/components/trips/TripsKanban.tsx`: render `AdvisorTag` in the card footer; pass the advisor id through the existing `trips.map(...)` projection in Trips.tsx.
- `src/pages/TripDetail.tsx`: render `AdvisorTag` in the header meta row.
