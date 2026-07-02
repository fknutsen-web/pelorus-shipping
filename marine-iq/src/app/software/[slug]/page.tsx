import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getCategoryScores, getReviewsForEntity, getOverallScores } from "@/lib/data";
import { SOFTWARE_SCORE_CATEGORIES } from "@/lib/constants";
import { Stars, ScoreBar, FlashMessages, EmptyState } from "@/components/ui";
import { ReviewCard } from "@/components/ReviewCard";

export const dynamic = "force-dynamic";

const categoryLabels = Object.fromEntries(SOFTWARE_SCORE_CATEGORIES.map((c) => [c.key, c.label]));

export default async function SoftwareDetailPage({
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

  const { data: product } = await supabase
    .from("software_products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!product) notFound();

  const [overall, categoryScores, reviews] = await Promise.all([
    getOverallScores(supabase, "software", [product.id]),
    getCategoryScores(supabase, "software", product.id),
    getReviewsForEntity(supabase, "software", product.id),
  ]);
  const score = overall.get(product.id);
  const path = `/software/${slug}`;

  return (
    <div className="container-page py-10">
      <FlashMessages error={error} notice={notice} />
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">{product.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {product.vendor_name && <>by {product.vendor_name} · </>}
              {product.pricing_model && <>{product.pricing_model} · </>}
              {product.website && (
                <a href={product.website} className="text-navy-700 hover:underline" rel="nofollow noopener">
                  Website
                </a>
              )}
            </p>
            {product.description && (
              <p className="mt-3 max-w-2xl text-sm text-slate-600">{product.description}</p>
            )}
          </div>
          <div className="text-right">
            <Stars score={score?.overall_score ?? null} size="text-lg" />
            <div className="mt-1 text-xs text-slate-500">
              {score?.review_count ?? 0} verified review{(score?.review_count ?? 0) === 1 ? "" : "s"}
            </div>
            {session.isVerified && (
              <Link href={`${path}/review`} className="btn-primary mt-3">
                Review this software
              </Link>
            )}
          </div>
        </div>

        {categoryScores.length > 0 && (
          <div className="mt-6 grid gap-2 border-t border-slate-100 pt-5 lg:grid-cols-2 lg:gap-x-10">
            {SOFTWARE_SCORE_CATEGORIES.map((c) => {
              const s = categoryScores.find((x) => x.category === c.key);
              return s ? (
                <ScoreBar key={c.key} label={c.label} score={s.weighted_score} count={s.review_count} />
              ) : null;
            })}
          </div>
        )}
      </div>

      <div className="mt-10 max-w-4xl space-y-4">
        <h2 className="text-lg font-bold text-navy-900">Verified user reviews ({reviews.length})</h2>
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
          <EmptyState>No published reviews yet.</EmptyState>
        )}
      </div>
    </div>
  );
}
