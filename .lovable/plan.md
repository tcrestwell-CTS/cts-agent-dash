
# Add Leads Tab with Webhook Configuration to CRM

## Overview

The CRM page (`/contacts`) currently uses a row of filter buttons to switch between client status views. This plan refactors it into a proper tabbed layout and adds a dedicated "Leads" tab that includes both the leads client list and a Webhook Configuration panel, allowing agents to set up an endpoint that automatically receives lead data.

## What Will Change

### 1. Database: New `webhook_configurations` Table

A new table will store each agent's webhook settings securely. No existing data is affected.

- `id`, `user_id`, `webhook_url`, `http_method`, `data_format`, `is_active`, `created_at`, `updated_at`
- Row Level Security (RLS) policies will ensure agents can only read/write their own webhook config.

### 2. New Hook: `useWebhookConfiguration`

A new `src/hooks/useWebhookConfiguration.ts` file will provide:
- `useGetWebhookConfig()` — fetches the agent's saved webhook config
- `useUpsertWebhookConfig()` — saves/updates the config

### 3. New Component: `LeadsWebhookConfig`

A new `src/components/crm/LeadsWebhookConfig.tsx` component will render the full Webhook Configuration panel exactly as described:

- **Webhook URL** input field (editable, saves to database)
- **HTTP Method** selector (POST / GET)
- **Data Format** selector (JSON)
- **Example Payload** code block showing the sample JSON with travel-relevant fields:
  ```json
  {
    "lead_id": "abc123",
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "(555) 123-4567",
    "location": "Phoenix, AZ",
    "budget": "$45k - $60k",
    "project_type": "Full Kitchen Remodel",
    "timeline": "1-3 Months"
  }
  ```
- A **Save Configuration** button that persists to the database
- A **Test Webhook** button that fires a sample payload to the configured URL (via a backend function)
- Active/Inactive toggle

### 4. CRM Page Refactor: Tab-Based Layout

`src/pages/CRM.tsx` will be refactored to use the `Tabs` component (already installed via Radix UI). The tab structure will be:

```text
[ All Clients ] [ Active ] [ Leads ] [ Traveled ] [ Inactive ] [ Cancelled ]
```

The **Leads** tab will have a two-section layout:
- Top: The `LeadsWebhookConfig` panel (collapsible card)
- Below: The filtered leads client grid (same `ClientCard` components, status=lead only)

All other tabs remain as simple filtered grids of client cards (same as today, just restructured as tab content).

### 5. New Edge Function: `test-webhook` (Optional, for Test button)

A lightweight backend function in `supabase/functions/test-webhook/index.ts` will:
- Accept the target URL from the request body
- Fire a sample payload to that URL via `fetch`
- Return success/failure so the UI can display a toast

## Technical Details

### Database Migration SQL

```sql
CREATE TABLE public.webhook_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  webhook_url text,
  http_method text NOT NULL DEFAULT 'POST',
  data_format text NOT NULL DEFAULT 'JSON',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_configurations_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_configurations_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.webhook_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own webhook config"
  ON public.webhook_configurations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### File Summary

| File | Action |
|---|---|
| `supabase/migrations/...webhook_configurations.sql` | Create — new migration |
| `src/hooks/useWebhookConfiguration.ts` | Create — new hook |
| `src/components/crm/LeadsWebhookConfig.tsx` | Create — new component |
| `src/pages/CRM.tsx` | Edit — refactor to tab layout |
| `supabase/functions/test-webhook/index.ts` | Create — test payload function |

## User Experience

- The CRM page gains a clean top-level tab bar
- The "Leads" tab shows a configuration card at the top and the leads list below it
- Agents can enter their CRM endpoint URL, choose POST/GET, and save — the config persists across sessions
- The "Test Webhook" button sends a sample payload and shows a success/error toast
- All other tabs (All, Active, Traveled, etc.) behave exactly as before
