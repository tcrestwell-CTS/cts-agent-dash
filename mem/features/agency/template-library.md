---
name: Shared Template Library
description: Agency-scoped template library (itinerary/proposal/email) + shared photo assets; consortia integration explicitly out of scope
type: feature
---
Phase 4 scope decision: CTN has **no consortium affiliation** — consortia integration is out of scope. Do not propose or build it.

Built instead: agency-wide shared library at `/template-library`.
- `library_templates` table: kind (itinerary|proposal|email|packing|checklist), name, description, destination, trip_type, duration_days, content, template_data, tags, is_shared, is_archived, usage_count, created_by.
- Access: any signed-in team member reads shared+non-archived templates or their own; creators/admin/office_admin edit or delete.
- `marketing_image_assets.is_shared` publishes a photo to the agency-wide library (owner-only toggle, all team can view).
- Copy action increments `usage_count`. Empty states stay honest — never seed fake templates.