import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "User Approvals" },
  { href: "/admin/flags", label: "Flagged Content" },
  { href: "/admin/claims", label: "Company Claims" },
  { href: "/admin/trust-signals", label: "Trust Signals" },
  { href: "/admin/ads", label: "Ad Review" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/admin");
  if (!session.isAdmin) redirect("/dashboard?error=" + encodeURIComponent("Admin access required."));

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <span className="mr-2 badge bg-navy-900 text-white">Moderation Panel</span>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-navy-800 hover:bg-navy-50"
          >
            {n.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
