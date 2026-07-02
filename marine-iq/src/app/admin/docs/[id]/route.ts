import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Admin-only: redirect to a short-lived signed URL for a verification upload. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("verification_documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data } = await admin.storage
    .from("verification-docs")
    .createSignedUrl(doc.storage_path, 600);
  if (!data?.signedUrl) return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
