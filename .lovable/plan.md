# Marketing Campaigns Hub

Build a complete Campaigns UI under the existing **Marketing** sidebar group, plus an AI campaign writer and a drag-and-drop image library backed by the existing `email-assets` storage bucket.

## What gets added

### 1. Sidebar nav (Marketing group)
Add three new entries above "Email & Branding":
- **Campaigns** → `/campaigns` (list)
- **Audiences** → `/campaigns/audiences`
- **Image Library** → `/campaigns/images`

### 2. Pages

**`/campaigns` — Campaign list**
Table of all campaigns with stats columns (Sent / Delivered / Opened / Clicked / Bounced), status badge, sent date. Buttons: "New Campaign", row click → editor. Filter by status. Uses existing `campaigns` table.

**`/campaigns/new` and `/campaigns/:id` — Campaign editor**
Single-page editor with:
- Left column: Name, Subject, Preheader, From Name, From Email (default `news@crestwellgetaways.com`), Reply-To, Audience picker, HTML body editor (textarea with merge-var helper chips: `{{first_name}}`, `{{last_name}}`, `{{contact_name}}`, `{{email}}`)
- Right column: Live preview pane (renders body_html in an iframe), AI Assistant card (see below), Image Library quick-insert
- Footer actions: Save Draft, Send Test (to current user), **Send Campaign** (calls existing `send-campaign` edge function), with confirmation dialog showing recipient count

**`/campaigns/audiences` — Audience manager**
List of `campaign_audiences`. Create/edit dialog with name, description, and a simple filter builder (initial v1: "all clients", "all leads", "all contacts", "manual list" — stored in `filter` jsonb). Shows live `contact_count`. A "Refresh count" button materializes recipients via a new edge function.

**`/campaigns/images` — Image library**
Grid view of all files in the `email-assets` storage bucket. Drag-and-drop upload zone (uses `react-dropzone`). Each tile shows thumbnail, filename, size, "Copy URL" button, and delete. Same component is embedded in the campaign editor as an "Insert Image" sheet — clicking inserts an `<img src="...">` tag at the cursor in the body editor.

### 3. AI Campaign Writer
New edge function **`generate-campaign-copy`** using Lovable AI Gateway (`google/gemini-2.5-flash`). In the editor, an "AI Assistant" card with:
- Inputs: campaign goal/topic (textarea), tone (Friendly / Luxury / Urgent / Informative), call-to-action, audience description
- Buttons: "Generate Subject Lines" (returns 5 options), "Generate Email Body" (returns HTML using semantic email-safe markup), "Improve Selection"
- Output appears inline; one click applies to the form

System prompt enforces Crestwell Travels brand voice (luxury, navy/gold), travel-agency context, and inline merge-var usage.

### 4. Edge functions
- **`generate-campaign-copy`** (new) — Lovable AI; admin/office_admin only; verify_jwt off, validates user role via service-role auth check
- **`materialize-audience`** (new) — Given `audience_id`, expands the audience filter into `campaign_recipients` rows for a given `campaign_id`, dedupes against suppressions, returns count. Admin-only.

### 5. Database (migration)
- New table **`marketing_image_assets`** (id, user_id, storage_path, public_url, filename, mime_type, size_bytes, width, height, alt_text, tags text[], created_at) with RLS allowing all authenticated read/write — keeps a queryable index over the bucket so the library doesn't need to list storage every render
- RLS for `email-assets` storage bucket: authenticated read/write/delete (already public-read since bucket is public)

### 6. Hooks
- `useCampaigns`, `useCampaign(id)` — list + single, with React Query
- `useAudiences` — list + mutations
- `useImageAssets` — list, upload (to bucket + insert row), delete
- `useSendCampaign` — invokes `send-campaign` edge function
- `useGenerateCampaignCopy` — invokes `generate-campaign-copy`

## Technical details

- All pages wrap in `<ProtectedRoute>` with admin gate (reuse pattern from `AdminRoute` or check `useUserRoles` for `admin`/`office_admin`)
- Image library uses `react-dropzone` (need to install). Files uploaded to `email-assets/<user_id>/<uuid>-<filename>`, public URL stored in `marketing_image_assets`
- HTML body editor: keep simple `<Textarea>` with monospace font in v1 (no rich text editor yet) — matches existing project patterns; merge-var chips insert at cursor
- Preview iframe sandboxed (`sandbox=""`) for safety
- Send confirmation shows audience name + recipient count (queries `campaign_recipients` where `campaign_id = ? and status = 'queued'`)
- "Send Test" inserts a single `campaign_recipients` row for the current user and invokes `send-campaign` (or a separate path); v1: simply send via Resend directly through a new `send-test-campaign` action
- Use existing `useToast`, `Card`, `Button`, `Dialog`, `Tabs`, `Badge` from shadcn — no new design tokens

## Out of scope (v1)
- Scheduled sends UI (table column exists; defer scheduler)
- A/B subject testing
- Rich text/visual email builder (just HTML textarea + image insert)
- Advanced segment filter builder beyond preset audiences

## File list
- Migration: `marketing_image_assets` table + storage policies
- `src/hooks/useCampaigns.ts`, `useCampaignAudiences.ts`, `useImageAssets.ts`
- `src/pages/Campaigns.tsx`, `CampaignEditor.tsx`, `CampaignAudiences.tsx`, `ImageLibrary.tsx`
- `src/components/campaigns/CampaignTable.tsx`, `AudienceDialog.tsx`, `AICampaignAssistant.tsx`, `ImageDropzone.tsx`, `ImageGrid.tsx`, `MergeVarChips.tsx`, `EmailPreview.tsx`
- `src/App.tsx` — add 4 routes
- `src/components/layout/Sidebar.tsx` — add 3 marketing entries
- `supabase/functions/generate-campaign-copy/index.ts`
- `supabase/functions/materialize-audience/index.ts`
- `supabase/config.toml` — register both functions

Approve and I'll build it.
