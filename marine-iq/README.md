# Marine IQ

**A verified maritime-only trust, intelligence and reputation network.**

Verified maritime professionals review companies, software and conferences;
companies claim and respond to their profiles; admins verify every member and
moderate every risk signal. This is not a generic review site — it is a
maritime trust network with identity verification, conflict-of-interest
enforcement and legally careful language built in from the schema up.

> ⚠️ This directory is a self-contained application, designed to be extracted
> into its own repository (`marine-iq`). Nothing in it depends on the rest of
> this repo.

## Stack

| Layer | Choice |
|---|---|
| Web app | Next.js 15 (App Router, React Server Components, server actions) |
| Database & auth | Supabase (PostgreSQL + Row Level Security + Auth + private Storage) |
| Styling | Tailwind CSS v4 |
| Validation | Zod |
| Payments (Phase 4) | Stripe |
| Transactional email | Resend (or Supabase Auth SMTP) |

## Getting started

1. Create a Supabase project.
2. Apply the migrations in order (`supabase/migrations/0001…0003`) via the SQL
   editor or `supabase db push`, then run `supabase/seed.sql` for reference
   data (sectors, software categories) and demo directory entries.
3. Copy `.env.example` to `.env.local` and fill in the project URL, anon key
   and service-role key.
4. `npm install && npm run dev`
5. Register through `/register`, then promote your own account to admin once:
   `update users set role = 'admin', status = 'verified_professional' where email = 'you@company.com';`
   From then on, all user approval happens in `/admin/users`.

## Architecture

### Where the rules live

Every trust rule is enforced **in the database**, not just the UI:

- **Verified-only contribution** — triggers on `reviews`, `comments`, `posts`,
  `votes` and `endorsements` reject writes from non-verified accounts
  (`MARINE_IQ_NOT_VERIFIED`). Anonymous reviews are impossible by construction.
- **Conflict of interest** — a `before insert/update` trigger on `reviews`
  blocks rating your own employer, software sold by your company, or a
  conference organized by your company (matched by linked `company_id` *and*
  company-name text). Current employees may comment but never rate
  (`MARINE_IQ_CONFLICT`).
- **Company Representative labeling** — comments by employees/representatives
  of the discussed company are auto-labeled `is_company_rep` by trigger; the
  label is data, not an honor system.
- **Rating lock** — authors cannot edit reviews 14 days after publication
  unless an admin intervenes (`MARINE_IQ_LOCKED`).
- **Weighted scoring** — `relationship_weight()` maps reviewer relationship to
  weight (customer/direct user 1.0 · supplier/partner 0.6 · former employee
  0.3 · current employee 0.0). The `entity_category_scores` /
  `entity_overall_scores` views compute weighted averages over published
  reviews only.
- **Trust Index safety** — `trust_signals` default to `pending_admin_review`;
  a trigger rejects publication by non-admins. Public UI vocabulary is
  restricted to structured, non-defamatory terms (Reported Payment Concerns,
  Verified Dispute Signals, Risk Indicators, Community Confidence, Under
  Review).
- **Privilege escalation** — users cannot change their own `status`, `role`,
  `verification_methods` or `internal_notes` (trigger-guarded).
- **Audit** — admin decisions (user status, claims, trust signals, merges,
  flag resolutions) write to append-only `audit_logs` (no update/delete
  policies exist).

### Privacy model

- `users` (email, LinkedIn, internal notes) is private: readable only by the
  owner and admins. Public identity is `professional_profiles`.
- Verification uploads live in the **private** `verification-docs` bucket,
  path-scoped per user; admins view them through short-lived signed URLs
  (`/admin/docs/[id]`). They are never publicly accessible.
- Public professional profiles expose only: name, company, title, country,
  sector, experience, specialties, verification badge, contribution stats,
  endorsements and reputation label.

### Moderation pipeline

1. `src/lib/moderation.ts` screens every review/comment/post before insert:
   defamation-risk terms (scam/fraud/blacklist…), profanity, threats, personal
   attacks, spam, self-promotion, unsupported fraud accusations.
2. Clean content publishes immediately; flagged content is stored as
   `under_review` with `moderation_flags` rows for the admin queue.
3. Verified members can also flag published content (conflict of interest,
   duplicates, defamation risk, …).
4. Admins resolve at `/admin/flags`: publish/keep, remove, or dismiss — every
   decision audited.

### Reputation

`src/lib/reputation.ts` computes a credibility score from verification
strength, industry experience, published reviews, helpful votes (√-dampened so
it never becomes a popularity contest), accepted corrections, endorsements and
moderation violations (heavy penalty). Labels: Verified Professional →
Trusted Contributor → Industry Specialist → Recognized Expert → Community
Leader.

### Notifications & engagement

Notification fan-out lives in **database triggers** (`0004_engagement.sql`), so
every write path produces the same registrant notifications: new reviews,
comments and questions, mentions in discussions, moderation flags involving a
company, endorsements, helpful votes, official responses and leads. Users
control delivery in the notification center (`/notifications`): in-app, email,
immediate / daily / weekly digest. `/api/cron/digest?mode=immediate|daily|weekly`
is the email worker (Resend; schedule via Vercel Cron with `CRON_SECRET`).

**Company response workflow:** review published → reps notified → **one**
official public response per review (DB-enforced unique index + rep check),
rendered distinctly from community comments — follow-up clarifications are
regular labeled comments. Companies still cannot delete or edit reviews.

**AI summaries** (`src/lib/ai-summary.ts`): once an entity has 3+ published
reviews, a summary paragraph is generated (Claude `claude-haiku-4-5` via the
Messages API when `ANTHROPIC_API_KEY` is set; deterministic template fallback
otherwise). The new-review trigger marks summaries stale; they regenerate
lazily on the next profile view.

**Lead generation:** company profiles carry Request Demo / Request Quote /
Contact Sales / Become Partner / Book Meeting / Download Brochure forms.
Leads land in a private `leads` table (RLS: reps + admins only), notify the
reps, and are worked from `/dashboard/leads`.

### Monetization (revenue never touches reputation)

`0005_monetization.sql` — structurally separated from scoring: nothing in it
reads or writes reviews, scores or trust signals, and all sponsored surfaces
render behind an explicit "Sponsored" label.

- **Self-service advertising** (`/advertise`): create an account, upload
  creative, pick one of 11 campaign types + objective + audience + budget, pay
  by Stripe Checkout, launch after moderation approval (`/admin/ads`). Spend
  accrues per impression/click via trigger (default $5 CPM / $1.50 CPC) and
  campaigns **auto-pause at budget exhaustion** (DB trigger). Dashboard shows
  impressions, clicks, CTR, spend, remaining budget, targeting, status.
  Advertisers cannot self-activate campaigns or touch spend/pricing
  (trigger-guarded).
- **Subscriptions** (`/pricing`): company Free / Professional / Enterprise
  tiers, premium professional membership, vendor plans and conference
  packages. Stripe Checkout; fulfilment is webhook/admin-side only.
- **Job marketplace** (`/jobs`): reps post jobs; featured placement is paid
  and cannot be self-granted (trigger-guarded).
- **Service marketplace** (`/pricing`): sponsored webinars, reports, podcasts,
  surveys, white papers, launches, event promotion — self-service orders.
- **Business intelligence** (`/intelligence`): reputation leaderboards,
  fastest-rising software, conference ROI ranking, trending topics — gated to
  premium members / paid company tiers, computed exclusively from verified
  community activity.

### Module map

| Route | Module |
|---|---|
| `/` | Homepage: search, positioning, join/claim CTAs |
| `/companies`, `/companies/[slug]` | Company directory, profiles, structured scores, reviews, discussion, risk indicators |
| `/companies/[slug]/review`, `/claim` | Review submission, company claim flow |
| `/software`, `/software/[slug]`(`/review`) | Software directory & reviews |
| `/conferences`, `/conferences/[slug]`(`/review`) | Conference ROI ratings incl. structured attendance answers |
| `/professionals`, `/professionals/[id]` | Professional directory, reputation profiles, endorsements |
| `/trust-index` | Commercial Trust Index table |
| `/feed` | Verified-only moderated discussion feed |
| `/dashboard`, `/dashboard/leads` | Own verification status, uploads, review history; rep lead inbox |
| `/notifications` | Notification center + delivery preferences |
| `/advertise`, `/advertise/[id]` | Self-service ad portal + campaign metrics dashboard |
| `/pricing` | Subscriptions, vendor plans, conference packages, premium membership, marketplace |
| `/jobs` | Job board + rep posting |
| `/intelligence` | Subscriber BI dashboard |
| `/admin/*` | Approvals, flags, claims, trust signals, ad review, audit log, company merge |

### Database

18 tables (`users`, `professional_profiles`, `companies`, `company_claims`,
`company_representatives`, `software_products`, `conferences`, `reviews`,
`review_scores`, `comments`, `posts`, `votes`, `endorsements`,
`verification_documents`, `moderation_flags`, `audit_logs`,
`reputation_scores`, `trust_signals`) plus reference tables (`sectors`,
`categories`) and reporting views (`entity_category_scores`,
`entity_overall_scores`, `company_trust_index`, `profile_stats`). See
`supabase/migrations/`.

## MVP phase status

- **Phase 1 (built):** registration & verification workflow, professional
  profiles, company directory & reviews, conflict-of-interest blocking, admin
  approval panel.
- **Phase 2 (built):** software reviews, conference reviews, weighted scoring,
  company claim process, company responses.
- **Phase 3 (foundations built):** Commercial Trust Index (structured signals +
  index view), maritime feed, reputation scoring. Remaining: AI review
  summaries, top lists/rankings.
- **Phase 4 (not started):** paid company profiles, vendor subscriptions,
  sponsored webinars, job postings, annual awards, benchmark reports —
  schema-ready via Stripe.
