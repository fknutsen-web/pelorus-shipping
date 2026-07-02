import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mergeCompanies } from "@/app/actions/admin";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const supabase = await createClient();

  const [pendingUsers, openFlags, pendingClaims, pendingSignals, pendingReviews] =
    await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("moderation_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("company_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("trust_signals").select("id", { count: "exact", head: true }).eq("status", "pending_admin_review"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "under_review"),
    ]);

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .is("merged_into", null)
    .order("name")
    .limit(500);

  const tiles = [
    { href: "/admin/users", label: "Users awaiting approval", count: pendingUsers.count ?? 0 },
    { href: "/admin/flags", label: "Open moderation flags", count: openFlags.count ?? 0 },
    { href: "/admin/flags", label: "Reviews held for moderation", count: pendingReviews.count ?? 0 },
    { href: "/admin/claims", label: "Pending company claims", count: pendingClaims.count ?? 0 },
    { href: "/admin/trust-signals", label: "Trust signals to review", count: pendingSignals.count ?? 0 },
  ];

  return (
    <div>
      <FlashMessages error={error} notice={notice} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t, i) => (
          <Link key={i} href={t.href} className="card p-5 transition hover:border-navy-600">
            <div className="text-3xl font-bold text-navy-900">{t.count}</div>
            <div className="mt-1 text-xs text-slate-500">{t.label}</div>
          </Link>
        ))}
      </div>

      <section className="mt-10 max-w-xl">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Merge duplicate companies
        </h2>
        <form action={mergeCompanies} className="card flex flex-wrap items-end gap-3 p-5">
          <div className="flex-1">
            <label className="label">Duplicate (will be hidden)</label>
            <select name="duplicate_id" className="input" required defaultValue="">
              <option value="" disabled>Select…</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Canonical company</label>
            <select name="canonical_id" className="input" required defaultValue="">
              <option value="" disabled>Select…</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary">Merge</button>
        </form>
      </section>
    </div>
  );
}
