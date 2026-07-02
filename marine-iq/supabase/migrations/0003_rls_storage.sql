-- Marine IQ — migration 3 of 3: Row Level Security + private storage.
--
-- Privacy model:
--  * `users` is private (email, LinkedIn, notes). Public identity is
--    `professional_profiles` only.
--  * Verification uploads (business cards, badges) live in a PRIVATE bucket;
--    only the owner and admins can read them.
--  * Anonymous visitors can read published content and directories, never
--    contribute.

alter table sectors                  enable row level security;
alter table categories               enable row level security;
alter table users                    enable row level security;
alter table verification_documents   enable row level security;
alter table professional_profiles    enable row level security;
alter table companies                enable row level security;
alter table company_claims           enable row level security;
alter table company_representatives  enable row level security;
alter table software_products        enable row level security;
alter table conferences              enable row level security;
alter table reviews                  enable row level security;
alter table review_scores            enable row level security;
alter table comments                 enable row level security;
alter table posts                    enable row level security;
alter table votes                    enable row level security;
alter table endorsements             enable row level security;
alter table moderation_flags         enable row level security;
alter table audit_logs               enable row level security;
alter table reputation_scores        enable row level security;
alter table trust_signals            enable row level security;

-- Reference data: world-readable, admin-writable.
create policy "sectors readable"      on sectors    for select using (true);
create policy "categories readable"   on categories for select using (true);
create policy "sectors admin write"   on sectors    for all using (is_admin()) with check (is_admin());
create policy "categories admin write" on categories for all using (is_admin()) with check (is_admin());

-- users: owners see/update their own row (not status/role — column protection
-- is handled by a trigger below); admins see and manage everything.
create policy "users read own"    on users for select using (id = auth.uid());
create policy "users read admin"  on users for select using (is_admin());
create policy "users update own"  on users for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users update admin" on users for update using (is_admin()) with check (is_admin());

-- Non-admins must not self-promote or self-verify.
create or replace function prevent_privilege_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() and auth.uid() = old.id then
    if new.status is distinct from old.status
       or new.role is distinct from old.role
       or new.internal_notes is distinct from old.internal_notes
       or new.verification_methods is distinct from old.verification_methods then
      raise exception 'MARINE_IQ_FORBIDDEN: verification status and role are admin-managed';
    end if;
  end if;
  return new;
end;
$$;

create trigger on_user_self_update
  before update on users
  for each row execute function prevent_privilege_escalation();

-- verification_documents: owner + admin only. Nobody deletes except admins.
create policy "docs insert own"  on verification_documents for insert with check (user_id = auth.uid());
create policy "docs read own"    on verification_documents for select using (user_id = auth.uid());
create policy "docs read admin"  on verification_documents for select using (is_admin());
create policy "docs admin manage" on verification_documents for update using (is_admin()) with check (is_admin());
create policy "docs admin delete" on verification_documents for delete using (is_admin());

-- professional_profiles: public when flagged public; owners edit their own.
create policy "profiles public read" on professional_profiles for select using (is_public = true);
create policy "profiles read own"    on professional_profiles for select using (user_id = auth.uid());
create policy "profiles read admin"  on professional_profiles for select using (is_admin());
create policy "profiles update own"  on professional_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles admin"       on professional_profiles for update using (is_admin()) with check (is_admin());

-- companies: directory is public; verified members can add companies
-- (unclaimed); reps update factual info on their own company; admins full.
create policy "companies public read" on companies for select using (merged_into is null or is_admin());
create policy "companies member add"  on companies for insert with check (is_verified() and created_by = auth.uid());
create policy "companies rep update"  on companies for update
  using (is_company_rep(id)) with check (is_company_rep(id));
create policy "companies admin"       on companies for all using (is_admin()) with check (is_admin());

-- company_claims: claimant + admins.
create policy "claims insert own" on company_claims for insert with check (user_id = auth.uid() and is_verified());
create policy "claims read own"   on company_claims for select using (user_id = auth.uid());
create policy "claims read admin" on company_claims for select using (is_admin());
create policy "claims admin"      on company_claims for update using (is_admin()) with check (is_admin());

-- company_representatives: public read (transparency about who speaks for a
-- company); admins manage.
create policy "reps public read" on company_representatives for select using (true);
create policy "reps admin"       on company_representatives for all using (is_admin()) with check (is_admin());

-- software & conferences: public read; verified members can add; admins full.
create policy "software public read" on software_products for select using (true);
create policy "software member add"  on software_products for insert with check (is_verified() and created_by = auth.uid());
create policy "software admin"       on software_products for all using (is_admin()) with check (is_admin());

create policy "conferences public read" on conferences for select using (true);
create policy "conferences member add"  on conferences for insert with check (is_verified() and created_by = auth.uid());
create policy "conferences admin"       on conferences for all using (is_admin()) with check (is_admin());

-- reviews: published visible to everyone; authors see their own in any state;
-- authors insert/update their own (triggers enforce verification, conflicts,
-- and the 14-day lock); admins full control.
create policy "reviews public read" on reviews for select using (status = 'published');
create policy "reviews read own"    on reviews for select using (author_id = auth.uid());
create policy "reviews read admin"  on reviews for select using (is_admin());
create policy "reviews insert own"  on reviews for insert with check (author_id = auth.uid());
create policy "reviews update own"  on reviews for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "reviews admin"       on reviews for all using (is_admin()) with check (is_admin());

create policy "scores read"       on review_scores for select
  using (exists (select 1 from reviews r where r.id = review_id
                 and (r.status = 'published' or r.author_id = auth.uid() or is_admin())));
create policy "scores insert own" on review_scores for insert
  with check (exists (select 1 from reviews r where r.id = review_id and r.author_id = auth.uid()));
create policy "scores admin"      on review_scores for all using (is_admin()) with check (is_admin());

-- comments / posts: published readable by all; authors manage their own;
-- verification enforced by trigger.
create policy "comments public read" on comments for select using (status = 'published');
create policy "comments read own"    on comments for select using (author_id = auth.uid());
create policy "comments read admin"  on comments for select using (is_admin());
create policy "comments insert own"  on comments for insert with check (author_id = auth.uid());
create policy "comments admin"       on comments for all using (is_admin()) with check (is_admin());

create policy "posts public read" on posts for select using (status = 'published');
create policy "posts read own"    on posts for select using (author_id = auth.uid());
create policy "posts read admin"  on posts for select using (is_admin());
create policy "posts insert own"  on posts for insert with check (author_id = auth.uid());
create policy "posts update own"  on posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "posts admin"       on posts for all using (is_admin()) with check (is_admin());

-- votes & endorsements
create policy "votes read"       on votes for select using (true);
create policy "votes insert own" on votes for insert with check (user_id = auth.uid());
create policy "votes delete own" on votes for delete using (user_id = auth.uid());

create policy "endorsements read"       on endorsements for select using (true);
create policy "endorsements insert own" on endorsements for insert with check (endorser_id = auth.uid());
create policy "endorsements delete own" on endorsements for delete using (endorser_id = auth.uid());

-- moderation_flags: verified members may raise flags; only admins read/resolve
-- (flag contents can be sensitive).
create policy "flags insert verified" on moderation_flags for insert
  with check (is_verified() and (flagged_by = auth.uid() or flagged_by is null));
create policy "flags read admin"      on moderation_flags for select using (is_admin());
create policy "flags admin"           on moderation_flags for update using (is_admin()) with check (is_admin());

-- audit_logs: append via triggers/service role; admins read. Nobody updates
-- or deletes (no policies granted).
create policy "audit read admin" on audit_logs for select using (is_admin());

-- reputation_scores: public read (drives labels on profiles); system-managed.
create policy "reputation public read" on reputation_scores for select using (true);
create policy "reputation admin"       on reputation_scores for all using (is_admin()) with check (is_admin());

-- trust_signals: published ones public; contributors see their own submissions;
-- verified members submit (default status pending_admin_review); admins decide.
create policy "signals public read"   on trust_signals for select using (status = 'published');
create policy "signals read own"      on trust_signals for select using (created_by = auth.uid());
create policy "signals read admin"    on trust_signals for select using (is_admin());
create policy "signals insert"        on trust_signals for insert
  with check (is_verified() and created_by = auth.uid() and status = 'pending_admin_review');
create policy "signals admin"         on trust_signals for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for verification uploads.
-- Path convention: verification-docs/{user_id}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

create policy "verification docs upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification docs read own"
  on storage.objects for select
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification docs read admin"
  on storage.objects for select
  using (bucket_id = 'verification-docs' and is_admin());
