"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireVerified } from "@/lib/auth";
import { screenContent } from "@/lib/moderation";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** Mark all notifications read. */
export async function markNotificationsRead() {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", session.userId)
    .is("read_at", null);
  redirect("/notifications");
}

/** Update delivery preferences (in-app / email / digest frequency). */
export async function updateNotificationPreferences(formData: FormData) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  const frequency = String(formData.get("frequency") || "immediate");
  if (!["immediate", "daily", "weekly", "off"].includes(frequency)) {
    fail("/notifications", "Invalid frequency");
  }
  const supabase = await createClient();
  await supabase.from("notification_preferences").upsert({
    user_id: session.userId,
    in_app: formData.get("in_app") === "on",
    email: formData.get("email") === "on",
    frequency,
    updated_at: new Date().toISOString(),
  });
  redirect("/notifications?notice=" + encodeURIComponent("Preferences saved."));
}

/**
 * Contact-form lead (Request Demo, Request Quote, Contact Sales, Become
 * Partner, Book Meeting, Download Brochure). Routed straight to the profile
 * owner via the leads table + notification trigger.
 */
export async function submitLead(formData: FormData) {
  const returnPath = String(formData.get("return_path") || "/companies");
  const session = await getSession();
  if (!session.userId) redirect(`/login?next=${encodeURIComponent(returnPath)}`);

  const companyId = String(formData.get("company_id"));
  const leadType = String(formData.get("lead_type"));
  const message = String(formData.get("message") ?? "").slice(0, 2000);
  const allowed = [
    "request_demo", "request_quote", "contact_sales",
    "become_partner", "book_meeting", "download_brochure",
  ];
  if (!companyId || !allowed.includes(leadType)) fail(returnPath, "Invalid request");

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    company_id: companyId,
    lead_type: leadType,
    from_user_id: session.userId,
    name: session.account?.full_name ?? "Member",
    email: session.account?.email ?? "",
    message,
  });
  if (error) fail(returnPath, error.message);

  redirect(`${returnPath}?notice=${encodeURIComponent("Sent — the company's representatives have been notified.")}`);
}

/** Update lead status from the rep dashboard. */
export async function updateLeadStatus(formData: FormData) {
  await requireVerified().catch(() => redirect("/login"));
  const leadId = String(formData.get("lead_id"));
  const status = String(formData.get("status"));
  if (!["new", "viewed", "responded", "closed"].includes(status)) {
    fail("/dashboard/leads", "Invalid status");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) fail("/dashboard/leads", error.message);
  redirect("/dashboard/leads");
}

/**
 * One official public response per review, by an approved company
 * representative. The database trigger re-verifies rep status and the
 * one-response-per-review rule.
 */
export async function postOfficialResponse(formData: FormData) {
  const returnPath = String(formData.get("return_path") || "/");
  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const reviewId = String(formData.get("review_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!reviewId || body.length < 10) fail(returnPath, "Write your official response first");

  const screen = screenContent(body);

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    author_id: session.userId,
    review_id: reviewId,
    body,
    is_official_response: true,
    status: screen.clean ? "published" : "under_review",
  });
  if (error) {
    fail(
      returnPath,
      error.message.includes("MARINE_IQ_OFFICIAL")
        ? "Only approved representatives of the reviewed company can post the official response."
        : error.message.includes("one_official_response")
          ? "This review already has an official response. Post follow-up clarifications as regular comments."
          : error.message
    );
  }
  redirect(`${returnPath}?notice=${encodeURIComponent("Official response published.")}`);
}
