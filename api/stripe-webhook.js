// POST /api/stripe-webhook
// Stripe calls this when a deposit checkout completes. We verify the signature,
// then mark the engagement's deposit as paid and move it into review.
//
// Set STRIPE_WEBHOOK_SECRET (from the Stripe dashboard endpoint) so signatures
// are verified. Needs the raw request body, so body parsing is disabled.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  // dev-server passes the body as a string on req.body; Vercel gives a stream.
  if (typeof req.body === 'string') return req.body;
  if (req.body && Buffer.isBuffer(req.body)) return req.body;
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !whSecret) {
    console.warn('stripe-webhook: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set');
    return res.status(200).json({ ok: true, skipped: 'not_configured' });
  }

  const stripe = new Stripe(stripeKey);
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    const body = await rawBody(req);
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (e) {
    console.error('stripe-webhook signature verification failed:', e.message);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const ref = event.data.object?.metadata?.engagement_ref;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (ref && url && key) {
      try {
        const supabase = createClient(url, key, { auth: { persistSession: false } });
        await supabase.from('pelorus_engagements')
          .update({ deposit_status: 'paid', status: 'under_review', updated_at: new Date().toISOString() })
          .eq('ref', ref);
      } catch (e) {
        console.error('stripe-webhook supabase update failed:', e.message);
      }
    }
  }

  return res.status(200).json({ received: true });
}
