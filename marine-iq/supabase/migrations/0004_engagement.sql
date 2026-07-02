-- Marine IQ — migration 4: notifications, official responses, leads, AI summaries.
-- Notification fan-out happens in triggers so every write path (app, API,
-- future mobile client) produces the same registrant notifications.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type notification_type as enum (
  'new_review',
  'rating_change',
  'new_comment',
  'new_question',
  'new_mention',
  'ranking_entry',
  'content_flagged',
  'official_response',
  'new_endorsement',
  'helpful_vote',
  'new_lead',
  'claim_decision',
  'verification_decision',
  'system'
);

create type digest_frequency as enum ('immediate', 'daily', 'weekly', 'off');

create type lead_type as enum (
  'request_demo', 'request_quote', 'contact_sales',
  'become_partner', 'book_meeting', 'download_brochure'
);

create type lead_status as enum ('new', 'viewed', 'responded', 'closed');

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table notification_preferences (
  user_id     uuid primary key references users (id) on delete cascade,
  in_app      boolean not null default true,
  email       boolean not null default true,
  frequency   digest_frequency not null default 'immediate',
  updated_at  timestamptz not null default now()
);

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  type         notification_type not null,
  title        text not null,
  body         text,
  link         text,
  read_at      timestamptz,
  emailed_at   timestamptz,          -- set by the digest/email worker
  created_at   timestamptz not null default now()
);

create index notifications_user_unread_idx on notifications (user_id, created_at desc)
  where read_at is null;
create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_unemailed_idx on notifications (created_at)
  where emailed_at is null;

alter table notification_preferences enable row level security;
alter table notifications enable row level security;

create policy "prefs own" on notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications read own" on notifications
  for select using (user_id = auth.uid());
create policy "notifications update own" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notification fan-out helpers
-- ---------------------------------------------------------------------------

create or replace function notify_user(
  target uuid, ntype notification_type, ntitle text, nbody text, nlink text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if target is null then return; end if;
  insert into notifications (user_id, type, title, body, link)
  values (target, ntype, ntitle, nbody, nlink);
end;
$$;

-- Notify everyone who represents a company (claim-approved reps).
create or replace function notify_company_reps(
  target_company uuid, ntype notification_type, ntitle text, nbody text, nlink text
) returns void
language plpgsql security definer set search_path = public
as $$
declare rep record;
begin
  if target_company is null then return; end if;
  for rep in select user_id from company_representatives where company_id = target_company loop
    perform notify_user(rep.user_id, ntype, ntitle, nbody, nlink);
  end loop;
end;
$$;

-- Resolve the owning company + display name + public path of a review target.
create or replace function review_target_info(r reviews)
returns table (owner_company uuid, target_name text, target_path text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if r.entity_type = 'company' then
    return query select c.id, c.name, '/companies/' || c.slug from companies c where c.id = r.company_id;
  elsif r.entity_type = 'software' then
    return query select s.vendor_company_id, s.name, '/software/' || s.slug from software_products s where s.id = r.software_id;
  else
    return query select c.organizer_company_id, c.name, '/conferences/' || c.slug from conferences c where c.id = r.conference_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: reviews, comments, endorsements, votes, flags, posts
-- ---------------------------------------------------------------------------

-- New published review → notify the registrant (company/vendor/organizer reps)
-- and mark the AI summary stale.
create or replace function on_review_published()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare info record;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select * into info from review_target_info(new);
    perform notify_company_reps(
      info.owner_company, 'new_review',
      'New review of ' || info.target_name,
      left(new.title, 140), info.target_path
    );
    insert into ai_summaries (entity_type, entity_id, is_stale)
    values (new.entity_type, coalesce(new.company_id, new.software_id, new.conference_id), true)
    on conflict (entity_type, entity_id) do update set is_stale = true;
  end if;
  return new;
end;
$$;

-- New comment → notify the entity's reps; questions on posts/comments are
-- detected naively by a question mark. Review authors are notified of replies.
create or replace function on_comment_published()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r reviews%rowtype;
  info record;
  ntype notification_type;
begin
  if new.status <> 'published' then return new; end if;
  ntype := case when new.body like '%?%' then 'new_question' else 'new_comment' end;

  if new.company_id is not null then
    select id, name, '/companies/' || slug as path into info from companies where id = new.company_id;
    perform notify_company_reps(new.company_id, ntype,
      case when ntype = 'new_question' then 'New question about ' else 'New comment on ' end || info.name,
      left(new.body, 140), info.path);
  elsif new.software_id is not null then
    perform notify_company_reps(
      (select vendor_company_id from software_products where id = new.software_id), ntype,
      'New comment on ' || (select name from software_products where id = new.software_id),
      left(new.body, 140), '/software/' || (select slug from software_products where id = new.software_id));
  elsif new.conference_id is not null then
    perform notify_company_reps(
      (select organizer_company_id from conferences where id = new.conference_id), ntype,
      'New comment on ' || (select name from conferences where id = new.conference_id),
      left(new.body, 140), '/conferences/' || (select slug from conferences where id = new.conference_id));
  elsif new.review_id is not null then
    select * into r from reviews where id = new.review_id;
    if r.author_id is distinct from new.author_id then
      perform notify_user(r.author_id,
        (case when new.is_official_response then 'official_response' else 'new_comment' end)::notification_type,
        case when new.is_official_response then 'Official company response to your review' else 'New reply to your review' end,
        left(new.body, 140),
        (select target_path from review_target_info(r)));
    end if;
  end if;
  return new;
end;
$$;

-- Endorsement → notify the endorsed professional.
create or replace function on_endorsement_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform notify_user(new.endorsed_id, 'new_endorsement',
    'New peer endorsement: ' || new.specialty, null, '/professionals/' || new.endorsed_id);
  return new;
end;
$$;

-- Helpful vote → notify the content author.
create or replace function on_vote_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare author uuid;
begin
  if new.target_type = 'review' then
    select author_id into author from reviews where id = new.target_id;
  elsif new.target_type = 'comment' then
    select author_id into author from comments where id = new.target_id;
  else
    select author_id into author from posts where id = new.target_id;
  end if;
  if author is distinct from new.user_id then
    perform notify_user(author, 'helpful_vote', 'Someone found your contribution helpful', null, '/dashboard');
  end if;
  return new;
end;
$$;

-- Moderation flag on a review → notify the involved company's reps.
create or replace function on_flag_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare r reviews%rowtype; info record;
begin
  if new.target_type = 'review' then
    select * into r from reviews where id = new.target_id;
    if r.id is not null then
      select * into info from review_target_info(r);
      perform notify_company_reps(info.owner_company, 'content_flagged',
        'Content involving ' || info.target_name || ' was flagged for moderation',
        null, info.target_path);
    end if;
  end if;
  return new;
end;
$$;

-- Post that references a company → notify its reps (mention in discussion).
create or replace function on_post_published()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'published' and new.company_id is not null then
    perform notify_company_reps(new.company_id, 'new_mention',
      'Your company was mentioned in a discussion',
      left(coalesce(new.title, new.body), 140), '/feed');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Official company responses (one per review, reps only)
-- ---------------------------------------------------------------------------

alter table comments add column is_official_response boolean not null default false;

create unique index one_official_response_per_review
  on comments (review_id) where is_official_response;

-- Only an approved representative of the reviewed company may post the
-- official response; it is always also labeled is_company_rep.
create or replace function enforce_official_response()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare r reviews%rowtype; owner uuid;
begin
  if new.is_official_response then
    if new.review_id is null then
      raise exception 'MARINE_IQ_OFFICIAL: official responses attach to a review';
    end if;
    select * into r from reviews where id = new.review_id;
    select owner_company into owner from review_target_info(r);
    if owner is null or not exists (
      select 1 from company_representatives
      where company_id = owner and user_id = new.author_id
    ) then
      raise exception 'MARINE_IQ_OFFICIAL: only approved company representatives can post the official response';
    end if;
    new.is_company_rep := true;
  end if;
  return new;
end;
$$;

create trigger on_official_response
  before insert on comments
  for each row execute function enforce_official_response();

-- ---------------------------------------------------------------------------
-- AI summaries
-- ---------------------------------------------------------------------------

create table ai_summaries (
  entity_type   review_entity not null,
  entity_id     uuid not null,
  summary       text,
  review_count  int not null default 0,
  is_stale      boolean not null default true,
  generated_at  timestamptz,
  primary key (entity_type, entity_id)
);

alter table ai_summaries enable row level security;
create policy "summaries public read" on ai_summaries for select using (true);
create policy "summaries admin"       on ai_summaries for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Leads (Request Demo / Quote / Contact Sales / Partner / Meeting / Brochure)
-- ---------------------------------------------------------------------------

create table leads (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies (id) on delete cascade,
  lead_type     lead_type not null,
  from_user_id  uuid references users (id) on delete set null,
  name          text not null,
  email         text not null,
  message       text,
  status        lead_status not null default 'new',
  created_at    timestamptz not null default now()
);

create index leads_company_idx on leads (company_id, created_at desc);

alter table leads enable row level security;

-- Any signed-in user can submit a lead; reps of the company (and admins) read
-- and manage them. Leads are never public.
create policy "leads insert signed-in" on leads
  for insert with check (auth.uid() is not null and (from_user_id is null or from_user_id = auth.uid()));
create policy "leads read reps" on leads
  for select using (is_company_rep(company_id) or is_admin());
create policy "leads manage reps" on leads
  for update using (is_company_rep(company_id) or is_admin())
  with check (is_company_rep(company_id) or is_admin());

create or replace function on_lead_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform notify_company_reps(new.company_id, 'new_lead',
    'New lead: ' || replace(new.lead_type::text, '_', ' '),
    new.name || ' — ' || left(coalesce(new.message, ''), 120),
    '/dashboard/leads');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wire up triggers
-- ---------------------------------------------------------------------------

create trigger notify_on_review_insert  after insert on reviews  for each row execute function on_review_published();
create trigger notify_on_review_update  after update on reviews  for each row execute function on_review_published();
create trigger notify_on_comment        after insert on comments for each row execute function on_comment_published();
create trigger notify_on_endorsement    after insert on endorsements for each row execute function on_endorsement_created();
create trigger notify_on_vote           after insert on votes    for each row execute function on_vote_created();
create trigger notify_on_flag           after insert on moderation_flags for each row execute function on_flag_created();
create trigger notify_on_post           after insert on posts    for each row execute function on_post_published();
create trigger notify_on_lead           after insert on leads    for each row execute function on_lead_created();
