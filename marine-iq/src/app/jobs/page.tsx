import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { createJobPost } from "@/app/actions/commerce";
import { FlashMessages, PageTitle, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Maritime Jobs" };

const JOB_TYPES = [
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["contract", "Contract"],
  ["internship", "Internship"],
  ["executive_search", "Executive search"],
] as const;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; q?: string }>;
}) {
  const { error, notice, q } = await searchParams;
  const session = await getSession();
  const supabase = await createClient();

  let query = supabase
    .from("job_posts")
    .select("*")
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString())
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: jobs } = await query;

  const companyIds = [...new Set((jobs ?? []).map((j) => j.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, slug").in("id", companyIds)
    : { data: [] };
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));

  const { data: repOf } = session.userId
    ? await supabase
        .from("company_representatives")
        .select("company_id, companies:company_id(name)")
        .eq("user_id", session.userId)
    : { data: [] };

  const typeLabel = new Map(JOB_TYPES.map(([v, l]) => [v, l]));

  return (
    <div className="container-page max-w-4xl py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Maritime Jobs"
        subtitle="Positions posted by verified maritime companies. Featured placements are paid and labeled."
      />

      <form className="mb-6 flex gap-2" action="/jobs">
        <input name="q" defaultValue={q} placeholder="Search roles…" className="input !w-72" />
        <button className="btn-primary">Search</button>
      </form>

      {jobs && jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map((j) => {
            const company = companyMap.get(j.company_id);
            return (
              <article key={j.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-navy-900">
                      {j.title}
                      {j.is_featured && <span className="ml-2 badge bg-brass-500/15 text-brass-500">Featured</span>}
                    </h3>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {company && (
                        <a href={`/companies/${company.slug}`} className="font-medium text-navy-700 hover:underline">
                          {company.name}
                        </a>
                      )}
                      {j.location && <> · {j.location}</>}
                      {" · "}
                      {typeLabel.get(j.job_type) ?? j.job_type}
                    </div>
                  </div>
                  {(j.apply_url || j.apply_email) && (
                    <a
                      href={j.apply_url || `mailto:${j.apply_email}`}
                      className="btn-primary !py-1.5 text-xs"
                      rel="nofollow noopener"
                    >
                      Apply
                    </a>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-slate-600">{j.description}</p>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState>No open positions right now.</EmptyState>
      )}

      {repOf && repOf.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-semibold text-navy-700">
            Post a job (company representatives)
          </summary>
          <form action={createJobPost} className="card mt-3 grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="label">Company *</label>
              <select name="company_id" className="input" required>
                {repOf.map((r) => (
                  <option key={r.company_id} value={r.company_id}>
                    {(r.companies as unknown as { name: string } | null)?.name ?? "My company"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Job type</label>
              <select name="job_type" className="input" defaultValue="full_time">
                {JOB_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Title *</label>
              <input name="title" className="input" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description *</label>
              <textarea name="description" className="input min-h-28" required />
            </div>
            <div>
              <label className="label">Location</label>
              <input name="location" className="input" />
            </div>
            <div>
              <label className="label">Apply URL or email</label>
              <div className="flex gap-2">
                <input name="apply_url" type="url" className="input" placeholder="https://…" />
                <input name="apply_email" type="email" className="input" placeholder="jobs@…" />
              </div>
            </div>
            <button className="btn-primary sm:col-span-2">Publish job</button>
          </form>
        </details>
      )}
    </div>
  );
}
