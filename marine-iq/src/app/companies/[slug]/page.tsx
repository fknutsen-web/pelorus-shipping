import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getCategoryScores, getReviewsForEntity } from "@/lib/data";
import { COMPANY_SCORE_CATEGORIES, TRUST_SIGNAL_LABELS } from "@/lib/constants";
import { Stars, ScoreBar, FlashMessages, EmptyState } from "@/components/ui";
import { ReviewCard } from "@/components/ReviewCard";
import { CommentSection } from "@/components/CommentSection";

export const dynamic = "force-dynamic";

const categoryLabels = Object.fromEntries(COMPANY_SCORE_CATEGORIES.map((c) => [c.key, c.label]));

export default async function CompanyPage({
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

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const [trust, categoryScores, reviews, { data: comments }, { data: signals }] =
    await Promise.all([
      supabase.from("company_trust_index").select("*").eq("company_id", company.id).maybeSingle(),
      getCategoryScores(supabase, "company", company.id),
      getReviewsForEntity(supabase, "company", company.id),
      supabase
        .from("comments")
        .select("id, body, is_company_rep, created_at, author_id")
        .eq("company_id", company.id)
        .eq("status", "published")
        .order("created_at"),
      supabase
        .from("trust_signals")
        .select("id, signal_type, description, created_at")
        .eq("company_id", company.id)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
    ]);

  const commentAuthorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
  const { data: commentAuthors } = commentAuthorIds.length
    ? await supabase
        .from("professional_profiles")
        .select("user_id, display_name, title, company_name")
        .in("user_id", commentAuthorIds)
    : { data: [] };
  const authorMap = new Map((commentAuthors ?? []).map((a) => [a.user_id, a]));

  const path = `/companies/${slug}`;

  return (
    <div className="container-page py-10">
      <FlashMessages error={error} notice={notice} />

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">{company.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {[company.hq_city, company.hq_country].filter(Boolean).join(", ")}
              {company.website && (
                <>
                  {" · "}
                  <a href={company.website} className="text-navy-700 hover:underline" rel="nofollow noopener">
                    Website
                  </a>
                </>
              )}
              {" · "}
              {company.is_claimed ? (
                <span className="badge bg-emerald-50 text-emerald-700">Claimed profile</span>
              ) : (
                <Link href={`${path}/claim`} className="text-navy-700 hover:underline">
                  Unclaimed — claim this profile
                </Link>
              )}
            </p>
            {company.description && (
              <p className="mt-3 max-w-2xl text-sm text-slate-600">{company.description}</p>
            )}
          </div>
          <div className="text-right">
            <Stars score={trust.data?.overall_score ?? null} size="text-lg" />
            {trust.data && (
              <div className="mt-1 text-xs text-slate-500">
                Reputation confidence: <strong>{trust.data.reputation_confidence}</strong>
                <br />
                Trust status: <strong>{trust.data.risk_label}</strong>
              </div>
            )}
            {session.isVerified && (
              <Link href={`${path}/review`} className="btn-primary mt-3">
                Write a review
              </Link>
            )}
          </div>
        </div>

        {categoryScores.length > 0 && (
          <div className="mt-6 grid gap-2 border-t border-slate-100 pt-5 lg:grid-cols-2 lg:gap-x-10">
            {COMPANY_SCORE_CATEGORIES.map((c) => {
              const s = categoryScores.find((x) => x.category === c.key);
              return s ? (
                <ScoreBar key={c.key} label={c.label} score={s.weighted_score} count={s.review_count} />
              ) : null;
            })}
          </div>
        )}
      </div>

      {signals && signals.length > 0 && (
        <div className="card mt-6 border-amber-200 bg-amber-50/50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">
            Risk indicators (admin-reviewed)
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {signals.map((s) => (
              <li key={s.id}>
                <span className="badge bg-amber-100 text-amber-800">
                  {TRUST_SIGNAL_LABELS[s.signal_type] ?? s.signal_type}
                </span>{" "}
                {s.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-bold text-navy-900">
            Verified reviews ({reviews.length})
          </h2>
          {reviews.length > 0 ? (
            reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                returnPath={path}
                canInteract={session.isVerified}
                categoryLabels={categoryLabels}
              />
            ))
          ) : (
            <EmptyState>
              No published reviews yet.{" "}
              {session.isVerified ? (
                <Link href={`${path}/review`} className="font-semibold text-navy-700 hover:underline">
                  Be the first to review this company.
                </Link>
              ) : (
                "Verified members can be the first to review this company."
              )}
            </EmptyState>
          )}
        </div>

        <div>
          <CommentSection
            comments={(comments ?? []).map((c) => ({ ...c, author: authorMap.get(c.author_id) ?? null }))}
            parentField="company_id"
            parentId={company.id}
            returnPath={path}
            canComment={session.isVerified}
          />
        </div>
      </div>
    </div>
  );
}
