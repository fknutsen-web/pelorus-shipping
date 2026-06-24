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
