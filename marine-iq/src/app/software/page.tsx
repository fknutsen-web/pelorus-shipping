import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getOverallScores, getCategories } from "@/lib/data";
import { addDirectoryEntry } from "@/app/actions/community";
import { EntityCard, EmptyState, FlashMessages, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Maritime Software Reviews" };

export default async function SoftwarePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; error?: string; notice?: string }>;
}) {
  const { q, category, error, notice } = await searchParams;
  const supabase = await createClient();
  const session = await getSession();
  const categories = await getCategories(supabase);

  let query = supabase
    .from("software_products")
    .select("id, slug, name, vendor_name, category_id, description, pricing_model")
    .order("name")
    .limit(60);
  if (q) query = query.ilike("name", `%${q}%`);
  if (category) query = query.eq("category_id", category);
  const { data: products } = await query;

  const scores = await getOverallScores(supabase, "software", (products ?? []).map((p) => p.id));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="container-page py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Maritime Software Reviews"
        subtitle="Chartering, voyage management, DA desks, PMS, crewing, emissions and more — reviewed by verified direct users on ease of use, support, integrations, AI features, ROI and hidden costs."
      />

      <form className="mb-6 flex flex-wrap gap-2" action="/software">
        <input name="q" defaultValue={q} placeholder="Search software…" className="input !w-72" />
        <select name="category" defaultValue={category ?? ""} className="input !w-auto">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-primary">Filter</button>
      </form>

      {products && products.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const s = scores.get(p.id);
            return (
              <EntityCard
                key={p.id}
                href={`/software/${p.slug}`}
                name={p.name}
                meta={[p.vendor_name, categoryName.get(p.category_id)].filter(Boolean).join(" · ")}
                description={p.description}
                score={s?.overall_score ?? null}
                reviewCount={s?.review_count ?? 0}
                tag={p.pricing_model ?? undefined}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState>No software found{q ? ` for “${q}”` : ""}.</EmptyState>
      )}

      {session.isVerified && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-semibold text-navy-700">
            Product missing? Add it to the directory
          </summary>
          <form action={addDirectoryEntry} className="card mt-3 grid max-w-2xl gap-4 p-6 sm:grid-cols-2">
            <input type="hidden" name="kind" value="software" />
            <div>
              <label className="label">Product name *</label>
              <input name="name" className="input" required />
            </div>
            <div>
              <label className="label">Vendor</label>
              <input name="vendor_name" className="input" />
            </div>
            <div>
              <label className="label">Category</label>
              <select name="category_id" className="input" defaultValue="">
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Pricing model</label>
              <input name="pricing_model" className="input" placeholder="e.g. Per-vessel subscription" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Website</label>
              <input name="website" type="url" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" className="input" />
            </div>
            <button className="btn-primary sm:col-span-2">Add software</button>
          </form>
        </details>
      )}
    </div>
  );
}
