# Pelorus Shipping — Online Engagement / "Order" Flow — Spec v1

**Status:** Draft for review
**Author:** generated for fknutsen-web
**Builds on:** existing `pricing.html` + `/api/quote` + `/api/lead` + `lib/calc.js` + `lib/rates.js` + Supabase (`pelorus_leads`)

---

## 1. Purpose

Let a prospective client **configure their freight requirement on the website, see an indicative fee, and commit to engaging Pelorus** — a Tesla-style "build it → see the number → confirm" experience — **without** binding the firm to an unverified price.

The deliverable of the online flow is a **signed engagement letter**, reached through one deliberate human-review gate.

---

## 2. Principles (non-negotiables)

1. **Indicative online, binding on countersignature.** The number on screen is always labelled *indicative, subject to confirmation*. A contract forms only when Pelorus countersigns / the engagement letter is e-signed — not on the customer's click.
2. **The rate card never reaches the browser.** All fee math runs server-side (`/api/quote` already does this with `lib/rates.js`). The internal `pelorusfeecalculator_1.html` (with the Assumptions/rate-card tab and portfolio) stays **internal only**.
3. **Never trust client numbers.** The server recomputes the fee from the submitted *inputs* at every step (the current `/api/lead` already does this). The stored fee is the server's, not the browser's.
4. **A human gate before money/commitment.** Lane/exclusivity conflict and desk-capacity checks (the logic in the internal tool) must happen before an engagement letter goes out.
5. **Auditable acceptance.** Every "I agree" is stored with the terms version, timestamp, IP, and user agent (clickwrap evidence).

---

## 3. The flow (end to end)

```
  CUSTOMER (website)                          PELORUS (internal)             SYSTEM
  ─────────────────                           ──────────────────             ──────
1 Configure requirement
  (cargo, lanes, volume,
   commitment level)
        │
2 See INDICATIVE fee  ◄───────────────────────────────────────────────  POST /api/quote
   "subject to confirmation"                                             (server-side calc)
        │
3 Request engagement
  - company + contact
  - accept T&Cs (clickwrap)
  - (optional) pay deposit  ──────────────────────────────────────────► POST /api/engagement
        │                                                                status = requested
        │                                   4 Review & verify
        │                                     - inputs sane?
        │                                     - lane/exclusivity conflict?
        │                                     - desk capacity?
        │                                     - confirm or adjust fee
        │                                            │
        │                                   5 Send engagement letter ───► e-sign provider
        │                                     (generated PDF)             status = sent
        │                                            │
6 Counterparty e-signs  ─────────────────────────────────────────────►  webhook
        │                                                                status = signed
        ▼                                            ▼
   ENGAGEMENT ACTIVE  ◄──────────────────  Pelorus countersigns          status = active
```

Steps 1–3 are the self-serve "Tesla" part. Step 4 is the gate. Step 5–6 form the contract.

---

## 4. Screen-by-screen (customer side)

### S1 — Configure (extend existing `pricing.html`)
- Existing inputs: annual tonnes, shipments/yr, benchmark rate, light/structured contracts.
- Add a **commitment selector**: Single voyage · Recurring program · COA · Outsourced desk (maps to existing tiers).
- Add **lane(s)** field (free text now; structured later) — needed for the conflict check.

### S2 — Indicative fee (exists, relabel)
- Show the fee + the in-house comparison.
- Prominent label: **"Indicative — final fee confirmed by Pelorus before any engagement."**
- Primary CTA changes from "contact" to **"Request this engagement →"**.

### S3 — Request engagement (new)
- Fields: full name, company, work email, phone, country, cargo/lane notes.
- **Clickwrap:** checkbox "I have read and accept the [Engagement Terms] and [Privacy Policy]" — required, not pre-ticked.
- (Optional, Phase 4) **Deposit** via Stripe to confirm intent (Tesla-style), fully credited/refundable per terms.
- Submit → `POST /api/engagement`.

### S4 — Confirmation screen
- "Request received. Pelorus will confirm your fee and send an engagement letter to sign, usually within 1 business day."
- Reference number shown.

### S5 — E-sign (hosted by provider)
- Customer receives the engagement letter by email and signs in DocuSign/Dropbox Sign.
- On completion, redirect back to a "You're engaged" page.

---

## 5. Binding model & legal notes

| Step | Legal weight |
|------|--------------|
| Indicative fee (S2) | **Invitation to treat** — not an offer, not binding. |
| Request + clickwrap (S3) | Customer expresses intent + accepts platform terms. Captured as evidence. Not yet the service contract. |
| Engagement letter e-signed (S6) | **Binding contract** for the freight-desk service. |

- Clickwrap acceptance and e-signatures are enforceable (US **ESIGN/UETA**, EU **eIDAS**) when properly captured — hence storing version + timestamp + IP + UA.
- **Recommended:** keep the binding moment at the engagement letter, not the website click, so Pelorus is never bound to an unverified fee.
- ⚠️ **Not legal advice.** The Engagement Terms, Privacy Policy, and engagement-letter template should be drafted/reviewed by a lawyer (esp. liability, exclusivity scope, governing law, EU data).

---

## 6. Data model

Reuse the locked-down, service-role-only pattern of `pelorus_leads`. Add one table:

```sql
create table if not exists public.pelorus_engagements (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  ref             text unique,                    -- human-friendly reference, e.g. PEL-2026-0042
  status          text not null default 'requested',
  -- statuses: requested → under_review → confirmed → sent → signed → active → declined / withdrawn
  contact_name    text,
  company         text,
  email           text,
  phone           text,
  country         text,
  commitment      text,                           -- single_voyage | recurring | coa | desk
  lanes           text,
  inputs          jsonb,                           -- the configurator inputs (authoritative basis)
  indicative_quote jsonb,                          -- server-computed fee shown to customer
  confirmed_quote  jsonb,                           -- fee after human review (may differ)
  terms_version   text,                            -- e.g. "2026-06-01"
  accepted_at     timestamptz,
  accept_ip       text,
  accept_ua       text,
  esign_provider  text,                            -- docusign | dropbox_sign
  esign_envelope  text,                            -- provider envelope/request id
  signed_pdf_url  text,
  deposit_status  text,                            -- none | paid | refunded (Phase 4)
  notes           text
);

alter table public.pelorus_engagements enable row level security;
-- No anon/public policies → only the service-role key (serverless functions) can read/write.
```

---

## 7. API endpoints

| Method / path | Purpose | Notes |
|---|---|---|
| `POST /api/quote` | Indicative fee | **Exists.** No change. |
| `POST /api/engagement` | Create engagement request | **New.** Recompute fee from inputs (don't trust client); capture clickwrap (version/IP/UA); set `status=requested`; email Pelorus. |
| `POST /api/engagement/confirm` | Confirm/adjust fee, trigger e-sign | **New, internal/auth.** Sets `confirmed_quote`, generates the letter, opens the e-sign envelope, `status=sent`. |
| `POST /api/esign-webhook` | Provider callback | **New.** On "completed" → store `signed_pdf_url`, `status=signed`. |

All write endpoints follow the existing `/api/lead` shape (CORS, server recompute, graceful degrade if Supabase env vars absent).

---

## 8. E-signature integration

| Option | Fit | Rough cost |
|---|---|---|
| **Dropbox Sign** (ex-HelloSign) | Clean API, good for templated engagement letters | ~$15–25/user/mo |
| **DocuSign** | Enterprise standard, most recognized by counterparties | ~$25–40/user/mo |
| **Documenso** (open source) | Self-host, full control, no per-seat | infra only |

Recommendation: **Dropbox Sign** to start (simplest API + templates); revisit DocuSign if larger counterparties expect it.

---

## 9. Internal review (the gate)

Phase 1 can be **email + the Supabase table** (no UI to build): request lands, Pelorus gets an email, reviews, replies/sends letter manually.

Phase 3 adds a small **authenticated ops page**:
- Queue of requests by status.
- Shows inputs, indicative fee, and runs the **lane-conflict** + **desk-capacity** checks (port the logic from `pelorusfeecalculator_1.html`).
- One click to **confirm/adjust** and **send for signature**.

---

## 10. Security & privacy

- Rate card (`lib/rates.js`) and the internal calculator never ship to the client.
- `SUPABASE_SERVICE_ROLE_KEY` stays a Vercel env var (server-only). RLS keeps both tables private.
- Store clickwrap evidence (terms version, timestamp, IP, UA).
- Add a **Privacy Policy** + data-retention stance (EU clients → GDPR: lawful basis, deletion path).
- E-sign webhooks must be **signature-verified** (provider HMAC) before trusting status changes.

---

## 11. Phased build plan

| Phase | Scope | Value / risk |
|---|---|---|
| **0 — done** | Configurator + indicative quote + lead capture | Live today |
| **1 — Request engagement** | S3 form + clickwrap + `/api/engagement` + email to Pelorus; manual follow-up | High value, low risk, fast. No e-sign yet. |
| **2 — Engagement letter + e-sign** | Generate letter PDF, send via Dropbox Sign, webhook → signed | Makes it a real "sign online" flow |
| **3 — Ops dashboard** | Authenticated review queue + lane/capacity checks + one-click send | Scales the human gate |
| **4 — Optional self-serve + deposit** | For **single-voyage only**, standard lanes: tighter guardrails + Stripe deposit | Closest to Tesla; only where price risk is low |

**Recommended start: Phase 1.** It captures committed intent and feels like an order, while every fee still passes a human before anything is signed.

---

## 12. Decisions

**Confirmed (2026-06-24):**
1. **Binding moment** — the **e-signed engagement letter**, not the website click. ✅
2. **Orderable online** — **single voyage only**; outsourced desk + recurring stay consultative. ✅ (enforced server-side in `/api/engagement`)
3. **Signing** — **built-in, free** (engagement-letter PDF + clickwrap + typed signature + stored audit trail). Upgrade to Dropbox Sign / DocuSign only if a counterparty requires a formal envelope. ✅
4. **Deposit** — **yes**, a refundable Stripe deposit at request (Phase 2). ✅

**Still open (gate go-live, not the build):**
5. **Confirmation SLA** — what we promise on the confirmation screen (placeholder: "within 1 business day").
6. **Engagement-letter terms + clickwrap T&Cs** — needs a lawyer (liability, governing law, refund terms). Blocks the *binding* step (Phase 2), not Phase 1 capture.
7. **Deposit policy** — fixed $ vs % of indicative fee; refundable until countersignature?

---

## 13. Out of scope (v1)

- Full client portal / ongoing voyage tracking.
- Automated lane-conflict resolution (flagged for humans, not auto-decided).
- Multi-currency billing, invoicing, payment of the actual fee (only optional deposit is in scope, Phase 4).
