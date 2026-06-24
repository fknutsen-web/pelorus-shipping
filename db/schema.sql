-- NOTE: this table has ALREADY been created in the Supabase project 'fredheim'
-- (ref: bizbneqlzacvhekrbrgd) as public.pelorus_leads. Kept here for reference
-- / re-deploys to other environments.

-- Run in the Supabase SQL editor.
create extension if not exists "pgcrypto";

create table if not exists public.pelorus_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text,
  company       text,
  email         text,
  selected_tier text,
  inputs        jsonb,
  quote         jsonb
);

-- Lock the table down: only the server (service-role key) reads/writes it.
alter table public.pelorus_leads enable row level security;
-- No anon/public policies are created, so the table is inaccessible to the
-- public anon key. The serverless functions use the service-role key, which
-- bypasses RLS. This keeps every lead private.

-- ---------------------------------------------------------------------------
-- Engagement requests (Phase 1 of the online order flow).
-- A client configures a single-voyage engagement, accepts the request terms
-- (clickwrap), and submits. Pelorus confirms the fee and (later phases) sends
-- an engagement letter to sign. The website click is NOT a binding contract.
-- ---------------------------------------------------------------------------
create table if not exists public.pelorus_engagements (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  ref              text unique,                 -- human-friendly, e.g. PEL-2026-0042
  status           text not null default 'requested',
  -- requested -> under_review -> confirmed -> sent -> signed -> active -> declined/withdrawn
  contact_name     text,
  company          text,
  email            text,
  phone            text,
  country          text,
  commitment       text,                        -- single_voyage (only orderable tier in Phase 1)
  lanes            text,
  inputs           jsonb,                        -- configurator inputs (authoritative basis)
  indicative_quote jsonb,                        -- server-computed fee shown to the client
  confirmed_quote  jsonb,                        -- fee after human review (later)
  terms_version    text,                         -- clickwrap terms version accepted
  accepted_at      timestamptz,
  accept_ip        text,
  accept_ua        text,
  esign_provider   text,                         -- later phases
  esign_envelope   text,
  signed_pdf_url   text,
  deposit_status   text,                         -- none | pending | paid | refunded
  deposit_amount   integer,                       -- in cents (e.g. 50000 = $500)
  stripe_session   text,                          -- Stripe Checkout Session id
  notes            text
);

alter table public.pelorus_engagements enable row level security;
-- No anon/public policies -> only the service-role key (serverless functions)
-- can read/write. Same lock-down as pelorus_leads.
