import { createAdminClient } from "@/lib/supabase/admin";
import { SCORE_CATEGORIES } from "@/lib/constants";
import type { CategoryScore } from "@/lib/types";

const MIN_REVIEWS_FOR_SUMMARY = 3;

/**
 * Returns the AI summary for an entity, regenerating it lazily when marked
 * stale by the new-review trigger. Uses Claude (claude-haiku-4-5 via the
 * Messages API) when ANTHROPIC_API_KEY is configured; otherwise falls back to
 * a deterministic template built from the weighted category scores, so the
 * feature degrades gracefully in development.
 */
export async function getOrRefreshSummary(
  entityType: "company" | "software" | "conference",
  entityId: string,
  entityName: string,
  reviewCount: number,
  categoryScores: CategoryScore[],
  reviewSnippets: string[]
): Promise<string | null> {
  if (reviewCount < MIN_REVIEWS_FOR_SUMMARY) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null; // service role not configured (e.g. local static preview)
  }

  const { data: existing } = await admin
    .from("ai_summaries")
    .select("summary, is_stale, review_count")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (existing?.summary && !existing.is_stale) return existing.summary;

  const summary =
    (await generateWithClaude(entityType, entityName, reviewCount, categoryScores, reviewSnippets)) ??
    templateSummary(entityType, entityName, reviewCount, categoryScores);

  await admin.from("ai_summaries").upsert({
    entity_type: entityType,
    entity_id: entityId,
    summary,
    review_count: reviewCount,
    is_stale: false,
    generated_at: new Date().toISOString(),
  });

  return summary;
}

async function generateWithClaude(
  entityType: string,
  entityName: string,
  reviewCount: number,
  categoryScores: CategoryScore[],
  reviewSnippets: string[]
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const labels = Object.fromEntries(
    (SCORE_CATEGORIES[entityType] ?? []).map((c) => [c.key, c.label])
  );
  const scoreLines = categoryScores
    .map((s) => `${labels[s.category] ?? s.category}: ${s.weighted_score}/5 (${s.review_count} reviews)`)
    .join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        system:
          "You summarize verified professional reviews for a maritime reputation platform. " +
          "Write ONE neutral, factual paragraph (2-3 sentences) starting with " +
          `"Based on ${reviewCount} verified reviews,". Name the consistently praised areas ` +
          "and any areas identified for improvement. Never use defamatory language " +
          "(scam, fraud, blacklist, crook); describe concerns as 'areas for improvement' " +
          "or 'reported concerns'. No markdown, no bullet points.",
        messages: [
          {
            role: "user",
            content: `${entityType} name: ${entityName}\n\nWeighted category scores:\n${scoreLines}\n\nReview excerpts:\n${reviewSnippets
              .slice(0, 12)
              .map((s) => `- ${s.slice(0, 300)}`)
              .join("\n")}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.stop_reason === "refusal") return null;
    const text = data.content?.find((b: { type: string }) => b.type === "text")?.text;
    return typeof text === "string" && text.length > 20 ? text.trim() : null;
  } catch {
    return null;
  }
}

/** Deterministic fallback when no model is configured. */
function templateSummary(
  entityType: string,
  entityName: string,
  reviewCount: number,
  categoryScores: CategoryScore[]
): string {
  const labels = Object.fromEntries(
    (SCORE_CATEGORIES[entityType] ?? []).map((c) => [c.key, c.label])
  );
  const sorted = [...categoryScores].sort((a, b) => b.weighted_score - a.weighted_score);
  const best = sorted.slice(0, 2).map((s) => (labels[s.category] ?? s.category).toLowerCase());
  const worst = sorted.length > 2 ? sorted[sorted.length - 1] : null;

  let text = `Based on ${reviewCount} verified reviews, users rate ${entityName} most highly on ${best.join(" and ")}`;
  if (worst && worst.weighted_score < 3.8) {
    text += `, while identifying ${(labels[worst.category] ?? worst.category).toLowerCase()} as an area for improvement`;
  }
  return text + ".";
}
