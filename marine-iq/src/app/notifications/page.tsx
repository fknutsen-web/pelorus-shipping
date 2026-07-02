import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { markNotificationsRead, updateNotificationPreferences } from "@/app/actions/engagement";
import { FlashMessages, PageTitle, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/notifications");

  const supabase = await createClient();
  const [{ data: notifications }, { data: prefs }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  return (
    <div className="container-page max-w-3xl py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Notification Center"
        action={
          <form action={markNotificationsRead}>
            <button className="btn-secondary !py-1.5 text-xs">Mark all read</button>
          </form>
        }
      />

      <form action={updateNotificationPreferences} className="card mb-8 flex flex-wrap items-end gap-4 p-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="in_app" defaultChecked={prefs?.in_app ?? true} />
          In-app
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="email" defaultChecked={prefs?.email ?? true} />
          Email
        </label>
        <div>
          <label className="label">Delivery</label>
          <select name="frequency" className="input !w-auto !py-1.5" defaultValue={prefs?.frequency ?? "immediate"}>
            <option value="immediate">Immediate</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
            <option value="off">Off</option>
          </select>
        </div>
        <button className="btn-primary !py-1.5 text-xs">Save preferences</button>
      </form>

      {notifications && notifications.length > 0 ? (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className={`card p-4 text-sm ${n.read_at ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={n.link ?? "/dashboard"} className="font-semibold text-navy-900 hover:underline">
                    {n.title}
                  </Link>
                  {n.body && <p className="mt-0.5 text-slate-600">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No notifications yet. Activity on your profile, company and contributions lands here.</EmptyState>
      )}
    </div>
  );
}
