import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getSectors } from "@/lib/data";
import { createCampaign } from "@/app/actions/commerce";
import { FlashMessages, PageTitle, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Advertise" };

const CAMPAIGN_TYPES = [
  ["homepage_banner", "Homepage banner"],
  ["sidebar_banner", "Sidebar banner"],
  ["sponsored_search", "Sponsored search result"],
  ["sponsored_company_profile", "Sponsored company profile"],
  ["sponsored_software_listing", "Sponsored software listing"],
  ["sponsored_conference_listing", "Sponsored conference listing"],
  ["newsletter_sponsorship", "Newsletter sponsorship"],
  ["sponsored_article", "Sponsored article"],
  ["sponsored_webinar", "Sponsored webinar"],
  ["sponsored_podcast", "Sponsored podcast"],
  ["sponsored_top10", "Sponsored Top 10 category"],
] as const;

const OBJECTIVES = [
  ["brand_awareness", "Brand awareness"],
  ["lead_generation", "Lead generation"],
  ["demo_requests", "Demo requests"],
  ["event_registrations", "Event registrations"],
  ["recruitment", "Recruitment"],
] as const;

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/advertise");

  const supabase = await createClient();
  const sectors = await getSectors(supabase);
  const { data: account } = await supabase
    .from("ad_accounts")
    .select("id")
    .eq("owner_user_id", session.userId)
    .maybeSingle();
  const { data: campaigns } = account
    ? await supabase
        .from("ad_campaign_stats")
        .select("*")
        .eq("account_id", account.id)
        .order("campaign_id")
    : { data: [] };

  return (
    <div className="container-page max-w-4xl py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Self-Service Advertising"
        subtitle="Create a campaign, upload creative, set a budget and pay online — it launches as soon as moderation approves it, and pauses automatically when the budget is spent. Sponsored placements are always labeled and never influence rankings, ratings or trust scores."
      />

      {campaigns && campaigns.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Your campaigns</h2>
          <div className="card divide-y divide-slate-100">
            {campaigns.map((c) => (
              <Link key={c.campaign_id} href={`/advertise/${c.campaign_id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-navy-50/50">
                <div>
                  <span className="font-semibold text-navy-900">{c.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{String(c.campaign_type).replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{c.impressions} impr · {c.clicks} clicks</span>
                  <span>${Number(c.spend).toFixed(2)} / ${Number(c.budget_total).toFixed(0)}</span>
                  <span className={`badge ${c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {String(c.status).replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {(!campaigns || campaigns.length === 0) && (
        <EmptyState>No campaigns yet — create your first one below.</EmptyState>
      )}

      <form action={createCampaign} className="card mt-8 space-y-5 p-6">
        <h2 className="text-lg font-bold text-navy-900">New campaign</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Campaign name *</label>
            <input name="name" className="input" required />
          </div>
          <div>
            <label className="label">Campaign type *</label>
            <select name="campaign_type" className="input" required defaultValue="sidebar_banner">
              {CAMPAIGN_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Objective</label>
            <select name="objective" className="input" defaultValue="brand_awareness">
              {OBJECTIVES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Total budget (USD, min 50) *</label>
            <input name="budget_total" type="number" min={50} step={10} className="input" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Destination URL *</label>
            <input name="destination_url" type="url" className="input" required placeholder="https://…" />
          </div>
          <div>
            <label className="label">Headline (max 90 chars)</label>
            <input name="headline" maxLength={90} className="input" />
          </div>
          <div>
            <label className="label">Body text (max 200 chars)</label>
            <input name="body_text" maxLength={200} className="input" />
          </div>
          <div>
            <label className="label">Logo</label>
            <input name="logo" type="file" accept="image/*" className="input" />
          </div>
          <div>
            <label className="label">Banner image</label>
            <input name="banner" type="file" accept="image/*" className="input" />
          </div>
          <div>
            <label className="label">Video</label>
            <input name="video" type="file" accept="video/*" className="input" />
          </div>
        </div>

        <fieldset className="rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Audience</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Maritime sectors</label>
              <select name="audience_sectors" multiple className="input h-28">
                {sectors.map((s) => (
                  <option key={s.id} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Countries (comma-separated, empty = worldwide)</label>
              <input name="audience_countries" className="input" placeholder="Norway, Singapore, UAE" />
            </div>
          </div>
        </fieldset>

        <p className="text-xs text-slate-400">
          Pricing: USD 5.00 CPM / USD 1.50 CPC, drawn from your budget. Campaigns pause
          automatically at budget exhaustion. Payment is collected at checkout; the
          campaign goes live after moderation approval.
        </p>
        <button className="btn-primary">Submit &amp; pay</button>
      </form>
    </div>
  );
}
