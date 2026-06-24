# Deploy — Pelorus quote app

## 1. Push to GitHub
Create an EMPTY repo at https://github.com/new (no README, no .gitignore), then:
```
git remote add origin https://github.com/YOUR-USERNAME/pelorus-quote-app.git
git push -u origin main
```
(This folder is already a git repo with one commit — nothing else to init.)

## 2. Connect to Vercel
Vercel → Add New → Project → import the GitHub repo. It auto-detects the
static pages and the /api functions. Every future `git push` then auto-deploys.

## 3. Environment variables (Vercel → Settings → Environment Variables)
```
SUPABASE_URL                = https://bizbneqlzacvhekrbrgd.supabase.co
SUPABASE_SERVICE_ROLE_KEY   = (Supabase → Project Settings → API → service_role — SECRET)
```
The Supabase table `public.pelorus_leads` already exists. Redeploy after adding vars.

## SECURITY
Never commit a real .env. The service-role key lives ONLY as a Vercel env var.
`.env.example` (committed) contains no real keys.
