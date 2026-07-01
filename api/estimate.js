// POST /api/estimate  { engagement, cargo[], modes[], volume, services[], geo }
// Returns an INDICATIVE engagement figure computed server-side. The rate card
// never leaves the server; the browser receives only the resulting figure.
import { RATES } from '../lib/rates.js';
import { computeEstimate } from '../lib/estimate.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const config = {
    engagement: body?.engagement,
    cargo: Array.isArray(body?.cargo) ? body.cargo : [],
    modes: Array.isArray(body?.modes) ? body.modes : [],
    volume: body?.volume,
    services: Array.isArray(body?.services) ? body.services : [],
    geo: body?.geo,
  };

  return res.status(200).json(computeEstimate(config, RATES));
}
