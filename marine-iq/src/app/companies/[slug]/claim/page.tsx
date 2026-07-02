import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { submitClaim } from "@/app/actions/community";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect(`/login?next=/companies/${slug}/claim`);

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, is_claimed, website")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  return (
    <div className="container-page max-w-2xl py-10">
      <FlashMessages error={error} />
      <h1 className="text-2xl font-bold text-navy-900">Claim {company.name}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Verify with a corporate email on the company&apos;s domain. After admin approval you
        can respond to reviews as a labeled Company Representative and keep factual
        information current. Claimed companies cannot delete reviews, edit reviews,
        change ratings or hide negative feedback.
      </p>

      {company.is_claimed ? (
        <div className="card mt-6 p-6 text-sm text-slate-600">
          This profile is already claimed. If you believe this is incorrect, report it to
          the moderators from the company page.
        </div>
      ) : (
        <form action={submitClaim} className="card mt-6 space-y-4 p-6">
          <input type="hidden" name="company_id" value={company.id} />
          <input type="hidden" name="company_slug" value={company.slug} />
          <div>
            <label className="label">Corporate email on the company domain *</label>
            <input name="corporate_email" type="email" className="input" required placeholder="you@company-domain.com" />
          </div>
          <div>
            <label className="label">Supporting information (role, proof of authority)</label>
            <textarea name="evidence" className="input min-h-24" />
          </div>
          <button className="btn-primary">Submit claim for admin approval</button>
        </form>
      )}
    </div>
  );
}
