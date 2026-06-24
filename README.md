# Pelorus Shipping — Quote Configurator (server-backed)

A live freight-desk pricing configurator for the Pelorus website. Visitors enter
their cargo profile and see an indicative fee at each commitment level, an in-house
cost comparison, and a targeted (non-guaranteed) freight-saving range — then request
a firm proposal. **The rate card lives only on the server**, so it is never shipped
to the browser and never floats around as a document.

## What's here
```
index.html        Homepage (your approved design) with a "Pricing" nav link
pricing.html      The live configurator — calls the API, contains NO rates
api/quote.js      POST: computes a quote from server-side rates
api/lead.js       POST: recomputes server-side, stores the lead (Supabase)
lib/rates.js      ← YOUR PRIVATE RATE CARD. Edit here, redeploy. Server-only.
lib/calc.js       Shared pricing logic (same math the internal tool uses)
db/schema.sql     Supabase table for captured leads (RLS-locked)
dev-server.mjs    Run locally without Vercel
.env.example      Environment variables to set
```

## Run locally
```
npm install
npm run dev          # → http://localhost:3000
```
Leads are not stored until Supabase is configured (you'll see "demo mode").

## Deploy (Vercel + Supabase)
1. **Supabase:** DONE — table `public.pelorus_leads` is already created in your
   `fredheim` project (ref `bizbneqlzacvhekrbrgd`), RLS-locked. (`db/schema.sql` is
   kept for reference / other environments.)
2. **Vercel:** import this folder (or `vercel` from the CLI). Vercel auto-detects
   the static pages and the `/api` functions.
3. **Env vars** (Vercel → Settings → Environment Variables), from `.env.example`:
   - `SUPABASE_URL`  = https://bizbneqlzacvhekrbrgd.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY`  (secret — server-side only)
4. Redeploy. The Pricing page now serves quotes from the server and writes each
   request to the `leads` table.

## Changing your prices
Everything is in **`lib/rates.js`** — engagement fee, spot rate + minimum, the
recurring and outsourced-desk rates, the freight-saving target range, and the
in-house cost model. Change a number, redeploy, done. No price appears anywhere
in the browser-delivered code.

## A note on rate privacy
This removes the forwarded-rate-sheet problem: there is no document, and the full
rate card is not in the page source. A visitor still sees the numbers *for their own
inputs* (that's the quote), but cannot read your whole rate structure or logic. To
harden further you can rate-limit `/api/quote` and/or require an email before the
detailed breakdown renders.

## The three surfaces, kept in sync
- **This app** — customer-facing, live, rates hidden server-side.
- **pelorus-sellsheet.pdf** — static leave-behind (no rates, by design).
- **pelorus-fee-calculator.html** — your internal tool (quote builder, in-house
  comparison, portfolio capacity + lane-conflict check).
All three use the same fee model, including the engagement fee (charged per voyage
on one-offs, once on a commitment). If you change `lib/rates.js`, mirror the same
numbers in the internal tool's Assumptions tab so they agree.
