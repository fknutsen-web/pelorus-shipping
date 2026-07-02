/**
 * Minimal Stripe Checkout integration (raw REST — no SDK dependency).
 * Every commerce path degrades gracefully when STRIPE_SECRET_KEY is unset:
 * records stay in `pending_payment` and the UI explains payment is not yet
 * configured. Fulfilment (activating campaigns, upgrading tiers, featuring
 * jobs) is applied by admins or a Stripe webhook — never by the buyer.
 */

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createCheckoutSession(opts: {
  name: string;
  amountUsd: number;
  mode?: "payment" | "subscription";
  successPath: string;
  cancelPath: string;
  metadata?: Record<string, string>;
}): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const params = new URLSearchParams({
    mode: opts.mode ?? "payment",
    success_url: `${site}${opts.successPath}`,
    cancel_url: `${site}${opts.cancelPath}`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.amountUsd * 100)),
    "line_items[0][price_data][product_data][name]": opts.name,
  });
  for (const [k, v] of Object.entries(opts.metadata ?? {})) {
    params.set(`metadata[${k}]`, v);
  }
  if (opts.mode === "subscription") {
    params.set("line_items[0][price_data][recurring][interval]", "month");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) return null;
  const session = await res.json();
  return session.url ?? null;
}
