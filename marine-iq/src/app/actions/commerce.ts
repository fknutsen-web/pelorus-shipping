"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireVerified, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { screenContent } from "@/lib/moderation";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

const PAYMENT_UNAVAILABLE =
  "Payments are not configured in this environment yet — your request was recorded and an admin will follow up.";

// ---------------------------------------------------------------------------
// Advertising portal
// ---------------------------------------------------------------------------

export async function createCampaign(formData: FormData) {
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/advertise");

  const supabase = await createClient();

  // Ensure the advertiser has an ad account (self-service, no sales contact).
  let { data: account } = await supabase
    .from("ad_accounts")
    .select("id")
    .eq("owner_user_id", session.userId)
    .maybeSingle();
  if (!account) {
    const { data: created, error: accErr } = await supabase
      .from("ad_accounts")
      .insert({
        owner_user_id: session.userId,
        company_id: session.account?.company_id ?? null,
        billing_email: session.account?.email ?? "",
      })
      .select("id")
      .single();
    if (accErr) fail("/advertise", accErr.message);
    account = created;
  }

  const name = String(formData.get("name") ?? "").trim();
  const campaignType = String(formData.get("campaign_type"));
  const objective = String(formData.get("objective") || "brand_awareness");
  const destinationUrl = String(formData.get("destination_url") ?? "");
  const headline = String(formData.get("headline") ?? "").slice(0, 90);
  const bodyText = String(formData.get("body_text") ?? "").slice(0, 200);
  const budget = parseFloat(String(formData.get("budget_total") ?? ""));
  const sectors = formData.getAll("audience_sectors").map(String).filter(Boolean);
  const countries = String(formData.get("audience_countries") ?? "")
    .split(",").map((c) => c.trim()).filter(Boolean);

  if (name.length < 3) fail("/advertise", "Give the campaign a name");
  if (!/^https?:\/\//.test(destinationUrl)) fail("/advertise", "Destination URL must be a valid link");
  if (!budget || budget < 50) fail("/advertise", "Minimum campaign budget is USD 50");

  // Creative uploads → public ad-creatives bucket, prefixed by user id.
  const paths: Record<string, string | null> = { logo_path: null, banner_path: null, video_path: null };
  for (const [field, col] of [["logo", "logo_path"], ["banner", "banner_path"], ["video", "video_path"]] as const) {
    const file = formData.get(field) as File | null;
    if (file && file.size > 0) {
      if (file.size > 25 * 1024 * 1024) fail("/advertise", "Creative files must be under 25 MB");
      const path = `${session.userId}/${col}-${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("ad-creatives").upload(path, file, { contentType: file.type });
      if (upErr) fail("/advertise", upErr.message);
      paths[col] = path;
    }
  }

  const { data: campaign, error } = await supabase
    .from("ad_campaigns")
    .insert({
      account_id: account.id,
      name,
      campaign_type: campaignType,
      objective,
      destination_url: destinationUrl,
      headline: headline || null,
      body_text: bodyText || null,
      audience: { sectors, countries },
      budget_total: budget,
      status: "pending_review",
      ...paths,
    })
    .select("id")
    .single();
  if (error) fail("/advertise", error.message);

  // Collect payment immediately when Stripe is configured; the campaign still
  // launches only after moderation approval.
  if (stripeConfigured()) {
    const url = await createCheckoutSession({
      name: `Marine IQ campaign: ${name}`,
      amountUsd: budget,
      successPath: `/advertise/${campaign.id}?notice=${encodeURIComponent("Payment received — your campaign launches as soon as moderation approves it.")}`,
      cancelPath: `/advertise/${campaign.id}?error=${encodeURIComponent("Payment canceled — the campaign stays in draft.")}`,
      metadata: { campaign_id: campaign.id, kind: "ad_campaign" },
    });
    if (url) redirect(url);
  }
  redirect(`/advertise/${campaign.id}?notice=${encodeURIComponent("Campaign submitted for moderation review. " + PAYMENT_UNAVAILABLE)}`);
}

export async function setCampaignStatus(formData: FormData) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const campaignId = String(formData.get("campaign_id"));
  const status = String(formData.get("status")); // paused | pending_review (resume)
  if (!["paused", "pending_review"].includes(status)) fail("/advertise", "Invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", campaignId);
  if (error) fail(`/advertise/${campaignId}`, error.message);
  redirect(`/advertise/${campaignId}`);
}

/** Admin: approve (activate) or reject a campaign after moderation review. */
export async function decideCampaign(formData: FormData) {
  const session = await requireAdmin().catch((e: Error) => fail("/admin/ads", e.message));
  const campaignId = String(formData.get("campaign_id"));
  const decision = String(formData.get("decision")); // active | rejected
  const reason = String(formData.get("reason") ?? "");
  if (!["active", "rejected"].includes(decision)) fail("/admin/ads", "Invalid decision");

  const admin = createAdminClient();
  const { error } = await admin
    .from("ad_campaigns")
    .update({
      status: decision,
      reviewed_by: session.userId,
      rejection_reason: decision === "rejected" ? reason || "Did not meet advertising guidelines" : null,
      starts_at: decision === "active" ? new Date().toISOString() : null,
    })
    .eq("id", campaignId);
  if (error) fail("/admin/ads", error.message);

  await admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: `ad_campaign_${decision}`,
    target_type: "ad_campaign",
    target_id: campaignId,
    metadata: { reason },
  });
  redirect("/admin/ads?notice=" + encodeURIComponent("Campaign " + decision + "."));
}

// ---------------------------------------------------------------------------
// Subscriptions & premium membership
// ---------------------------------------------------------------------------

const TIER_PRICES: Record<string, { name: string; amount: number }> = {
  professional: { name: "Marine IQ Company Professional", amount: 199 },
  enterprise: { name: "Marine IQ Company Enterprise", amount: 699 },
  premium_member: { name: "Marine IQ Premium Membership", amount: 29 },
};

export async function startSubscriptionCheckout(formData: FormData) {
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/pricing");

  const tier = String(formData.get("tier"));
  const price = TIER_PRICES[tier];
  if (!price) fail("/pricing", "Unknown plan");

  if (!stripeConfigured()) {
    fail("/pricing", PAYMENT_UNAVAILABLE);
  }
  const url = await createCheckoutSession({
    name: price.name,
    amountUsd: price.amount,
    mode: "subscription",
    successPath: `/pricing?notice=${encodeURIComponent("Subscription started — features unlock once the payment webhook confirms it.")}`,
    cancelPath: "/pricing",
    metadata: { tier, user_id: session.userId },
  });
  if (!url) fail("/pricing", "Could not start checkout — try again shortly.");
  redirect(url);
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function createJobPost(formData: FormData) {
  const session = await requireVerified().catch((e: Error) => fail("/jobs", e.message));

  const companyId = String(formData.get("company_id"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const jobType = String(formData.get("job_type") || "full_time");
  const location = String(formData.get("location") ?? "");
  const applyUrl = String(formData.get("apply_url") ?? "");
  const applyEmail = String(formData.get("apply_email") ?? "");

  if (title.length < 5 || description.length < 30) {
    fail("/jobs", "Provide a job title and a real description");
  }
  const screen = screenContent(`${title}\n${description}`);

  const supabase = await createClient();
  const { error } = await supabase.from("job_posts").insert({
    company_id: companyId,
    posted_by: session.userId,
    title,
    description,
    job_type: jobType,
    location: location || null,
    apply_url: applyUrl || null,
    apply_email: applyEmail || null,
    status: screen.clean ? "published" : "under_review",
  });
  if (error) {
    fail(
      "/jobs",
      error.message.includes("row-level security")
        ? "Only approved company representatives can post jobs. Claim your company profile first."
        : error.message
    );
  }
  redirect("/jobs?notice=" + encodeURIComponent("Job posted."));
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

const SERVICES: Record<string, { name: string; amount: number }> = {
  sponsored_webinar: { name: "Sponsored webinar", amount: 2500 },
  sponsored_report: { name: "Sponsored report", amount: 3500 },
  sponsored_podcast: { name: "Sponsored podcast episode", amount: 1500 },
  industry_survey: { name: "Industry survey", amount: 4000 },
  whitepaper_promotion: { name: "White paper promotion", amount: 1200 },
  product_launch: { name: "Product launch package", amount: 3000 },
  event_promotion: { name: "Event promotion package", amount: 2000 },
};

export async function orderMarketplaceService(formData: FormData) {
  const session = await requireVerified().catch((e: Error) => fail("/pricing", e.message));

  const companyId = String(formData.get("company_id"));
  const service = String(formData.get("service"));
  const details = String(formData.get("details") ?? "").slice(0, 2000);
  const price = SERVICES[service];
  if (!price || !companyId) fail("/pricing", "Invalid order");

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("marketplace_orders")
    .insert({
      company_id: companyId,
      buyer_user_id: session.userId,
      service,
      details,
      amount_usd: price.amount,
    })
    .select("id")
    .single();
  if (error) {
    fail(
      "/pricing",
      error.message.includes("row-level security")
        ? "Marketplace orders are placed by approved company representatives. Claim your company profile first."
        : error.message
    );
  }

  if (stripeConfigured()) {
    const url = await createCheckoutSession({
      name: `Marine IQ — ${price.name}`,
      amountUsd: price.amount,
      successPath: `/pricing?notice=${encodeURIComponent("Order placed — our team will schedule delivery.")}`,
      cancelPath: "/pricing",
      metadata: { order_id: order.id, kind: "marketplace_order" },
    });
    if (url) redirect(url);
  }
  redirect("/pricing?notice=" + encodeURIComponent("Order recorded. " + PAYMENT_UNAVAILABLE));
}
