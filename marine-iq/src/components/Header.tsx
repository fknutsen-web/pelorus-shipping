import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { STATUS_LABELS } from "@/lib/constants";

const NAV = [
  { href: "/companies", label: "Companies" },
  { href: "/software", label: "Software" },
  { href: "/conferences", label: "Conferences" },
  { href: "/professionals", label: "Professionals" },
  { href: "/trust-index", label: "Trust Index" },
  { href: "/feed", label: "Feed" },
];

export async function Header() {
  const session = await getSession();

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
