// POST /api/lead  { name, company, email, input:{annualTonnes,shipments,benchmark}, selectedTier }
// Recomputes the quote server-side (never trusts client numbers) and stores the lead.
import { RATES } from '../lib/rates.js';
import { computeTiers } from '../lib/calc.js';
import { computeEstimate } from '../lib/estimate.js';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  // Two shapes are supported:
  //  - legacy calculator: { input:{annualTonnes,...}, selectedTier }
  //  - engagement configurator: { config:{engagement,cargo,modes,volume,services,geo}, message }
  const config = body?.config && typeof body.config === 'object' ? {
    engagement: body.config.engagement,
    cargo: Array.isArray(body.config.cargo) ? body.config.cargo : [],
    modes: Array.isArray(body.config.modes) ? body.config.modes : [],
    volume: body.config.volume,
    services: Array.isArray(body.config.services) ? body.config.services : [],
    geo: body.config.geo,
  } : null;

  let quote, inputs, selectedTier;
  if (config) {
    quote = computeEstimate(config, RATES);          // authoritative, server-side
    inputs = { config, message: (body?.message || '').slice(0, 2000) };
    selectedTier = body?.selectedTier || config.engagement || null;
  } else {
    const input = {
      annualTonnes: +(body?.input?.annualTonnes) || 0,
      shipments: +(body?.input?.shipments) || 1,
      benchmark: +(body?.input?.benchmark) || 0,
      lightContracts: +(body?.input?.lightContracts) || 0,
      structuredContracts: +(body?.input?.structuredContracts) || 0,
    };
    quote = computeTiers(input, RATES);              // authoritative, server-side
    inputs = input;
    selectedTier = body?.selectedTier || quote.bestKey;
  }

  const record = {
    name: (body?.name || '').slice(0, 200),
    company: (body?.company || '').slice(0, 200),
    email: (body?.email || '').slice(0, 200),
    selected_tier: selectedTier,
    inputs,
    quote,
  };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // No DB configured yet — accept the lead but don't persist (demo mode).
    console.log('LEAD (not persisted — set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY):', record);
    return res.status(200).json({ ok: true, persisted: false });
  }
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from('pelorus_leads').insert(record).select('id').single();
    if (error) throw error;
    return res.status(200).json({ ok: true, persisted: true, id: data.id });
  } catch (e) {
    console.error('lead insert failed:', e.message);
    return res.status(200).json({ ok: true, persisted: false, error: 'store_failed' });
  }
}
