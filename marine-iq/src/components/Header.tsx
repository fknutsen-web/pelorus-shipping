import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/constants";

const NAV = [
  { href: "/companies", label: "Companies" },
  { href: "/software", label: "Software" },
  { href: "/conferences", label: "Conferences" },
  { href: "/professionals", label: "Professionals" },
  { href: "/trust-index", label: "Trust Index" },
  { href: "/feed", label: "Feed" },
  { href: "/jobs", label: "Jobs" },
];

export async function Header() {
  const session = await getSession();

  let unreadCount = 0;
  if (session.userId) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .is("read_at", null);
    unreadCount = count ?? 0;
  }

  return (
    <header className="border-b border-navy-700 bg-navy-900 text-white">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight">
            Marine<span className="text-brass-400">IQ</span>
          </span>
          <span className="hidden text-[11px] uppercase tracking-widest text-navy-100 sm:block">
            Maritime Intelligence Network
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-navy-100 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          {session.userId ? (
            <>
              <Link
                href="/notifications"
                className="relative rounded p-1.5 text-navy-100 hover:text-white"
                aria-label={`Notifications (${unreadCount} unread)`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brass-500 px-1 text-[10px] font-bold text-navy-950">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              {session.isAdmin && (
                <Link href="/admin" className="font-semibold text-brass-400 hover:text-brass-500">
                  Admin
                </Link>
              )}
              <Link href="/dashboard" className="font-medium text-navy-100 hover:text-white">
                {session.account?.full_name?.split(" ")[0] ?? "Dashboard"}
              </Link>
              <form action={logout}>
                <button className="rounded border border-navy-600 px-3 py-1.5 text-xs text-navy-100 hover:bg-navy-800">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="font-medium text-navy-100 hover:text-white">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-brass-500 px-3 py-1.5 text-xs font-bold text-navy-950 hover:bg-brass-400"
              >
                Join — Verified Professionals
              </Link>
            </>
          )}
        </div>
      </div>
      {session.account && session.account.status === "pending" && (
        <div className="bg-brass-500/15 py-1.5 text-center text-xs text-brass-400">
          Your account is {STATUS_LABELS[session.account.status]} — you can browse, but
          contributing unlocks after admin approval.{" "}
          <Link href="/dashboard" className="underline">
            Check status
          </Link>
        </div>
      )}
    </header>
  );
}
