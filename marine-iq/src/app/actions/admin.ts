"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin server actions. Every mutation:
 *   1. re-checks admin via the caller's own session (requireAdmin),
 *   2. runs through the service-role client,
 *   3. writes an audit_logs entry with the acting admin's id.
 */

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {}
) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

/** Approve / reject / suspend a user, setting their verification status. */
export async function decideUser(formData: FormData) {
  const session = await requireAdmin().catch((e: Error) => fail("/admin/users", e.message));
  const userId = String(formData.get("user_id"));
  const status = String(formData.get("status"));
  const methods = formData.getAll("methods").map(String);

  const allowed = [
    "verified_professional", "verified_company_rep", "verified_software_vendor",
    "verified_conference_organizer", "rejected", "suspended", "pending",
  ];
  if (!allowed.includes(status)) fail("/admin/users", "Invalid status");

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ status, ...(methods.length ? { verification_methods: methods } : {}) })
    .eq("id", userId);
  if (error) fail("/admin/users", error.message);

  // The status-change trigger runs without an authenticated actor under the
  // service role, so record the acting admin explicitly.
  await audit(session.userId!, `admin_user_${status}`, "user", userId, { methods });
  redirect("/admin/users?notice=" + encodeURIComponent("User updated."));
}

/** Resolve a moderation flag: keep, remove, or dismiss. */
export async function resolveFlag(formData: FormData) {
  const session = await requireAdmin().catch((e: Error) => fail("/admin/flags", e.message));
  const flagId = String(formData.get("flag_id"));
  const decision = String(formData.get("decision")); // resolved_kept | resolved_removed | dismissed
  const targetType = String(formData.get("target_type"));
  const targetId = String(formData.get("target_id"));

  if (!["resolved_kept", "resolved_removed", "dismissed"].includes(decision)) {
    fail("/admin/flags", "Invalid decision");
  }

  const admin = createAdminClient();
  const contentTable =
    targetType === "review" ? "reviews" : targetType === "comment" ? "comments" : targetType === "post" ? "posts" : null;

  if (contentTable) {
    if (decision === "resolved_removed") {
      await admin.from(contentTable).update({ status: "removed" }).eq("id", targetId);
    } else if (decision === "resolved_kept") {
      await admin
        .from(contentTable)
        .update({
          status: "published",
          ...(contentTable === "reviews" ? { published_at: new Date().toISOString() } : {}),
        })
        .eq("id", targetId);
    }
  }

  const { error } = await admin
    .from("moderation_flags")
    .update({ status: decision, resolved_by: session.userId, resolved_at: new Date().toISOString() })
    .eq("id", flagId);
  if (error) fail("/admin/flags", error.message);

  await audit(session.userId!, `flag_${decision}`, targetType, targetId, { flag_id: flagId });
  redirect("/admin/flags?notice=" + encodeURIComponent("Flag resolved."));
}

/** Approve or reject a company claim. */
export async function decideClaim(formData: FormData) {
  const session = await requireAdmin().catch((e: Error) => fail("/admin/claims", e.message));
  const claimId = String(formData.get("claim_id"));
  const decision = String(formData.get("decision")); // approved | rejected
  if (!["approved", "rejected"].includes(decision)) fail("/admin/claims", "Invalid decision");

  const admin = createAdminClient();

  // The DB trigger wires up representative + claimed flag on approval; do the
  // same explicitly here since service-role bypasses auth.uid() in triggers.
  const { data: claim, error } = await admin
    .from("company_claims")
    .update({ status: decision, reviewed_by: session.userId, reviewed_at: new Date().toISOString() })
    .eq("id", claimId)
    .select("company_id, user_id")
    .single();
  if (error) fail("/admin/claims", error.message);

  if (decision === "approved") {
    await admin.from("companies").update({ is_claimed: true }).eq("id", claim.company_id);
    await admin
      .from("company_representatives")
      .upsert({ company_id: claim.company_id, user_id: claim.user_id, added_by: session.userId });
    await admin
      .from("users")
      .update({ company_id: claim.company_id })
      .eq("id", claim.user_id)
      .is("company_id", null);
  }

  await audit(session.userId!, `claim_${decision}`, "company_claim", claimId, claim);
  redirect("/admin/claims?notice=" + encodeURIComponent("Claim " + decision + "."));
}

/** Publish or dismiss a Commercial Trust Index signal. */
export async function decideTrustSignal(formData: FormData) {
  const session = await requireAdmin().catch((e: Error) => fail("/admin/trust-signals", e.message));
  const signalId = String(formData.get("signal_id"));
  const decision = String(formData.get("decision")); // published | dismissed
  if (!["published", "dismissed"].includes(decision)) fail("/admin/trust-signals", "Invalid decision");

  const admin = createAdminClient();
  const { error } = await admin
    .from("trust_signals")
    .update({ status: decision, reviewed_by: session.userId, reviewed_at: new Date().toISOString() })
    .eq("id", signalId);
  if (error) fail("/admin/trust-signals", error.message);

  await audit(session.userId!, `trust_signal_${decision}`, "trust_signal", signalId);
  redirect("/admin/trust-signals?notice=" + encodeURIComponent("Signal " + decision + "."));
}

/** Short-lived signed URL so an admin can view a verification upload. */
export async function getVerificationDocUrl(storagePath: string): Promise<string | null> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from("verification-docs")
    .createSignedUrl(storagePath, 60 * 10);
  return data?.signedUrl ?? null;
}

/** Merge a duplicate company into a canonical one. */
export async function mergeCompanies(formData: FormData) {
  const session = await requireAdmin().catch((e: Error) => fail("/admin", e.message));
  const duplicateId = String(formData.get("duplicate_id"));
  const canonicalId = String(formData.get("canonical_id"));
  if (!duplicateId || !canonicalId || duplicateId === canonicalId) {
    fail("/admin", "Pick two different companies");
  }

  const admin = createAdminClient();
  await admin.from("reviews").update({ company_id: canonicalId }).eq("company_id", duplicateId);
  await admin.from("comments").update({ company_id: canonicalId }).eq("company_id", duplicateId);
  await admin.from("trust_signals").update({ company_id: canonicalId }).eq("company_id", duplicateId);
  await admin.from("users").update({ company_id: canonicalId }).eq("company_id", duplicateId);
  const { error } = await admin
    .from("companies")
    .update({ merged_into: canonicalId })
    .eq("id", duplicateId);
  if (error) fail("/admin", error.message);

  await audit(session.userId!, "company_merge", "company", duplicateId, { merged_into: canonicalId });
  redirect("/admin?notice=" + encodeURIComponent("Companies merged."));
}
