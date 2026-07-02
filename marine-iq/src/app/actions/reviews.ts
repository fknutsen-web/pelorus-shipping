"use server";

import { redirect } from "next/navigation";
import { requireVerified } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { screenContent } from "@/lib/moderation";
import { SCORE_CATEGORIES } from "@/lib/constants";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function friendlyDbError(message: string): string {
  if (message.includes("MARINE_IQ_CONFLICT"))
    return "Conflict of interest: you cannot rate your own company, its software, or its conferences. You may comment as a Company Representative instead.";
  if (message.includes("MARINE_IQ_NOT_VERIFIED"))
    return "Only verified maritime professionals can submit reviews.";
  if (message.includes("MARINE_IQ_LOCKED"))
    return "This review is locked (14 days after publication). Contact an admin to request a change.";
  if (message.includes("duplicate key") || message.includes("reviews_unique"))
    return "You have already reviewed this entry. You can edit your existing review from your dashboard.";
  return message;
}

/**
 * Submits a company/software/conference review.
 * Order of defenses: (1) this action validates and screens content,
 * (2) database triggers re-enforce verification + conflict-of-interest,
 * (3) RLS restricts the write to the author's own row.
 */
export async function submitReview(formData: FormData) {
  const entityType = String(formData.get("entity_type"));
  const entityId = String(formData.get("entity_id"));
  const returnPath = String(formData.get("return_path") || "/");

  if (!["company", "software", "conference"].includes(entityType) || !entityId) {
    fail(returnPath, "Invalid review target");
  }

  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const relationship = String(formData.get("relationship") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const overallRaw = String(formData.get("overall_rating") ?? "");
  const isCommentOnly = relationship === "current_employee";

  if (!relationship) fail(returnPath, "Select your relationship to this entry");
  if (title.length < 5) fail(returnPath, "Give your review a short title");
  if (body.length < 40) fail(returnPath, "Please write at least a few sentences (40+ characters)");

  const overallRating = isCommentOnly ? null : parseInt(overallRaw, 10);
  if (!isCommentOnly && (!overallRating || overallRating < 1 || overallRating > 5)) {
    fail(returnPath, "Select an overall rating from 1 to 5");
  }

  // Category scores for this entity type.
  const scores: { category: string; score: number }[] = [];
  if (!isCommentOnly) {
    for (const cat of SCORE_CATEGORIES[entityType] ?? []) {
      const v = parseInt(String(formData.get(`score_${cat.key}`) ?? ""), 10);
      if (v >= 1 && v <= 5) scores.push({ category: cat.key, score: v });
    }
  }

  // Conference-specific structured answers.
  const answers: Record<string, unknown> = {};
  let attendedYear: number | null = null;
  let wouldAttendAgain: boolean | null = null;
  if (entityType === "conference") {
    attendedYear = parseInt(String(formData.get("attended_year") ?? ""), 10) || null;
    if (!attendedYear) fail(returnPath, "Which year did you attend?");
    const waa = String(formData.get("would_attend_again") ?? "");
    wouldAttendAgain = waa === "yes" ? true : waa === "no" ? false : null;
    for (const key of [
      "role_at_event", "why_attended", "generated_contacts", "generated_business",
      "decision_makers_present", "who_should_attend", "who_should_skip",
    ]) {
      const v = String(formData.get(key) ?? "").trim();
      if (v) answers[key] = v;
    }
  }

  // Automated moderation screen — flagged content is held for admin review.
  const screen = screenContent(`${title}\n${body}`);
  const status = screen.clean ? "published" : "under_review";

  const supabase = await createClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      author_id: session.userId,
      entity_type: entityType,
      company_id: entityType === "company" ? entityId : null,
      software_id: entityType === "software" ? entityId : null,
      conference_id: entityType === "conference" ? entityId : null,
      relationship,
      title,
      body,
      overall_rating: overallRating,
      answers,
      attended_year: attendedYear,
      would_attend_again: wouldAttendAgain,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) fail(returnPath, friendlyDbError(error.message));

  if (scores.length > 0) {
    const { error: scoreError } = await supabase
      .from("review_scores")
      .insert(scores.map((s) => ({ ...s, review_id: review.id })));
    if (scoreError) fail(returnPath, friendlyDbError(scoreError.message));
  }

  if (!screen.clean) {
    await supabase.from("moderation_flags").insert(
      screen.flags.map((f) => ({
        target_type: "review",
        target_id: review.id,
        reason: f.reason,
        details: f.details,
        flagged_by: null,
      }))
    );
    redirect(`${returnPath}?notice=${encodeURIComponent("Thanks — your review passed to moderation and will publish after admin review.")}`);
  }

  redirect(`${returnPath}?notice=${encodeURIComponent("Your review has been published.")}`);
}

/** A verified member flags existing content for moderator attention. */
export async function flagContent(formData: FormData) {
  const returnPath = String(formData.get("return_path") || "/");
  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const targetType = String(formData.get("target_type"));
  const targetId = String(formData.get("target_id"));
  const reason = String(formData.get("reason") || "other");
  const details = String(formData.get("details") ?? "").slice(0, 2000);

  const supabase = await createClient();
  await supabase.from("moderation_flags").insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    details,
    flagged_by: session.userId,
  });

  redirect(`${returnPath}?notice=${encodeURIComponent("Reported to moderators. Thank you.")}`);
}
