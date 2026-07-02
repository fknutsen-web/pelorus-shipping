import { createClient } from "@/lib/supabase/server";
import { VERIFIED_STATUSES } from "@/lib/constants";
import type { AccountRow } from "@/lib/types";

export interface SessionInfo {
  userId: string | null;
  account: AccountRow | null;
  isVerified: boolean;
  isAdmin: boolean;
}

/** Loads the signed-in user's private account row (RLS: own row only). */
export async function getSession(): Promise<SessionInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, account: null, isVerified: false, isAdmin: false };
  }

  const { data: account } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const isVerified =
    !!account && (VERIFIED_STATUSES as readonly string[]).includes(account.status);
  const isAdmin = !!account && (account.role === "admin" || account.role === "moderator");

  return { userId: user.id, account: account ?? null, isVerified, isAdmin };
}

/** Throws unless the caller is a verified member. Use in server actions. */
export async function requireVerified(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session.userId) throw new Error("You must be signed in.");
  if (!session.isVerified)
    throw new Error("Only verified maritime professionals can contribute.");
  return session;
}

/** Throws unless the caller is an admin/moderator. Use before any service-role call. */
export async function requireAdmin(): Promise<SessionInfo> {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Admin access required.");
  return session;
}
