-- Marine IQ — migration 5: self-service advertising, subscriptions,
-- job marketplace, service marketplace.
--
-- REVENUE PHILOSOPHY (enforced structurally): nothing in this migration
-- touches reviews, review_scores, trust_signals or the scoring views.
-- Paid features buy visibility and functionality — never reputation.
-- All sponsored surfaces are separate tables rendered with a "Sponsored"
-- label in the UI.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type subscription_tier as enum ('free', 'professional', 'enterprise');
create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled');

create type campaign_type as enum (
  'homepage_banner', 'sidebar_banner', 'sponsored_search',
  'sponsored_company_profile', 'sponsored_software_listing',
  'sponsored_conference_listing', 'newsletter_sponsorship',
  'sponsored_article', 'sponsored_webinar', 'sponsored_podcast',
  'sponsored_top10'
);

create type campaign_objective as enum (
  'brand_awareness', 'lead_generation', 'demo_requests', 'event_registrations', 'recruitment'
);

create type campaign_status as enum (
  'draft', 'pending_review', 'pending_payment', 'active',
  'paused', 'budget_exhausted', 'completed', 'rejected'
);

create type ad_event_type as enum ('impression', 'click');

create type marketplace_service as enum (
  'sponsored_webinar', 'sponsored_report', 'sponsored_podcast',
  'industry_survey', 'whitepaper_promotion', 'product_launch', 'event_promotion'
);

create type order_status as enum ('pending_payment', 'paid', 'in_progress', 'delivered', 'canceled');

create type job_type as enum ('full_time', 'part_time', 'contract', 'internship', 'executive_search');

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------

create table company_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null unique references companies (id) on delete cascade,
  tier                    subscription_tier not null default 'free',
  status                  subscription_status not null default 'active',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Premium membership for individual professionals.
create table premium_memberships (
  user_id                 uuid primary key references users (id) on delete cascade,
  status                  subscription_status not null default 'active',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now()
);

alter table company_subscriptions enable row level security;
alter table premium_memberships enable row level security;

create policy "subs read reps"  on company_subscriptions for select using (is_company_rep(company_id) or is_admin());
create policy "subs admin"      on company_subscriptions for all using (is_admin()) with check (is_admin());
create policy "premium read own" on premium_memberships for select using (user_id = auth.uid() or is_admin());
create policy "premium admin"    on premium_memberships for all using (is_admin()) with check (is_admin());

create or replace function has_premium(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from premium_memberships
    where user_id = uid and status in ('active', 'trialing')
  );
$$;

-- ---------------------------------------------------------------------------
-- Self-service advertising
-- ---------------------------------------------------------------------------

create table ad_accounts (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid not null references users (id) on delete cascade,
  company_id          uuid references companies (id) on delete set null,
  billing_email       text not null,
  stripe_customer_id  text,
  created_at          timestamptz not null default now(),
  unique (owner_user_id)
);

create table ad_campaigns (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references ad_accounts (id) on delete cascade,
  name             text not null,
  campaign_type    campaign_type not null,
  objective        campaign_objective not null default 'brand_awareness',
  -- audience targeting (sectors, countries) — matched at serve time
  audience         jsonb not null default '{}'::jsonb,
  headline         text,
  body_text        text,
  destination_url  text not null,
  logo_path        text,
  banner_path      text,
  video_path       text,
  -- budget & pricing. Spend accrues from ad_events via trigger; the campaign
  -- pauses automatically at budget exhaustion.
  budget_total     numeric(10,2) not null check (budget_total > 0),
  spend            numeric(10,2) not null default 0,
  cpm              numeric(8,2) not null default 5.00,   -- USD per 1000 impressions
  cpc              numeric(8,2) not null default 1.50,   -- USD per click
  status           campaign_status not null default 'draft',
  starts_at        timestamptz,
  ends_at          timestamptz,
  reviewed_by      uuid references users (id),
  rejection_reason text,
  stripe_payment_intent_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index ad_campaigns_serving_idx on ad_campaigns (campaign_type) where status = 'active';
create index ad_campaigns_account_idx on ad_campaigns (account_id);

-- Raw serving events. Written server-side by the app (service role); the
-- daily stats view aggregates them for the advertiser dashboard.
create table ad_events (
  id           bigint generated always as identity primary key,
  campaign_id  uuid not null references ad_campaigns (id) on delete cascade,
  event_type   ad_event_type not null,
  country      text,
  device       text,
  path         text,
  created_at   timestamptz not null default now()
);

create index ad_events_campaign_idx on ad_events (campaign_id, created_at desc);

alter table ad_accounts enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_events enable row level security;

create policy "ad accounts own"   on ad_accounts for all
  using (owner_user_id = auth.uid() or is_admin())
  with check (owner_user_id = auth.uid() or is_admin());

create policy "campaigns own read" on ad_campaigns for select
  using (exists (select 1 from ad_accounts a where a.id = account_id and a.owner_user_id = auth.uid()) or is_admin());
-- Advertisers create and edit drafts; only admins can set a campaign active.
create policy "campaigns own insert" on ad_campaigns for insert
  with check (
    exists (select 1 from ad_accounts a where a.id = account_id and a.owner_user_id = auth.uid())
    and status in ('draft', 'pending_review')
  );
create policy "campaigns own update" on ad_campaigns for update
  using (exists (select 1 from ad_accounts a where a.id = account_id and a.owner_user_id = auth.uid()))
  with check (exists (select 1 from ad_accounts a where a.id = account_id and a.owner_user_id = auth.uid()));
create policy "campaigns admin" on ad_campaigns for all using (is_admin()) with check (is_admin());
-- Active campaigns are publicly readable so the app can serve them.
create policy "campaigns public serving" on ad_campaigns for select using (status = 'active');

-- ad_events: no user policies; only the service role writes and reads raw
-- events. Advertisers see aggregates through the stats view below.

-- Advertisers cannot self-activate, change pricing, or reset spend.
create or replace function guard_campaign_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() and auth.uid() is not null then
    if new.status is distinct from old.status
       and not (old.status in ('draft', 'rejected') and new.status = 'pending_review')
       and not (old.status = 'active' and new.status = 'paused')
       and not (old.status = 'paused' and new.status = 'pending_review') then
      raise exception 'MARINE_IQ_ADS: campaigns go live only after moderation review and payment';
    end if;
    if new.spend is distinct from old.spend
       or new.cpm is distinct from old.cpm
       or new.cpc is distinct from old.cpc then
      raise exception 'MARINE_IQ_ADS: spend and pricing are system-managed';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_campaign_update
  before update on ad_campaigns
  for each row execute function guard_campaign_update();

-- Accrue spend per event; pause automatically when the budget is exhausted.
create or replace function accrue_ad_spend()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare c ad_campaigns%rowtype;
begin
  select * into c from ad_campaigns where id = new.campaign_id;
  if c.id is null then return new; end if;

  update ad_campaigns
     set spend = spend + case when new.event_type = 'impression' then c.cpm / 1000.0 else c.cpc end
   where id = c.id;

  update ad_campaigns
     set status = 'budget_exhausted'
   where id = c.id and status = 'active' and spend >= budget_total;

  return new;
end;
$$;

create trigger on_ad_event
  after insert on ad_events
  for each row execute function accrue_ad_spend();

-- Advertiser dashboard aggregates.
create or replace view ad_campaign_stats with (security_invoker = true) as
select
  c.id as campaign_id,
  c.account_id,
  c.name,
  c.campaign_type,
  c.status,
  c.budget_total,
  c.spend,
  greatest(c.budget_total - c.spend, 0) as remaining_budget,
  (select count(*) from ad_events e where e.campaign_id = c.id and e.event_type = 'impression') as impressions,
  (select count(*) from ad_events e where e.campaign_id = c.id and e.event_type = 'click') as clicks
from ad_campaigns c;

-- Creative uploads bucket (public: creatives are public by nature).
insert into storage.buckets (id, name, public)
values ('ad-creatives', 'ad-creatives', true)
on conflict (id) do nothing;

create policy "ad creatives upload own"
  on storage.objects for insert
  with check (bucket_id = 'ad-creatives' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ad creatives public read"
  on storage.objects for select
  using (bucket_id = 'ad-creatives');

-- ---------------------------------------------------------------------------
-- Job marketplace
-- ---------------------------------------------------------------------------

create table job_posts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id) on delete cascade,
  posted_by    uuid not null references users (id),
  title        text not null,
  description  text not null,
  location     text,
  job_type     job_type not null default 'full_time',
  apply_url    text,
  apply_email  text,
  is_featured  boolean not null default false,   -- paid placement, admin/webhook-set
  status       content_status not null default 'published',
  expires_at   timestamptz not null default now() + interval '60 days',
  created_at   timestamptz not null default now()
);

create index job_posts_active_idx on job_posts (created_at desc) where status = 'published';

alter table job_posts enable row level security;

create policy "jobs public read" on job_posts for select
  using (status = 'published' and expires_at > now());
create policy "jobs rep insert" on job_posts for insert
  with check (posted_by = auth.uid() and is_company_rep(company_id));
create policy "jobs rep manage" on job_posts for update
  using (is_company_rep(company_id)) with check (is_company_rep(company_id));
create policy "jobs admin" on job_posts for all using (is_admin()) with check (is_admin());

-- Featured placement is paid — reps cannot self-feature.
create or replace function guard_job_featured()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() and auth.uid() is not null
     and new.is_featured and (tg_op = 'INSERT' or not old.is_featured) then
    raise exception 'MARINE_IQ_JOBS: featured placement is applied after purchase';
  end if;
  return new;
end;
$$;

create trigger on_job_write
  before insert or update on job_posts
  for each row execute function guard_job_featured();

-- ---------------------------------------------------------------------------
-- Service marketplace (webinars, reports, surveys, ...)
-- ---------------------------------------------------------------------------

create table marketplace_orders (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null references companies (id) on delete cascade,
  buyer_user_id             uuid not null references users (id),
  service                   marketplace_service not null,
  details                   text,
  amount_usd                numeric(10,2),
  status                    order_status not null default 'pending_payment',
  stripe_checkout_session_id text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table marketplace_orders enable row level security;

create policy "orders insert reps" on marketplace_orders for insert
  with check (buyer_user_id = auth.uid() and is_company_rep(company_id));
create policy "orders read own" on marketplace_orders for select
  using (buyer_user_id = auth.uid() or is_company_rep(company_id) or is_admin());
create policy "orders admin" on marketplace_orders for all using (is_admin()) with check (is_admin());
