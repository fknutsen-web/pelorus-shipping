import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ReviewForm } from "@/components/ReviewForm";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CompanyReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect(`/login?next=/companies/${slug}/review`);
  if (!session.isVerified) redirect(`/dashboard?error=${encodeURIComponent("Contributing unlocks once your account is verified.")}`);

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  return (
    <div className="container-page max-w-3xl py-10">
      <FlashMessages error={error} />
      <ReviewForm
        entityType="company"
        entityId={company.id}
        entityName={company.name}
        returnPath={`/companies/${slug}`}
      />
    </div>
  );
}
