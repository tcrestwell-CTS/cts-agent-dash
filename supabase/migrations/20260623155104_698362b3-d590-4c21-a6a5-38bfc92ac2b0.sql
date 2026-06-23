alter table public.itineraries
  add column if not exists header_style text default 'full_bleed'
    check (header_style in ('full_bleed', 'large', 'minimized', 'legacy')),
  add column if not exists font_style text default 'serif'
    check (font_style in ('serif', 'sans', 'display'));

comment on column public.itineraries.header_style is
  'Controls hero header layout on shared trip view: full_bleed | large | minimized | legacy';
comment on column public.itineraries.font_style is
  'Controls font family on shared trip view: serif | sans | display';