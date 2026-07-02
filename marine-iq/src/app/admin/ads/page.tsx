import { createClient } from "@/lib/supabase/server";
import { decideCampaign } from "@/app/actions/commerce";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ad Review" };

export default async function AdminAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("*")
    .in("status", ["pending_review", "pending_payment"])
    .order("created_at");

  return (
    <div>
      <FlashMessages error={error} notice={notice} />
      <h1 className="mb-1 text-lg font-bold text-navy-900">Campaigns awaiting review</h1>
      <p className="mb-4 text-xs text-slate-500">
        Check creative and destination against advertising guidelines. Approval makes the
        campaign live immediately; sponsored content never affects rankings or scores.
      </p>
      <div className="space-y-4">
        {(campaigns ?? []).map((c) => (
          <div key={c.id} className="card p-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-navy-900">{c.name}</span>
              <span className="badge bg-navy-50 text-navy-800">{String(c.campaign_type).replace(/_/g, " ")}</span>
              <span className="badge bg-slate-100 text-slate-600">{String(c.status).replace(/_/g, " ")}</span>
              <span className="text-xs text-slate-400">budget ${Number(c.budget_total).toFixed(0)}</span>
            </div>
            <p className="mt-2 text-slate-600">
              {c.headline && <strong>{c.headline} — </strong>}
              {c.body_text}
            </p>
            <a href={c.destination_url} className="mt-1 block text-xs text-navy-700 hover:underline" rel="nofollow noopener" target="_blank">
              {c.destination_url}
            </a>
            <form action={decideCampaign} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="campaign_id" value={c.id} />
              <button name="decision" value="active" className="btn-primary !py-1.5 text-xs">
                Approve &amp; launch
              </button>
              <input name="reason" placeholder="Rejection reason" className="input !w-64 !py-1.5 text-xs" />
              <button name="decision" value="rejected" className="btn-secondary !py-1.5 text-xs">
                Reject
              </button>
            </form>
          </div>
        ))}
        {(!campaigns || campaigns.length === 0) && (
          <div className="card p-10 text-center text-sm text-slate-400">No campaigns waiting. ⚓</div>
        )}
      </div>
    </div>
  );
}
