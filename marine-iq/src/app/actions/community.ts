"use server";

import { redirect } from "next/navigation";
import { requireVerified } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { screenContent } from "@/lib/moderation";
import { POST_TYPES } from "@/lib/constants";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** Comment on a review, post, company, software product or conference. */
export async function addComment(formData: FormData) {
  const returnPath = String(formData.get("return_path") || "/");
  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 3) fail(returnPath, "Write a comment first");

  const parentField = String(formData.get("parent_field"));
  const parentId = String(formData.get("parent_id"));
  if (!["review_id", "post_id", "company_id", "software_id", "conference_id"].includes(parentField) || !parentId) {
    fail(returnPath, "Invalid comment target");
  }

  const screen = screenContent(body);
  const status = screen.clean ? "published" : "under_review";

  const supabase = await createClient();
  const { data: comment, error } = await supabase
    .from("comments")
    .insert({ author_id: session.userId, body, status, [parentField]: parentId })
    .select("id")
    .single();

  if (error) {
    fail(
      returnPath,
      error.message.includes("MARINE_IQ_NOT_VERIFIED")
        ? "Only verified members can comment."
        : error.message
    );
  }

  if (!screen.clean) {
    await supabase.from("moderation_flags").insert(
      screen.flags.map((f) => ({
        target_type: "comment",
        target_id: comment.id,
        reason: f.reason,
        details: f.details,
        flagged_by: null,
      }))
    );
    redirect(`${returnPath}?notice=${encodeURIComponent("Your comment is awaiting moderation.")}`);
  }
  redirect(returnPath);
}

/** Toggle a "helpful" vote on a review, comment or post. */
export async function toggleHelpful(formData: FormData) {
  const returnPath = String(formData.get("return_path") || "/");
  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const targetType = String(formData.get("target_type"));
  const targetId = String(formData.get("target_id"));
  if (!["review", "comment", "post"].includes(targetType) || !targetId) {
    fail(returnPath, "Invalid vote target");
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("votes")
    .select("id")
    .eq("user_id", session.userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    await supabase.from("votes").delete().eq("id", existing.id);
  } else {
    await supabase.from("votes").insert({
      user_id: session.userId,
      target_type: targetType,
      target_id: targetId,
    });
  }
  redirect(returnPath);
}

/** Endorse a peer for a specialty. */
export async function endorsePeer(formData: FormData) {
  const returnPath = String(formData.get("return_path") || "/professionals");
  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const endorsedId = String(formData.get("endorsed_id"));
  const specialty = String(formData.get("specialty") ?? "").trim();
  if (!endorsedId || specialty.length < 2) fail(returnPath, "Name the specialty you are endorsing");
  if (endorsedId === session.userId) fail(returnPath, "You cannot endorse yourself");

  const supabase = await createClient();
  const { error } = await supabase.from("endorsements").insert({
    endorser_id: session.userId,
    endorsed_id: endorsedId,
    specialty,
  });
  if (error && !error.message.includes("duplicate")) fail(returnPath, error.message);
  redirect(returnPath);
}

/** Create a feed post. */
export async function createPost(formData: FormData) {
  const returnPath = "/feed";
  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const postType = String(formData.get("post_type") || "general");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  if (!POST_TYPES.some((t) => t.value === postType)) fail(returnPath, "Pick a post type");
  if (body.length < 10) fail(returnPath, "Write something first");

  const screen = screenContent(`${title}\n${body}`);
  const status = screen.clean ? "published" : "under_review";

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .insert({ author_id: session.userId, post_type: postType, title: title || null, body, tags, status })
    .select("id")
    .single();

  if (error) fail(returnPath, error.message);

  if (!screen.clean) {
    await supabase.from("moderation_flags").insert(
      screen.flags.map((f) => ({
        target_type: "post",
        target_id: post.id,
        reason: f.reason,
        details: f.details,
        flagged_by: null,
      }))
    );
    redirect(`${returnPath}?notice=${encodeURIComponent("Your post is awaiting moderation.")}`);
  }
  redirect(returnPath);
}

/** Claim a company profile with a corporate email on the company's domain. */
export async function submitClaim(formData: FormData) {
  const companySlug = String(formData.get("company_slug"));
  const returnPath = `/companies/${companySlug}`;
  const session = await requireVerified().catch((e: Error) => fail(returnPath, e.message));

  const companyId = String(formData.get("company_id"));
  const corporateEmail = String(formData.get("corporate_email") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim();

  if (!companyId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(corporateEmail)) {
    fail(`${returnPath}/claim`, "A valid corporate email on the company domain is required");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("company_claims").insert({
    company_id: companyId,
    user_id: session.userId,
    corporate_email: corporateEmail,
    evidence,
  });
  if (error) fail(`${returnPath}/claim`, error.message);

  redirect(`${returnPath}?notice=${encodeURIComponent("Claim submitted — an admin will verify your corporate email and approve the claim.")}`);
}

/** Add a directory entry (company / software / conference) as a verified member. */
export async function addDirectoryEntry(formData: FormData) {
  const kind = String(formData.get("kind"));
  const listPath = kind === "company" ? "/companies" : kind === "software" ? "/software" : "/conferences";
  const session = await requireVerified().catch((e: Error) => fail(listPath, e.message));

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) fail(listPath, "Name is required");
  const slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) +
    "-" + Math.random().toString(36).slice(2, 6);

  const supabase = await createClient();
  const common = { slug, name, created_by: session.userId };
  let error;

  if (kind === "company") {
    ({ error } = await supabase.from("companies").insert({
      ...common,
      hq_country: String(formData.get("hq_country") ?? "") || null,
      hq_city: String(formData.get("hq_city") ?? "") || null,
      website: String(formData.get("website") ?? "") || null,
      sector_id: parseInt(String(formData.get("sector_id") ?? ""), 10) || null,
      description: String(formData.get("description") ?? "") || null,
    }));
  } else if (kind === "software") {
    ({ error } = await supabase.from("software_products").insert({
      ...common,
      vendor_name: String(formData.get("vendor_name") ?? "") || null,
      website: String(formData.get("website") ?? "") || null,
      category_id: parseInt(String(formData.get("category_id") ?? ""), 10) || null,
      pricing_model: String(formData.get("pricing_model") ?? "") || null,
      description: String(formData.get("description") ?? "") || null,
    }));
  } else if (kind === "conference") {
    ({ error } = await supabase.from("conferences").insert({
      ...common,
      organizer_name: String(formData.get("organizer_name") ?? "") || null,
      location: String(formData.get("location") ?? "") || null,
      website: String(formData.get("website") ?? "") || null,
      sector_id: parseInt(String(formData.get("sector_id") ?? ""), 10) || null,
      typical_cost_estimate: String(formData.get("typical_cost_estimate") ?? "") || null,
    }));
  } else {
    fail(listPath, "Invalid entry type");
  }

  if (error) fail(listPath, error.message);
  redirect(`${listPath}?notice=${encodeURIComponent("Added to the directory. Thank you for contributing.")}`);
}
