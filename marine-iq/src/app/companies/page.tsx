import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getOverallScores, getSectors } from "@/lib/data";
import { addDirectoryEntry } from "@/app/actions/community";
import { EntityCard, EmptyState, FlashMessages, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company Directory" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sector?: string; error?: string; notice?: string }>;
}) {
  const { q, sector, error, notice } = await searchParams;
  const supabase = await createClient();
  const session = await getSession();
  const sectors = await getSectors(supabase);

  let query = supabase
    .from("companies")
    .select("id, slug, name, sector_id, hq_country, hq_city, description, is_claimed")
    .is("merged_into", null)
    .order("name")
    .limit(60);
  if (q) query = query.ilike("name", `%${q}%`);
  if (sector) query = query.eq("sector_id", sector);
  const { data: companies } = await query;

  const scores = await getOverallScores(supabase, "company", (companies ?? []).map((c) => c.id));
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));

  return (
    <div className="container-page py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Company Directory"
        subtitle="Cargo owners, charterers, shipowners, operators, terminals, brokers, agents and service providers — rated by verified counterparties."
      />

      <form className="mb-6 flex flex-wrap gap-2" action="/companies">
        <input name="q" defaultValue={q} placeholder="Search companies…" className="input !w-72" />
        <select name="sector" defaultValue={sector ?? ""} className="input !w-auto">
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button className="btn-primary">Filter</button>
      </form>

      {companies && companies.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const s = scores.get(c.id);
            return (
              <EntityCard
                key={c.id}
                href={`/companies/${c.slug}`}
                name={c.name}
                meta={[sectorName.get(c.sector_id), [c.hq_city, c.hq_country].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
                description={c.description}
                score={s?.overall_score ?? null}
                reviewCount={s?.review_count ?? 0}
                tag={c.is_claimed ? "Claimed" : undefined}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState>No companies found{q ? ` for “${q}”` : ""}.</EmptyState>
      )}

      {session.isVerified && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-semibold text-navy-700">
            Company missing? Add it to the directory
          </summary>
          <form action={addDirectoryEntry} className="card mt-3 grid max-w-2xl gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="kind" value="company" />
            <div>
              <label className="label">Company name *</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="label">Sector</label>
              <select name="sector_id" className="input" defaultValue="">
                <option value="">Select…</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">HQ country</label>
              <input name="hq_country" className="input" />
            </div>
            <div>
              <label className="label">HQ city</label>
              <input name="hq_city" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Website</label>
              <input name="website" type="url" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" className="input" />
            </div>
            <button className="btn-primary sm:col-span-2">Add company</button>
          </form>
        </details>
      )}
    </div>
  );
}
