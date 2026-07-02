import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ReviewForm } from "@/components/ReviewForm";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SoftwareReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect(`/login?next=/software/${slug}/review`);
  if (!session.isVerified) redirect(`/dashboard?error=${encodeURIComponent("Contributing unlocks once your account is verified.")}`);

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("software_products")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!product) notFound();

  return (
    <div className="container-page max-w-3xl py-10">
      <FlashMessages error={error} />
      <ReviewForm
        entityType="software"
        entityId={product.id}
        entityName={product.name}
        returnPath={`/software/${slug}`}
      />
    </div>
  );
}
