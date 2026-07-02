-- Marine IQ — core schema
-- A verified maritime-only intelligence & reputation network.
-- Migration 1 of 3: extensions, enums, tables, constraints, indexes.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type verification_status as enum (
  'pending',
  'verified_professional',
  'verified_company_rep',
  'verified_software_vendor',
  'verified_conference_organizer',
  'rejected',
  'suspended'
);

create type user_role as enum ('member', 'moderator', 'admin');

create type verification_method as enum (
  'corporate_email_domain',
  'linkedin_review',
  'business_card',
  'conference_badge',
  'manual_admin'
);

create type verification_doc_type as enum ('business_card', 'conference_badge', 'other');

create type doc_review_status as enum ('pending', 'accepted', 'rejected');

create type relationship_type as enum (
  'customer',
  'supplier',
  'vendor',
  'broker',
  'agent',
  'partner',
  'former_employee',
  'current_employee',
  'conference_attendee',
  'software_user',
  'other'
);

create type review_entity as enum ('company', 'software', 'conference');

create type content_status as enum (
  'pending_moderation',
  'published',
  'under_review',
  'removed'
);

create type claim_status as enum ('pending', 'approved', 'rejected');

create type flag_reason as enum (
  'personal_attack',
  'defamation_risk',
  'profanity',
  'threat',
  'commercial_spam',
  'self_promotion',
  'conflict_of_interest',
  'duplicate_review',
  'suspicious_voting',
  'unsupported_accusation',
  'other'
);

create type flag_status as enum ('open', 'resolved_removed', 'resolved_kept', 'dismissed');

create type flag_target as enum ('review', 'comment', 'post', 'user', 'company');

create type post_type as enum (
  'general',
  'question',
  'company_discussion',
  'software_discussion',
  'conference_discussion',
  'market_observation',
  'request_for_feedback'
);

create type vote_target as enum ('review', 'comment', 'post');

-- Legal-safe trust signal taxonomy. No "blacklist"/"scam" language anywhere.
create type trust_signal_type as enum (
  'reported_payment_concern',
  'verified_dispute_signal',
  'communication_concern',
  'contract_performance_concern',
  'public_legal_reference',
  'low_confidence_pattern'
);

create type trust_signal_status as enum ('pending_admin_review', 'published', 'dismissed');

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table sectors (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null unique
);

-- Software categories (chartering, DA/agency, crewing, ERP, weather routing, ...)
create table categories (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null unique
);

-- ---------------------------------------------------------------------------
-- Users & verification
-- ---------------------------------------------------------------------------

-- Private account record. One row per auth.users row. Never exposed publicly:
-- public data lives in professional_profiles.
create table users (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 citext not null unique,
  full_name             text not null,
  company_name          text not null,
  company_id            uuid,                       -- linked once matched to directory (fk added below)
  job_title             text not null,
  linkedin_url          text not null,
  country               text not null,
  sector_id             bigint references sectors (id),
  status                verification_status not null default 'pending',
  role                  user_role not null default 'member',
  verification_methods  verification_method[] not null default '{}',
  internal_notes        text,                       -- admin-only, never public
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Uploaded business cards / conference badges. Files live in the private
-- 'verification-docs' storage bucket; this table tracks review state.
create table verification_documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  doc_type      verification_doc_type not null,
  storage_path  text not null,
  status        doc_review_status not null default 'pending',
  reviewed_by   uuid references users (id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Public professional profile, auto-created when a user is verified.
create table professional_profiles (
  user_id            uuid primary key references users (id) on delete cascade,
  display_name       text not null,
  company_name       text not null,
  title              text not null,
  country            text not null,
  sector_id          bigint references sectors (id),
  years_experience   int check (years_experience between 0 and 70),
  specialties        text[] not null default '{}',
  bio                text,
  is_public          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create table companies (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  sector_id    bigint references sectors (id),
  hq_country   text,
  hq_city      text,
  offices      text[] not null default '{}',
  website      text,
  description  text,
  is_claimed   boolean not null default false,
  created_by   uuid references users (id),
  merged_into  uuid references companies (id),      -- set when admins merge duplicates
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table users
  add constraint users_company_id_fkey
  foreign key (company_id) references companies (id) on delete set null;

create table company_claims (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies (id) on delete cascade,
  user_id          uuid not null references users (id) on delete cascade,
  corporate_email  citext not null,
  evidence         text,
  status           claim_status not null default 'pending',
  reviewed_by      uuid references users (id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- Approved representatives may respond to reviews / post official comments.
create table company_representatives (
  company_id  uuid not null references companies (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  rep_title   text,
  added_by    uuid references users (id),
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Software & conferences
-- ---------------------------------------------------------------------------

create table software_products (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  vendor_company_id  uuid references companies (id),
  vendor_name        text,                          -- fallback until vendor is in directory
  category_id        bigint references categories (id),
  description        text,
  website            text,
  pricing_model      text,
  created_by         uuid references users (id),
  created_at         timestamptz not null default now()
);

create table conferences (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null,
  organizer_company_id  uuid references companies (id),
  organizer_name        text,
  location              text,
  sector_id             bigint references sectors (id),
  website               text,
  typical_cost_estimate text,                       -- e.g. "USD 2,000–4,000 incl. travel"
  attendee_categories   text[] not null default '{}',
  created_by            uuid references users (id),
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

-- One polymorphic review table: exactly one target column is set, matching
-- entity_type. Score categories live in review_scores.
create table reviews (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references users (id) on delete cascade,
  entity_type        review_entity not null,
  company_id         uuid references companies (id) on delete cascade,
  software_id        uuid references software_products (id) on delete cascade,
  conference_id      uuid references conferences (id) on delete cascade,
  relationship       relationship_type not null,
  title              text not null,
  body               text not null,
  overall_rating     int check (overall_rating between 1 and 5),
  -- Relationship weight applied to scores (set by trigger, see migration 2).
  weight             numeric(3,2) not null default 1.00,
  -- Conference-specific structured answers (attended year, role, who should
  -- attend/skip, generated business, etc.).
  answers            jsonb not null default '{}'::jsonb,
  attended_year      int check (attended_year between 1990 and 2100),
  would_attend_again boolean,
  status             content_status not null default 'pending_moderation',
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint reviews_one_target check (
    (entity_type = 'company'    and company_id    is not null and software_id is null and conference_id is null) or
    (entity_type = 'software'   and software_id   is not null and company_id  is null and conference_id is null) or
    (entity_type = 'conference' and conference_id is not null and company_id  is null and software_id   is null)
  ),
  -- Current employees may comment but not rate.
  constraint reviews_no_current_employee_rating check (
    relationship <> 'current_employee' or overall_rating is null
  )
);

-- One review per author per target (duplicates are a moderation flag anyway).
create unique index reviews_unique_company    on reviews (author_id, company_id)    where company_id    is not null;
create unique index reviews_unique_software   on reviews (author_id, software_id)   where software_id   is not null;
create unique index reviews_unique_conference on reviews (author_id, conference_id) where conference_id is not null;

-- Per-category structured scores.
-- company:    payment_reliability, communication, operational_reliability,
--             contract_performance, claims_handling, commercial_professionalism
-- software:   ease_of_use, implementation, customer_support, reporting,
--             integration, ai_features, roi, hidden_cost
-- conference: networking, decision_maker_attendance, content_quality,
--             exhibitor_value, deal_generation, roi
create table review_scores (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references reviews (id) on delete cascade,
  category   text not null,
  score      int not null check (score between 1 and 5),
  unique (review_id, category)
);

-- ---------------------------------------------------------------------------
-- Comments, feed, votes, endorsements
-- ---------------------------------------------------------------------------

create table comments (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references users (id) on delete cascade,
  -- exactly one parent
  review_id       uuid references reviews (id) on delete cascade,
  post_id         uuid,                             -- fk added after posts
  company_id      uuid references companies (id) on delete cascade,
  software_id     uuid references software_products (id) on delete cascade,
  conference_id   uuid references conferences (id) on delete cascade,
  body            text not null,
  -- true when the author represents the company being discussed; rendered as
  -- a "Company Representative" label.
  is_company_rep  boolean not null default false,
  status          content_status not null default 'published',
  created_at      timestamptz not null default now(),

  constraint comments_one_parent check (
    (review_id is not null)::int + (post_id is not null)::int +
    (company_id is not null)::int + (software_id is not null)::int +
    (conference_id is not null)::int = 1
  )
);

create table posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references users (id) on delete cascade,
  post_type      post_type not null default 'general',
  title          text,
  body           text not null,
  tags           text[] not null default '{}',
  company_id     uuid references companies (id) on delete set null,
  software_id    uuid references software_products (id) on delete set null,
  conference_id  uuid references conferences (id) on delete set null,
  status         content_status not null default 'published',
  created_at     timestamptz not null default now()
);

alter table comments
  add constraint comments_post_id_fkey
  foreign key (post_id) references posts (id) on delete cascade;

create table votes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  target_type  vote_target not null,
  target_id    uuid not null,
  value        int not null default 1 check (value = 1),   -- "helpful"
  created_at   timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table endorsements (
  id           uuid primary key default gen_random_uuid(),
  endorser_id  uuid not null references users (id) on delete cascade,
  endorsed_id  uuid not null references users (id) on delete cascade,
  specialty    text not null,
  note         text,
  created_at   timestamptz not null default now(),
  unique (endorser_id, endorsed_id, specialty),
  constraint no_self_endorsement check (endorser_id <> endorsed_id)
);

-- ---------------------------------------------------------------------------
-- Moderation, audit, reputation, trust index
-- ---------------------------------------------------------------------------

create table moderation_flags (
  id           uuid primary key default gen_random_uuid(),
  target_type  flag_target not null,
  target_id    uuid not null,
  reason       flag_reason not null,
  details      text,
  flagged_by   uuid references users (id),          -- null = automated screen
  status       flag_status not null default 'open',
  resolved_by  uuid references users (id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references users (id),
  action       text not null,
  target_type  text,
  target_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table reputation_scores (
  user_id     uuid primary key references users (id) on delete cascade,
  score       int not null default 0,
  tier        text not null default 'Verified Professional',
  components  jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Commercial Trust Index signals. Structured, non-defamatory risk records.
-- Every signal requires admin review before publication (enforced by default
-- status + RLS: only admins can set status = 'published').
create table trust_signals (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies (id) on delete cascade,
  signal_type       trust_signal_type not null,
  description       text not null,
  source_review_id  uuid references reviews (id) on delete set null,
  reference_url     text,                           -- e.g. public arbitration record
  created_by        uuid references users (id),
  status            trust_signal_status not null default 'pending_admin_review',
  reviewed_by       uuid references users (id),
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index users_status_idx            on users (status);
create index users_company_idx           on users (company_id);
create index companies_sector_idx        on companies (sector_id);
create index companies_name_idx          on companies (lower(name));
create index software_category_idx       on software_products (category_id);
create index software_vendor_idx         on software_products (vendor_company_id);
create index conferences_organizer_idx   on conferences (organizer_company_id);
create index reviews_company_idx         on reviews (company_id)    where company_id is not null;
create index reviews_software_idx        on reviews (software_id)   where software_id is not null;
create index reviews_conference_idx      on reviews (conference_id) where conference_id is not null;
create index reviews_status_idx          on reviews (status);
create index review_scores_review_idx    on review_scores (review_id);
create index comments_review_idx         on comments (review_id) where review_id is not null;
create index comments_post_idx           on comments (post_id) where post_id is not null;
create index comments_company_idx        on comments (company_id) where company_id is not null;
create index posts_created_idx           on posts (created_at desc);
create index votes_target_idx            on votes (target_type, target_id);
create index flags_status_idx            on moderation_flags (status);
create index audit_created_idx           on audit_logs (created_at desc);
create index trust_signals_company_idx   on trust_signals (company_id, status);
create index verification_docs_user_idx  on verification_documents (user_id);
