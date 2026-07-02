import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSectors } from "@/lib/data";
import { EmptyState, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Professional Directory" };

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sector?: string }>;
}) {
  const { q, sector } = await searchParams;
  const supabase = await createClient();
  const sectors = await getSectors(supabase);

  let query = supabase
    .from("professional_profiles")
    .select("user_id, display_name, company_name, title, country, sector_id, specialties")
    .eq("is_public", true)
    .order("display_name")
    .limit(60);
  if (q) query = query.ilike("display_name", `%${q}%`);
  if (sector) query = query.eq("sector_id", sector);
  const { data: profiles } = await query;

  const userIds = (profiles ?? []).map((p) => p.user_id);
  const { data: reputations } = userIds.length
    ? await supabase.from("reputation_scores").select("user_id, tier, score").in("user_id", userIds)
    : { data: [] };
  const repMap = new Map((reputations ?? []).map((r) => [r.user_id, r]));
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));

  return (
    <div className="container-page py-10">
      <PageTitle
        title="Professional Directory"
        subtitle="Verified maritime professionals with reputation built on verification strength, contribution quality and peer endorsements — not popularity."
      />

      <form className="mb-6 flex flex-wrap gap-2" action="/professionals">
        <input name="q" defaultValue={q} placeholder="Search professionals…" className="input !w-72" />
        <select name="sector" defaultValue={sector ?? ""} className="input !w-auto">
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button className="btn-primary">Filter</button>
      </form>

      {profiles && profiles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => {
            const rep = repMap.get(p.user_id);
            return (
              <Link
                key={p.user_id}
                href={`/professionals/${p.user_id}`}
                className="card block p-5 transition hover:border-navy-600 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-navy-900">{p.display_name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {p.title}, {p.company_name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {[sectorName.get(p.sector_id), p.country].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="badge bg-emerald-50 text-emerald-700">
                    {rep?.tier ?? "Verified Professional"}
                  </span>
                </div>
                {p.specialties?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.specialties.slice(0, 4).map((s: string) => (
                      <span key={s} className="badge bg-navy-50 text-navy-800">{s}</span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState>No public profiles found{q ? ` for “${q}”` : ""}.</EmptyState>
      )}
    </div>
  );
}
