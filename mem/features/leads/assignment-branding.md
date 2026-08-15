---
name: Lead assignment branding & notifications
description: Assigned leads use the advisor's branding for client emails; assignment notifies the advisor plus the agency owner; crestwellgetaways leads stay unassigned with Tim.
type: feature
---
- Leads from an agent storefront (`lead_source = agent_storefront`) auto-assign to that advisor.
- Leads from crestwellgetaways.com / funnels stay UNASSIGNED and notify the agency owner only.
- Client-facing lead emails (proposals, follow-ups) use the assigned advisor's branding: `send-email` accepts `brandingUserId` + `replyTo`; `_shared/agent-branding.ts` resolves branding_settings then profiles fallbacks.
- On assignment the advisor gets an in-app notification + email, and the agency owner always gets a copy (`AGENCY_ADMIN_EMAIL` or first branding_settings.email_address).
- `notify-lead-assigned` edge function is the public entrypoint (accepts `lead_id` or `email`).
