// POST /api/engagement
// Phase 1 of the online order flow. A client requests a SINGLE-VOYAGE engagement
// at the indicative fee and accepts the request terms (clickwrap). We recompute
// the fee server-side (never trust the browser), capture the clickwrap evidence
// (terms version + timestamp + IP + user-agent), and store it.
//
// This is NOT a binding contract — that forms only on a signed engagement letter
// (later phase). Outsourced-desk / recurring programs are handled consultatively
// via /api/lead, so this endpoint only accepts the single-voyage tier.
import { RATES } from '../lib/rates.js';
import { computeTiers } from '../lib/calc.js';
import { createClient } from '@supabase/supabase-js';

// Bump when the clickwrap wording changes. Stored with each acceptance.
const TERMS_VERSION = '2026-06-24';

function makeRef() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000); // 4 digits
  return `PEL-${year}-${rand}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  // --- only single-voyage is orderable online (Phase 1 business rule) ---
  const tier = body?.selectedTier || 'spot';
  if (tier !== 'spot') {
    return res.status(400).json({
      error: 'not_orderable',
      message: 'Only single-voyage engagements can be requested online. Recurring programs and the outsourced desk are arranged with us directly.',
    });
  }

  // --- clickwrap must be accepted ---
  if (body?.termsAccepted !== true) {
    return res.status(400).json({ error: 'terms_required', message: 'You must accept the request terms to continue.' });
  }

  // --- recompute the fee server-side from the inputs (authoritative) ---
  const input = {
    annualTonnes: +(body?.input?.annualTonnes) || 0,
    shipments: +(body?.input?.shipments) || 1,
    benchmark: +(body?.input?.benchmark) || 0,
    lightContracts: +(body?.input?.lightContracts) || 0,
    structuredContracts: +(body?.input?.structuredContracts) || 0,
  };
  if (input.annualTonnes <= 0) return res.status(400).json({ error: 'annualTonnes required' });

  const quote = computeTiers(input, RATES);
  const spot = quote.tiers.find(t => t.key === 'spot');
  const indicative = {
    currency: quote.currency,
    commitment: 'single_voyage',
    annual: spot.annual,
    perShip: spot.perShip,
    perTon: spot.perTon,
    engagementFee: quote.engagementFee,
  };

  // --- clickwrap evidence ---
  const xff = req.headers['x-forwarded-for'];
  const accept_ip = (Array.isArray(xff) ? xff[0] : (xff || '')).split(',')[0].trim()
    || req.socket?.remoteAddress || '';
  const accept_ua = req.headers['user-agent'] || '';

  const ref = makeRef();
  const record = {
    ref,
    status: 'requested',
    contact_name: (body?.name || '').slice(0, 200),
    company: (body?.company || '').slice(0, 200),
    email: (body?.email || '').slice(0, 200),
    phone: (body?.phone || '').slice(0, 60),
    country: (body?.country || '').slice(0, 80),
    commitment: 'single_voyage',
    lanes: (body?.lanes || '').slice(0, 300),
    inputs: input,
    indicative_quote: indicative,
    terms_version: TERMS_VERSION,
    accepted_at: new Date().toISOString(),
    accept_ip,
    accept_ua: accept_ua.slice(0, 400),
  };

  // --- persist (graceful degrade without Supabase) ---
  let supabase = null, id = null, persisted = false;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await supabase.from('pelorus_engagements').insert(record).select('id,ref').single();
      if (error) throw error;
      id = data.id; persisted = true;
    } catch (e) {
      console.error('engagement insert failed:', e.message);
    }
  } else {
    console.log('ENGAGEMENT (not persisted — set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY):', record);
  }

  await notify(record).catch(() => {});
  return res.status(200).json({ ok: true, persisted, ref, id });
}

// Best-effort email notification to Pelorus. No-op unless RESEND_API_KEY is set,
// so the endpoint works with zero extra config and lights up when you add a key.
async function notify(record) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_TO || 'contact@pelorusshipping.com';
  if (!apiKey) return;
  const lines = [
    `New engagement request ${record.ref}`,
    `Tier: single voyage`,
    `Contact: ${record.contact_name} — ${record.company} — ${record.email} — ${record.phone}`,
    `Lanes: ${record.lanes || '—'}`,
    `Cargo: ${record.inputs.annualTonnes} t / yr over ${record.inputs.shipments} shipments`,
    `Indicative: ${record.indicative_quote.currency}${Math.round(record.indicative_quote.annual).toLocaleString('en-US')} / yr`,
    `Terms accepted: v${record.terms_version} at ${record.accepted_at} (IP ${record.accept_ip})`,
  ];
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Pelorus Website <noreply@pelorusshipping.com>',
      to: [to],
      subject: `Engagement request ${record.ref} — ${record.company || record.contact_name}`,
      text: lines.join('\n'),
    }),
  });
}
