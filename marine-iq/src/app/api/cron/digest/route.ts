import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Email delivery worker — invoke on a schedule (e.g. Vercel Cron):
 *   - ?mode=immediate  every few minutes: users with frequency=immediate
 *   - ?mode=daily      once a day
 *   - ?mode=weekly     once a week
 *
 * Sends via Resend when RESEND_API_KEY is set; otherwise marks nothing and
 * reports how many notifications are waiting (in-app delivery always works).
 * Protect with CRON_SECRET.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = url.searchParams.get("mode") ?? "immediate";
  if (!["immediate", "daily", "weekly"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Users on this frequency with email enabled.
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("frequency", mode)
    .eq("email", true);
  const userIds = (prefs ?? []).map((p) => p.user_id);
  if (userIds.length === 0) return NextResponse.json({ sent: 0, waiting: 0 });

  const { data: pending } = await admin
    .from("notifications")
    .select("id, user_id, title, body, link")
    .in("user_id", userIds)
    .is("emailed_at", null)
    .order("created_at")
    .limit(500);
  if (!pending || pending.length === 0) return NextResponse.json({ sent: 0, waiting: 0 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ sent: 0, waiting: pending.length, note: "RESEND_API_KEY not configured" });
  }

  const { data: users } = await admin
    .from("users")
    .select("id, email, full_name")
    .in("id", [...new Set(pending.map((n) => n.user_id))]);
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const byUser = new Map<string, typeof pending>();
  for (const n of pending) {
    byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n]);
  }

  let sent = 0;
  for (const [userId, items] of byUser) {
    const user = userMap.get(userId);
    if (!user?.email) continue;
    const listHtml = items
      .map((n) => `<li><a href="${site}${n.link ?? "/notifications"}">${n.title}</a>${n.body ? ` — ${n.body}` : ""}</li>`)
      .join("");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Marine IQ <notifications@marineiq.example>",
        to: user.email,
        subject:
          mode === "immediate"
            ? items[0].title
            : `Your ${mode} Marine IQ digest (${items.length} update${items.length === 1 ? "" : "s"})`,
        html: `<p>Hello ${user.full_name},</p><ul>${listHtml}</ul><p><a href="${site}/notifications">Manage notification preferences</a></p>`,
      }),
    });
    if (res.ok) {
      await admin
        .from("notifications")
        .update({ emailed_at: new Date().toISOString() })
        .in("id", items.map((n) => n.id));
      sent += items.length;
    }
  }

  return NextResponse.json({ sent, waiting: pending.length - sent });
}
