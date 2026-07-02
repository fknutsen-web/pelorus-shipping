import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { setCampaignStatus } from "@/app/actions/commerce";
import { FlashMessages, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaign dashboard" };

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const { error, notice } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/advertise");

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const { data: stats } = await supabase
    .from("ad_campaign_stats")
    .select("*")
    .eq("campaign_id", id)
    .maybeSingle();

  const impressions = Number(stats?.impressions ?? 0);
  const clicks = Number(stats?.clicks ?? 0);
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
  const audience = (campaign.audience ?? {}) as { sectors?: string[]; countries?: string[] };

  const tiles: [string, string][] = [
    ["Impressions", impressions.toLocaleString()],
    ["Clicks", clicks.toLocaleString()],
    ["CTR", `${ctr}%`],
    ["Spend", `$${Number(campaign.spend).toFixed(2)}`],
    ["Remaining budget", `$${Math.max(Number(campaign.budget_total) - Number(campaign.spend), 0).toFixed(2)}`],
    ["Status", String(campaign.status).replace(/_/g, " ")],
  ];

  return (
    <div className="container-page max-w-4xl py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title={campaign.name}
        subtitle={`${String(campaign.campaign_type).replace(/_/g, " ")} · objective: ${String(campaign.objective).replace(/_/g, " ")}`}
        action={
          <form action={setCampaignStatus}>
            <input type="hidden" name="campaign_id" value={campaign.id} />
            {campaign.status === "active" ? (
              <button name="status" value="paused" className="btn-secondary !py-1.5 text-xs">Pause campaign</button>
            ) : campaign.status === "paused" ? (
              <button name="status" value="pending_review" className="btn-primary !py-1.5 text-xs">Resume (re-review)</button>
            ) : null}
          </form>
        }
      />

      {campaign.status === "rejected" && campaign.rejection_reason && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Rejected by moderation: {campaign.rejection_reason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, value]) => (
          <div key={label} className="card p-4 text-center">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-lg font-bold text-navy-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="card mt-6 p-5 text-sm text-slate-600">
        <h2 className="mb-2 font-bold text-navy-900">Targeting</h2>
        <p>
          Sectors: {audience.sectors?.length ? audience.sectors.join(", ") : "All"} ·
          Geography: {audience.countries?.length ? audience.countries.join(", ") : "Worldwide"}
        </p>
        <p className="mt-1">
          Destination:{" "}
          <a href={campaign.destination_url} className="text-navy-700 hover:underline" rel="nofollow noopener">
            {campaign.destination_url}
          </a>
        </p>
        <p className="mt-1">Pricing: ${Number(campaign.cpm).toFixed(2)} CPM · ${Number(campaign.cpc).toFixed(2)} CPC</p>
      </div>
    </div>
  );
}
