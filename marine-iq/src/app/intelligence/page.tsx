import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { Stars, PageTitle, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Market Intelligence" };

export default async function IntelligencePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/intelligence");

  const supabase = await createClient();

  // Premium/enterprise gating: premium members, company reps on a paid tier,
  // and admins get the full dashboard; everyone else sees a teaser.
  const [{ data: premium }, { data: repRows }] = await Promise.all([
    supabase.from("premium_memberships").select("status").eq("user_id", session.userId).maybeSingle(),
    supabase.from("company_representatives").select("company_id").eq("user_id", session.userId),
  ]);
  let hasPaidCompany = false;
  if (repRows && repRows.length > 0) {
    const { data: subs } = await supabase
      .from("company_subscriptions")
      .select("tier, status")
      .in("company_id", repRows.map((r) => r.company_id));
    hasPaidCompany = (subs ?? []).some((s) => s.tier !== "free" && s.status === "active");
  }
  const unlocked =
    session.isAdmin || hasPaidCompany ||
    (premium && ["active", "trialing"].includes(premium.status));

  if (!unlocked) {
    return (
      <div className="container-page max-w-2xl py-16 text-center">
        <div className="card p-10">
          <h1 className="text-2xl font-bold text-navy-900">Market Intelligence</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Industry reputation trends, competitor comparisons, sentiment analysis, most
            discussed companies, fastest rising software, highest-rated conferences and
            trending topics — available with Premium membership or a Professional/Enterprise
            company subscription.
          </p>
          <Link href="/pricing" className="btn-primary mt-6">See plans</Link>
        </div>
      </div>
    );
  }

  const [{ data: topCompanies }, { data: topSoftware }, { data: topConferences }, { data: recentPosts }] =
    await Promise.all([
      supabase
        .from("company_trust_index")
        .select("*")
        .not("overall_score", "is", null)
        .order("review_count", { ascending: false })
        .limit(10),
      supabase
        .from("entity_overall_scores")
        .select("*")
        .eq("entity_type", "software")
        .order("overall_score", { ascending: false, nullsFirst: false })
        .limit(10),
      supabase
        .from("entity_overall_scores")
        .select("*")
        .eq("entity_type", "conference")
        .order("overall_score", { ascending: false, nullsFirst: false })
        .limit(10),
      supabase.from("posts").select("tags, company_id").eq("status", "published").limit(500),
    ]);

  // Resolve software/conference names.
  const softwareIds = (topSoftware ?? []).map((s) => s.entity_id);
  const conferenceIds = (topConferences ?? []).map((c) => c.entity_id);
  const [{ data: software }, { data: conferences }] = await Promise.all([
    softwareIds.length
      ? supabase.from("software_products").select("id, name, slug").in("id", softwareIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    conferenceIds.length
      ? supabase.from("conferences").select("id, name, slug").in("id", conferenceIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
  ]);
  const softwareMap = new Map((software ?? []).map((s) => [s.id, s]));
  const conferenceMap = new Map((conferences ?? []).map((c) => [c.id, c]));

  // Trending tags + most discussed companies from the feed.
  const tagCounts = new Map<string, number>();
  const companyMentions = new Map<string, number>();
  for (const p of recentPosts ?? []) {
    for (const t of p.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    if (p.company_id) companyMentions.set(p.company_id, (companyMentions.get(p.company_id) ?? 0) + 1);
  }
  const trendingTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="container-page py-10">
      <PageTitle
        title="Market Intelligence"
        subtitle="Built exclusively from verified community activity — never influenced by advertising or subscriptions."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Most reviewed companies
          </h2>
          {topCompanies && topCompanies.length > 0 ? (
            <ol className="space-y-2 text-sm">
              {topCompanies.map((c, i) => (
                <li key={c.company_id} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="mr-2 font-bold text-slate-400">{i + 1}.</span>
                    <Link href={`/companies/${c.slug}`} className="font-medium text-navy-800 hover:underline">
                      {c.name}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">{c.review_count} reviews · {c.reputation_confidence}</span>
                  </span>
                  <Stars score={c.overall_score} />
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState>Populates as reviews are published.</EmptyState>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Highest-rated software
          </h2>
          {topSoftware && topSoftware.length > 0 ? (
            <ol className="space-y-2 text-sm">
              {topSoftware.map((s, i) => {
                const meta = softwareMap.get(s.entity_id);
                return (
                  <li key={s.entity_id} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="mr-2 font-bold text-slate-400">{i + 1}.</span>
                      {meta ? (
                        <Link href={`/software/${meta.slug}`} className="font-medium text-navy-800 hover:underline">
                          {meta.name}
                        </Link>
                      ) : "—"}
                      <span className="ml-2 text-xs text-slate-400">{s.review_count} reviews</span>
                    </span>
                    <Stars score={s.overall_score} />
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState>Populates as software reviews are published.</EmptyState>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Highest-rated conferences
          </h2>
          {topConferences && topConferences.length > 0 ? (
            <ol className="space-y-2 text-sm">
              {topConferences.map((c, i) => {
                const meta = conferenceMap.get(c.entity_id);
                return (
                  <li key={c.entity_id} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="mr-2 font-bold text-slate-400">{i + 1}.</span>
                      {meta ? (
                        <Link href={`/conferences/${meta.slug}`} className="font-medium text-navy-800 hover:underline">
                          {meta.name}
                        </Link>
                      ) : "—"}
                      {c.would_attend_again_pct != null && (
                        <span className="ml-2 text-xs text-slate-400">{c.would_attend_again_pct}% would return</span>
                      )}
                    </span>
                    <Stars score={c.overall_score} />
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState>Populates as conference reviews are published.</EmptyState>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Trending topics in the feed
          </h2>
          {trendingTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {trendingTags.map(([tag, count]) => (
                <span key={tag} className="badge bg-navy-50 text-navy-800">
                  #{tag} <span className="text-slate-400">×{count}</span>
                </span>
              ))}
            </div>
          ) : (
            <EmptyState>Populates as the feed grows.</EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
