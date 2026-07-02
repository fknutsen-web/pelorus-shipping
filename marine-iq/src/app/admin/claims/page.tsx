import { createClient } from "@/lib/supabase/server";
import { decideClaim } from "@/app/actions/admin";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Company Claims" };

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const supabase = await createClient();

  const { data: claims } = await supabase
    .from("company_claims")
    .select("*")
    .eq("status", "pending")
    .order("created_at");

  const companyIds = [...new Set((claims ?? []).map((c) => c.company_id))];
  const userIds = [...new Set((claims ?? []).map((c) => c.user_id))];
  const [{ data: companies }, { data: users }] = await Promise.all([
    companyIds.length
      ? supabase.from("companies").select("id, name, website").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string; website: string | null }[] }),
    userIds.length
      ? supabase.from("users").select("id, full_name, email, job_title, company_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string; job_title: string; company_name: string }[] }),
  ]);
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <div>
      <FlashMessages error={error} notice={notice} />
      <h1 className="mb-4 text-lg font-bold text-navy-900">Pending company claims</h1>
      <div className="space-y-4">
        {(claims ?? []).map((claim) => {
          const company = companyMap.get(claim.company_id);
          const user = userMap.get(claim.user_id);
          const claimDomain = claim.corporate_email.split("@")[1];
          const siteDomain = company?.website?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
          return (
            <div key={claim.id} className="card p-5 text-sm">
              <div className="font-semibold text-navy-900">{company?.name ?? "Unknown company"}</div>
              <div className="mt-1 text-slate-600">
                Claimed by <strong>{user?.full_name}</strong> ({user?.job_title}, {user?.company_name}) —{" "}
                {user?.email}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Corporate email provided: <strong>{claim.corporate_email}</strong>
                {siteDomain && (
                  <>
                    {" · "}company website domain: <strong>{siteDomain}</strong>
                    {" · "}
                    {siteDomain.endsWith(claimDomain) || claimDomain.endsWith(siteDomain ?? "") ? (
                      <span className="text-emerald-600">domain match ✓</span>
                    ) : (
                      <span className="text-amber-600">domain mismatch — verify manually</span>
                    )}
                  </>
                )}
              </div>
              {claim.evidence && (
                <p className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600">{claim.evidence}</p>
              )}
              <form action={decideClaim} className="mt-3 flex gap-2">
                <input type="hidden" name="claim_id" value={claim.id} />
                <button name="decision" value="approved" className="btn-primary !py-1.5 text-xs">
                  Approve claim
                </button>
                <button name="decision" value="rejected" className="btn-secondary !py-1.5 text-xs">
                  Reject
                </button>
              </form>
            </div>
          );
        })}
        {(!claims || claims.length === 0) && (
          <div className="card p-10 text-center text-sm text-slate-400">No pending claims. ⚓</div>
        )}
      </div>
    </div>
  );
}
