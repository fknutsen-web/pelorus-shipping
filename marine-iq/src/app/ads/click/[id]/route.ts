import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Records a click (spend accrues via DB trigger) and redirects to the advertiser. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaign } = await admin
    .from("ad_campaigns")
    .select("id, destination_url, status")
    .eq("id", id)
    .maybeSingle();

  if (!campaign || !/^https?:\/\//.test(campaign.destination_url)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (campaign.status === "active") {
    const ua = request.headers.get("user-agent") ?? "";
    await admin.from("ad_events").insert({
      campaign_id: campaign.id,
      event_type: "click",
      device: /mobile/i.test(ua) ? "mobile" : "desktop",
      country: request.headers.get("x-vercel-ip-country"),
    });
  }

  return NextResponse.redirect(campaign.destination_url);
}
