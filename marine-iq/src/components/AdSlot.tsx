import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Serves one active campaign for a placement. Paid content is always labeled
 * "Sponsored" and rendered visually separate from community content — it never
 * affects rankings, ratings or trust scores.
 */
export async function AdSlot({
  placement,
  className = "",
}: {
  placement: "homepage_banner" | "sidebar_banner" | "sponsored_search";
  className?: string;
}) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: campaigns } = await admin
    .from("ad_campaigns")
    .select("id, name, headline, body_text, destination_url, banner_path, logo_path")
    .eq("campaign_type", placement)
    .eq("status", "active")
    .limit(10);
  if (!campaigns || campaigns.length === 0) return null;

  // Simple rotation; spend accrual + budget auto-pause happen in the database.
  const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
  await admin.from("ad_events").insert({
    campaign_id: campaign.id,
    event_type: "impression",
    path: placement,
  });

  const creative = campaign.banner_path ?? campaign.logo_path;
  const creativeUrl = creative
    ? admin.storage.from("ad-creatives").getPublicUrl(creative).data.publicUrl
    : null;

  return (
    <aside className={`card overflow-hidden ${className}`} aria-label="Sponsored content">
      <div className="flex items-center justify-between bg-slate-50 px-3 py-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Sponsored
        </span>
      </div>
      <a href={`/ads/click/${campaign.id}`} rel="nofollow sponsored" className="block p-4 hover:bg-navy-50/50">
        {creativeUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creativeUrl} alt={campaign.headline ?? campaign.name} className="mb-3 max-h-32 w-full rounded object-cover" />
        )}
        <div className="font-semibold text-navy-900">{campaign.headline ?? campaign.name}</div>
        {campaign.body_text && <p className="mt-1 text-sm text-slate-600">{campaign.body_text}</p>}
      </a>
    </aside>
  );
}
