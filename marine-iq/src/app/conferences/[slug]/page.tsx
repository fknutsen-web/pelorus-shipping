import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getCategoryScores, getReviewsForEntity, getOverallScores, isRepOf } from "@/lib/data";
import { getOrRefreshSummary } from "@/lib/ai-summary";
import { CONFERENCE_SCORE_CATEGORIES } from "@/lib/constants";
import { Stars, ScoreBar, FlashMessages, EmptyState } from "@/components/ui";
import { ReviewCard } from "@/components/ReviewCard";

export const dynamic = "force-dynamic";

const categoryLabels = Object.fromEntries(CONFERENCE_SCORE_CATEGORIES.map((c) => [c.key, c.label]));

export default async function ConferenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { slug } = await params;
  const { error, notice } = await searchParams;
  const supabase = await createClient();
  const session = await getSession();

  const { data: conference } = await supabase
    .from("conferences")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!conference) notFound();

  const [overall, categoryScores, reviews] = await Promise.all([
    getOverallScores(supabase, "conference", [conference.id]),
    getCategoryScores(supabase, "conference", conference.id),
    getReviewsForEntity(supabase, "conference", conference.id),
  ]);
  const score = overall.get(conference.id);
  const path = `/conferences/${slug}`;
  const viewerIsRep = await isRepOf(supabase, session.userId, conference.organizer_company_id);
  const aiSummary = await getOrRefreshSummary(
    "conference", conference.id, conference.name, reviews.length, categoryScores,
    reviews.map((r) => `${r.title}: ${r.body}`)
  );

  return (
    <div className="container-page py-10">
      <FlashMessages error={error} notice={notice} />
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">{conference.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {conference.organizer_name && <>Organized by {conference.organizer_name} · </>}
              {conference.location}
              {conference.website && (
                <>
                  {" · "}
                  <a href={conference.website} className="text-navy-700 hover:underline" rel="nofollow noopener">
                    Website
                  </a>
                </>
              )}
            </p>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              {conference.typical_cost_estimate && (
                <p><strong>Typical total cost:</strong> {conference.typical_cost_estimate}</p>
              )}
              {conference.attendee_categories?.length > 0 && (
                <p><strong>Who attends:</strong> {conference.attendee_categories.join(", ")}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <Stars score={score?.overall_score ?? null} size="text-lg" />
            <div className="mt-1 text-xs text-slate-500">
              {score?.review_count ?? 0} verified review{(score?.review_count ?? 0) === 1 ? "" : "s"}
              {score?.would_attend_again_pct != null && (
                <>
                  <br />
                  <strong className="text-navy-800">{score.would_attend_again_pct}%</strong> would attend again
                </>
              )}
            </div>
            {session.isVerified && (
              <Link href={`${path}/review`} className="btn-primary mt-3">
                Rate this conference
              </Link>
            )}
          </div>
        </div>

        {categoryScores.length > 0 && (
          <div className="mt-6 grid gap-2 border-t border-slate-100 pt-5 lg:grid-cols-2 lg:gap-x-10">
            {CONFERENCE_SCORE_CATEGORIES.map((c) => {
              const s = categoryScores.find((x) => x.category === c.key);
              return s ? (
                <ScoreBar key={c.key} label={c.label} score={s.weighted_score} count={s.review_count} />
              ) : null;
            })}
          </div>
        )}

        {aiSummary && (
          <div className="mt-5 rounded-md border border-navy-100 bg-navy-50/60 p-4">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-navy-600">
              AI summary of verified reviews
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{aiSummary}</p>
          </div>
        )}
      </div>

      <div className="mt-10 max-w-4xl space-y-4">
        <h2 className="text-lg font-bold text-navy-900">Attendee reviews ({reviews.length})</h2>
        {reviews.length > 0 ? (
          reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              returnPath={path}
              canInteract={session.isVerified}
              categoryLabels={categoryLabels}
              canOfficiallyRespond={viewerIsRep}
            />
          ))
        ) : (
          <EmptyState>No published reviews yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
