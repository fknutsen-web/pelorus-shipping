import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getOverallScores, getSectors } from "@/lib/data";
import { addDirectoryEntry } from "@/app/actions/community";
import { EntityCard, EmptyState, FlashMessages, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conference ROI Ratings" };

export default async function ConferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; notice?: string }>;
}) {
  const { q, error, notice } = await searchParams;
  const supabase = await createClient();
  const session = await getSession();
  const sectors = await getSectors(supabase);

  let query = supabase
    .from("conferences")
    .select("id, slug, name, organizer_name, location, typical_cost_estimate")
    .order("name")
    .limit(60);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: conferences } = await query;

  const scores = await getOverallScores(supabase, "conference", (conferences ?? []).map((c) => c.id));

  return (
    <div className="container-page py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Conference ROI Ratings"
        subtitle="Was it worth the total cost? Networking value, decision-maker attendance and deal generation — rated by delegates who actually attended."
      />

      <form className="mb-6 flex flex-wrap gap-2" action="/conferences">
        <input name="q" defaultValue={q} placeholder="Search conferences…" className="input !w-72" />
        <button className="btn-primary">Search</button>
      </form>

      {conferences && conferences.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {conferences.map((c) => {
            const s = scores.get(c.id);
            return (
              <EntityCard
                key={c.id}
                href={`/conferences/${c.slug}`}
                name={c.name}
                meta={[c.organizer_name, c.location].filter(Boolean).join(" · ")}
                description={c.typical_cost_estimate ? `Typical cost: ${c.typical_cost_estimate}` : null}
                score={s?.overall_score ?? null}
                reviewCount={s?.review_count ?? 0}
                tag={
                  s?.would_attend_again_pct != null
                    ? `${s.would_attend_again_pct}% would return`
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        <EmptyState>No conferences found{q ? ` for “${q}”` : ""}.</EmptyState>
      )}

      {session.isVerified && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-semibold text-navy-700">
            Conference missing? Add it to the directory
          </summary>
          <form action={addDirectoryEntry} className="card mt-3 grid max-w-2xl gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="kind" value="conference" />
            <div>
              <label className="label">Conference name *</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="label">Organizer</label>
              <input name="organizer_name" className="input" />
            </div>
            <div>
              <label className="label">Location</label>
              <input name="location" className="input" />
            </div>
            <div>
              <label className="label">Sector focus</label>
              <select name="sector_id" className="input" defaultValue="">
                <option value="">Select…</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Typical cost estimate</label>
              <input name="typical_cost_estimate" className="input" placeholder="e.g. USD 2,500–4,500 incl. travel" />
            </div>
            <div>
              <label className="label">Website</label>
              <input name="website" type="url" className="input" />
            </div>
            <button className="btn-primary sm:col-span-2">Add conference</button>
          </form>
        </details>
      )}
    </div>
  );
}
