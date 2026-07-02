-- Marine IQ — migration 2 of 3: helper functions, triggers, score views.
-- Business rules (conflicts of interest, rating locks, weighting) are
-- enforced HERE, in the database — the UI is only a convenience layer.

-- ---------------------------------------------------------------------------
-- Helper functions (used by RLS policies and triggers)
-- ---------------------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from users
    where id = auth.uid() and role in ('admin', 'moderator')
  );
$$;

create or replace function is_verified()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from users
    where id = auth.uid()
      and status in ('verified_professional', 'verified_company_rep',
                     'verified_software_vendor', 'verified_conference_organizer')
  );
$$;

create or replace function current_user_company()
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from users where id = auth.uid();
$$;

create or replace function current_user_company_name()
returns text
language sql stable security definer set search_path = public
as $$
  select company_name from users where id = auth.uid();
$$;

create or replace function is_company_rep(target_company uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from company_representatives
    where company_id = target_company and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Signup: create the private account row from auth metadata
-- ---------------------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into users (id, email, full_name, company_name, job_title, linkedin_url, country, sector_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', ''),
    coalesce(new.raw_user_meta_data ->> 'job_title', ''),
    coalesce(new.raw_user_meta_data ->> 'linkedin_url', ''),
    coalesce(new.raw_user_meta_data ->> 'country', ''),
    nullif(new.raw_user_meta_data ->> 'sector_id', '')::bigint
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Verification: auto-create the public professional profile + reputation row
-- when a user transitions into any verified status. Log the decision.
-- ---------------------------------------------------------------------------

create or replace function handle_user_verified()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status in ('verified_professional', 'verified_company_rep',
                    'verified_software_vendor', 'verified_conference_organizer')
     and old.status is distinct from new.status then

    insert into professional_profiles (user_id, display_name, company_name, title, country, sector_id)
    values (new.id, new.full_name, new.company_name, new.job_title, new.country, new.sector_id)
    on conflict (user_id) do nothing;

    insert into reputation_scores (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;

  -- Suspended/rejected users lose public visibility.
  if new.status in ('rejected', 'suspended') then
    update professional_profiles set is_public = false where user_id = new.id;
  end if;

  if old.status is distinct from new.status then
    insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'user_status_change', 'user', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger on_user_status_change
  before update on users
  for each row execute function handle_user_verified();

-- ---------------------------------------------------------------------------
-- Reviews: conflict-of-interest enforcement + relationship weighting.
-- These raise exceptions server-side; the UI cannot bypass them.
-- ---------------------------------------------------------------------------

create or replace function relationship_weight(rel relationship_type)
returns numeric
language sql immutable
as $$
  select case rel
    when 'customer'            then 1.00  -- verified customer: highest
    when 'software_user'       then 1.00  -- verified direct user: highest
    when 'conference_attendee' then 1.00
    when 'supplier'            then 0.60  -- medium
    when 'partner'             then 0.60
    when 'vendor'              then 0.60
    when 'broker'              then 0.60
    when 'agent'               then 0.60
    when 'former_employee'     then 0.30  -- lower
    when 'current_employee'    then 0.00  -- comments only, zero rating weight
    else 0.50                             -- other
  end;
$$;

create or replace function enforce_review_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  author            users%rowtype;
  target_company    uuid;
  target_name       text;
begin
  select * into author from users where id = new.author_id;

  if author.id is null then
    raise exception 'MARINE_IQ_NO_ACCOUNT: review author has no account record';
  end if;

  -- Only verified users can contribute. No anonymous reviews.
  if author.status not in ('verified_professional', 'verified_company_rep',
                           'verified_software_vendor', 'verified_conference_organizer') then
    raise exception 'MARINE_IQ_NOT_VERIFIED: only verified maritime professionals can submit reviews';
  end if;

  -- Resolve the company behind the review target.
  if new.entity_type = 'company' then
    target_company := new.company_id;
    select name into target_name from companies where id = new.company_id;
  elsif new.entity_type = 'software' then
    select vendor_company_id, coalesce(vendor_name, name)
      into target_company, target_name
      from software_products where id = new.software_id;
  elsif new.entity_type = 'conference' then
    select organizer_company_id, coalesce(organizer_name, name)
      into target_company, target_name
      from conferences where id = new.conference_id;
  end if;

  -- Conflict of interest: cannot rate your own employer, software sold by
  -- your own company, or a conference organized by your own company.
  -- Matched by linked company id AND by company-name text as a fallback.
  if new.overall_rating is not null or exists (select 1 from review_scores where review_id = new.id) then
    if target_company is not null and author.company_id is not null
       and target_company = author.company_id then
      raise exception 'MARINE_IQ_CONFLICT: you cannot rate your own company or its products';
    end if;
    if target_name is not null and author.company_name <> ''
       and lower(trim(target_name)) = lower(trim(author.company_name)) then
      raise exception 'MARINE_IQ_CONFLICT: you cannot rate your own company or its products';
    end if;
    if new.entity_type = 'company'
       and lower(trim((select name from companies where id = new.company_id))) = lower(trim(author.company_name)) then
      raise exception 'MARINE_IQ_CONFLICT: you cannot rate your own company';
    end if;
    -- Current employees: comments only.
    if new.relationship = 'current_employee' then
      raise exception 'MARINE_IQ_CONFLICT: current employees may comment but not rate';
    end if;
  end if;

  new.weight := relationship_weight(new.relationship);
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_review_write
  before insert or update on reviews
  for each row execute function enforce_review_rules();

-- Rating lock: authors cannot edit a review after 14 days of publication.
-- Admin edits (or admin-approved edits performed via service role) bypass RLS
-- entirely, so this guards the author path.
create or replace function enforce_review_lock()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.author_id
     and old.published_at is not null
     and old.published_at < now() - interval '14 days'
     and not is_admin() then
    raise exception 'MARINE_IQ_LOCKED: reviews are locked 14 days after publication; contact an admin';
  end if;
  return new;
end;
$$;

create trigger on_review_lock
  before update on reviews
  for each row execute function enforce_review_lock();

-- Same verification gate for comments, posts, votes, endorsements. The gate
-- checks the row's contributor column (RLS separately guarantees that column
-- matches auth.uid() for non-service-role writes).
create or replace function enforce_contributor_verified()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  row_data    jsonb := to_jsonb(new);
  contributor uuid;
begin
  contributor := coalesce(
    (row_data ->> 'author_id')::uuid,     -- comments, posts
    (row_data ->> 'user_id')::uuid,       -- votes
    (row_data ->> 'endorser_id')::uuid    -- endorsements
  );

  if not exists (
    select 1 from users
    where id = contributor
      and status in ('verified_professional', 'verified_company_rep',
                     'verified_software_vendor', 'verified_conference_organizer')
  ) then
    raise exception 'MARINE_IQ_NOT_VERIFIED: only verified members can contribute';
  end if;
  return new;
end;
$$;

create trigger on_comment_insert  before insert on comments     for each row execute function enforce_contributor_verified();
create trigger on_post_insert     before insert on posts        for each row execute function enforce_contributor_verified();
create trigger on_vote_insert     before insert on votes        for each row execute function enforce_contributor_verified();
create trigger on_endorse_insert  before insert on endorsements for each row execute function enforce_contributor_verified();

-- Comments on a company by that company's own people are auto-labeled
-- "Company Representative" — the label is data, not an honor system.
create or replace function label_company_rep_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  discussed_company uuid;
begin
  discussed_company := new.company_id;
  if discussed_company is null and new.review_id is not null then
    select r.company_id into discussed_company from reviews r where r.id = new.review_id;
    if discussed_company is null then
      select s.vendor_company_id into discussed_company
        from reviews r join software_products s on s.id = r.software_id
        where r.id = new.review_id;
    end if;
    if discussed_company is null then
      select c.organizer_company_id into discussed_company
        from reviews r join conferences c on c.id = r.conference_id
        where r.id = new.review_id;
    end if;
  end if;

  if discussed_company is not null then
    if exists (select 1 from users u where u.id = new.author_id and u.company_id = discussed_company)
       or exists (select 1 from company_representatives cr
                  where cr.user_id = new.author_id and cr.company_id = discussed_company) then
      new.is_company_rep := true;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_comment_label
  before insert on comments
  for each row execute function label_company_rep_comment();

-- ---------------------------------------------------------------------------
-- Company claims: approval wires up representative + claimed flag, audited.
-- ---------------------------------------------------------------------------

create or replace function handle_claim_decision()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update companies set is_claimed = true, updated_at = now() where id = new.company_id;
    insert into company_representatives (company_id, user_id, added_by)
    values (new.company_id, new.user_id, auth.uid())
    on conflict do nothing;
    update users set company_id = new.company_id where id = new.user_id and company_id is null;
  end if;

  if old.status is distinct from new.status then
    new.reviewed_at := now();
    insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'company_claim_' || new.status, 'company_claim', new.id::text,
            jsonb_build_object('company_id', new.company_id, 'user_id', new.user_id));
  end if;
  return new;
end;
$$;

create trigger on_claim_decision
  before update on company_claims
  for each row execute function handle_claim_decision();

-- Trust signals: publication requires admin. Audited on decision.
create or replace function handle_trust_signal_decision()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'published' and not is_admin() then
      raise exception 'MARINE_IQ_ADMIN_REQUIRED: trust signals require admin review before publication';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (auth.uid(), 'trust_signal_' || new.status, 'trust_signal', new.id::text,
            jsonb_build_object('company_id', new.company_id, 'type', new.signal_type));
  end if;
  return new;
end;
$$;

create trigger on_trust_signal_decision
  before update on trust_signals
  for each row execute function handle_trust_signal_decision();

-- ---------------------------------------------------------------------------
-- Weighted score views (published reviews only)
-- ---------------------------------------------------------------------------

-- Generic weighted per-category scores for every review target.
create or replace view entity_category_scores with (security_invoker = true) as
select
  r.entity_type,
  coalesce(r.company_id, r.software_id, r.conference_id) as entity_id,
  s.category,
  round(sum(s.score * r.weight) / nullif(sum(r.weight), 0), 2) as weighted_score,
  count(*) as review_count
from reviews r
join review_scores s on s.review_id = r.id
where r.status = 'published' and r.weight > 0
group by r.entity_type, coalesce(r.company_id, r.software_id, r.conference_id), s.category;

create or replace view entity_overall_scores with (security_invoker = true) as
select
  r.entity_type,
  coalesce(r.company_id, r.software_id, r.conference_id) as entity_id,
  round(sum(r.overall_rating * r.weight) / nullif(sum(r.weight), 0), 2) as overall_score,
  count(*) filter (where r.overall_rating is not null) as rating_count,
  count(*) as review_count,
  round(100.0 * count(*) filter (where r.would_attend_again is true)
        / nullif(count(*) filter (where r.would_attend_again is not null), 0)) as would_attend_again_pct
from reviews r
where r.status = 'published' and r.weight > 0
group by r.entity_type, coalesce(r.company_id, r.software_id, r.conference_id);

-- Commercial Trust Index: published, admin-reviewed signals + weighted
-- category scores. "Reputation Confidence" grows with verified volume.
create or replace view company_trust_index with (security_invoker = true) as
select
  c.id as company_id,
  c.slug,
  c.name,
  o.overall_score,
  o.review_count,
  coalesce(sig.signal_count, 0) as published_signal_count,
  case
    when coalesce(o.review_count, 0) >= 10 then 'High'
    when coalesce(o.review_count, 0) >= 3  then 'Moderate'
    when coalesce(o.review_count, 0) >= 1  then 'Emerging'
    else 'Insufficient data'
  end as reputation_confidence,
  case
    when coalesce(sig.signal_count, 0) >= 3 then 'Under Review'
    when coalesce(sig.signal_count, 0) >= 1 then 'Risk Indicators Present'
    else 'No Verified Concerns'
  end as risk_label
from companies c
left join entity_overall_scores o
  on o.entity_type = 'company' and o.entity_id = c.id
left join (
  select company_id, count(*) as signal_count
  from trust_signals where status = 'published'
  group by company_id
) sig on sig.company_id = c.id
where c.merged_into is null;

-- Public contribution stats per professional (privacy-safe aggregates).
create or replace view profile_stats with (security_invoker = true) as
select
  p.user_id,
  (select count(*) from reviews r  where r.author_id = p.user_id and r.status = 'published') as reviews_submitted,
  (select count(*) from reviews r  where r.author_id = p.user_id and r.status = 'published' and r.entity_type = 'software') as software_reviewed,
  (select count(*) from reviews r  where r.author_id = p.user_id and r.status = 'published' and r.entity_type = 'conference') as conferences_reviewed,
  (select count(*) from comments c where c.author_id = p.user_id and c.status = 'published') as comments_submitted,
  (select count(*) from votes v
     join reviews r on v.target_type = 'review' and v.target_id = r.id
     where r.author_id = p.user_id) as helpful_votes,
  (select count(*) from endorsements e where e.endorsed_id = p.user_id) as peer_endorsements
from professional_profiles p;
