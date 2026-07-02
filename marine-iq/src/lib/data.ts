import { createClient } from "@/lib/supabase/server";
import type { CategoryScore, OverallScore } from "@/lib/types";
import type { ReviewWithAuthor } from "@/components/ReviewCard";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function getOverallScores(
  supabase: Supabase,
  entityType: string,
  entityIds: string[]
): Promise<Map<string, OverallScore>> {
  if (entityIds.length === 0) return new Map();
  const { data } = await supabase
    .from("entity_overall_scores")
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);
  return new Map((data ?? []).map((r) => [r.entity_id as string, r as unknown as OverallScore]));
}

export async function getCategoryScores(
  supabase: Supabase,
  entityType: string,
  entityId: string
): Promise<CategoryScore[]> {
  const { data } = await supabase
    .from("entity_category_scores")
    .select("category, weighted_score, review_count")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  return (data ?? []) as CategoryScore[];
}

/** Published reviews for one entity, hydrated with author profile, structured
 *  scores, helpful votes and company responses. */
export async function getReviewsForEntity(
  supabase: Supabase,
  entityType: "company" | "software" | "conference",
  entityId: string
): Promise<ReviewWithAuthor[]> {
  const column = `${entityType === "software" ? "software" : entityType}_id`;
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq(column, entityId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!reviews || reviews.length === 0) return [];
  const reviewIds = reviews.map((r) => r.id);
  const authorIds = [...new Set(reviews.map((r) => r.author_id))];

  const [{ data: authors }, { data: scores }, { data: votes }, { data: responses }] =
    await Promise.all([
      supabase
        .from("professional_profiles")
        .select("user_id, display_name, company_name, title")
        .in("user_id", authorIds),
      supabase.from("review_scores").select("review_id, category, score").in("review_id", reviewIds),
      supabase.from("votes").select("target_id").eq("target_type", "review").in("target_id", reviewIds),
      supabase
        .from("comments")
        .select("id, review_id, body, is_company_rep, created_at, author_id")
        .in("review_id", reviewIds)
        .eq("status", "published")
        .order("created_at"),
    ]);

  const authorMap = new Map((authors ?? []).map((a) => [a.user_id, a]));
  const responseAuthorIds = [...new Set((responses ?? []).map((r) => r.author_id))];
  const { data: responseAuthors } = responseAuthorIds.length
    ? await supabase
        .from("professional_profiles")
        .select("user_id, display_name")
        .in("user_id", responseAuthorIds)
    : { data: [] as { user_id: string; display_name: string }[] };
  const responseAuthorMap = new Map((responseAuthors ?? []).map((a) => [a.user_id, a]));

  return reviews.map((r) => ({
    ...r,
    author: authorMap.get(r.author_id) ?? null,
    scores: (scores ?? []).filter((s) => s.review_id === r.id),
    helpful_count: (votes ?? []).filter((v) => v.target_id === r.id).length,
    responses: (responses ?? [])
      .filter((c) => c.review_id === r.id)
      .map((c) => ({ ...c, author: responseAuthorMap.get(c.author_id) ?? null })),
  }));
}

export async function getSectors(supabase: Supabase) {
  const { data } = await supabase.from("sectors").select("id, slug, name").order("name");
  return data ?? [];
}

export async function getCategories(supabase: Supabase) {
  const { data } = await supabase.from("categories").select("id, slug, name").order("name");
  return data ?? [];
}
