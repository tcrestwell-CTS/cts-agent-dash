## Goal

Let the agent upload travel documents (PDFs, images) to a trip from the agent dashboard, and let the trip's client view and download them from the client portal.

## Changes

### 1. Database (migration)
Reuse the existing `client_document_uploads` table. Add three columns:
- `uploaded_by uuid` — agent user id (null for client uploads, set for agent uploads)
- `label text` — agent-supplied display name (e.g. "Final Itinerary PDF")
- `description text` — optional note shown to client

Add RLS policies so the trip-owning agent can `INSERT` and `DELETE` rows. (`SELECT`/`UPDATE` already exist.)

Storage paths will be `agent-docs/{auth.uid()}/{tripId}/{timestamp}-{name}` which already satisfies the existing `client-documents` bucket INSERT/SELECT policies.

### 2. Agent side
- New `src/components/trips/AgentTripDocuments.tsx`: upload (drag/drop + file picker), list, delete; rows where `uploaded_by` is not null.
- Mount it on `TripDetail.tsx` in the right sidebar under the readiness/travelers cards.

### 3. Client portal side
- New portal-data endpoint `resource=agent-docs` (returns agent uploads for the trip with 1-hour signed URLs generated via service role; verifies the trip belongs to the portal client).
- New `src/components/client/AgentTripDocumentsView.tsx`: list with file name, label, description, "Download" link.
- Mount it on `PortalTripDetail.tsx` above the Travel Document Checklist.

### 4. Hook
- Add `useTripAgentDocs(tripId)` for agent side (direct supabase) and an entry in `usePortalData.ts` for portal side.

## Out of scope
- No new bucket — reuses `client-documents`.
- No email notification on upload (can be added later if you want it).
