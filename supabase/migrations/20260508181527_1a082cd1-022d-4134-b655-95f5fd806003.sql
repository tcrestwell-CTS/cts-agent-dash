
-- 1. Audiences
create table if not exists public.campaign_audiences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  filter jsonb not null default '{}'::jsonb,
  contact_count int default 0,
  last_counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- 2. Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preheader text,
  from_name text not null default 'Crestwell Travel',
  from_email text not null default 'hello@mail.crestwellgetaways.com',
  reply_to text default 'tim@crestwellgetaways.com',
  body_html text not null,
  body_text text,
  status text not null default 'draft'
    check (status in ('draft','scheduled','sending','sent','paused','failed')),
  audience_id uuid references public.campaign_audiences(id) on delete set null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients int not null default 0,
  total_sent int not null default 0,
  total_delivered int not null default 0,
  total_opened int not null default 0,
  total_clicked int not null default 0,
  total_bounced int not null default 0,
  total_complained int not null default 0,
  total_unsubscribed int not null default 0,
  total_suppressed int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_campaigns_status on public.campaigns(status);
create index if not exists idx_campaigns_sent_at on public.campaigns(sent_at desc nulls last);

-- 3. Recipients
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid,
  contact_source text check (contact_source in ('lead','client','manual')),
  email text not null,
  resend_id text,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','opened','clicked','bounced','complained','failed','suppressed','unsubscribed')),
  merge_data jsonb default '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  first_clicked_at timestamptz,
  bounced_at timestamptz,
  bounce_reason text,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  open_count int not null default 0,
  click_count int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists idx_recipients_campaign on public.campaign_recipients(campaign_id);
create index if not exists idx_recipients_resend on public.campaign_recipients(resend_id) where resend_id is not null;
create index if not exists idx_recipients_email on public.campaign_recipients(email);
create index if not exists idx_recipients_status on public.campaign_recipients(campaign_id, status);

-- 4. Suppressions
create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null check (reason in ('unsubscribed','bounced','complained','manual')),
  source text,
  notes text,
  suppressed_at timestamptz not null default now()
);

create index if not exists idx_suppressions_reason on public.email_suppressions(reason);

-- 5. Events
create table if not exists public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  recipient_id uuid references public.campaign_recipients(id) on delete set null,
  resend_id text,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_events_campaign on public.campaign_events(campaign_id, received_at desc);
create index if not exists idx_events_resend on public.campaign_events(resend_id);
create index if not exists idx_events_type on public.campaign_events(event_type, received_at desc);

-- 6. Unified email_contacts view (leads = quote_requests; clients table)
create or replace view public.email_contacts as
  select
    qr.id::uuid as contact_id,
    'lead'::text as source,
    qr.email,
    qr.first_name,
    qr.last_name,
    coalesce(qr.ai_stage, qr.status, 'unknown') as lifecycle_stage,
    qr.created_at,
    qr.ai_tags as tags
  from public.quote_requests qr
  where qr.email is not null and qr.email <> ''
union all
  select
    c.id::uuid as contact_id,
    'client'::text as source,
    c.email,
    c.first_name,
    c.last_name,
    coalesce(c.status, 'client') as lifecycle_stage,
    c.created_at,
    case when c.tags is null or c.tags = '' then null
         else string_to_array(c.tags, ',') end as tags
  from public.clients c
  where c.email is not null and c.email <> '';

-- 7. RLS
alter table public.campaigns enable row level security;
alter table public.campaign_audiences enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.campaign_events enable row level security;

do $$ begin
  create policy "auth full access campaigns" on public.campaigns
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth full access audiences" on public.campaign_audiences
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth full access recipients" on public.campaign_recipients
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth full access suppressions" on public.email_suppressions
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth read events" on public.campaign_events
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- 8. updated_at triggers (reuse existing public.update_updated_at_column)
drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.update_updated_at_column();

drop trigger if exists audiences_updated_at on public.campaign_audiences;
create trigger audiences_updated_at before update on public.campaign_audiences
  for each row execute function public.update_updated_at_column();

-- 9. Atomic stat increment
create or replace function public.increment_campaign_stat(
  p_campaign_id uuid,
  p_field text,
  p_delta int default 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_field !~ '^[a-z_]+$' then
    raise exception 'Invalid field name: %', p_field;
  end if;
  execute format(
    'update public.campaigns set %I = %I + $1 where id = $2',
    p_field, p_field
  ) using p_delta, p_campaign_id;
end;
$$;
