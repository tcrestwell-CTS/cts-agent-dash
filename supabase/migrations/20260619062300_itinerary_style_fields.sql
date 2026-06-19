-- Add itinerary presentation style fields
-- header_style: controls the hero section layout on the client-facing proposal
--   'full_bleed' — full-viewport cinematic image with overlaid title (default)
--   'large'     — prominent image at ~50vh, title below
--   'minimized' — compact image strip, gets clients to content faster
--   'legacy'    — original text-only header (no image shown)
-- font_style: controls the typeface family across the proposal
--   'standard'  — default system sans-serif (current behavior)
--   'sans'      — Outfit — modern, clean, approachable
--   'serif'     — Cormorant Garamond — luxury, editorial, refined

alter table itineraries
  add column if not exists header_style text default 'full_bleed'
    check (header_style in ('full_bleed', 'large', 'minimized', 'legacy')),
  add column if not exists font_style text default 'standard'
    check (font_style in ('standard', 'sans', 'serif'));

comment on column itineraries.header_style is
  'Controls hero image display on client proposal: full_bleed | large | minimized | legacy';
comment on column itineraries.font_style is
  'Controls typeface on client proposal: standard | sans | serif';
