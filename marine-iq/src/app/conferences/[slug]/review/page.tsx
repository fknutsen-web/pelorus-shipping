import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ReviewForm } from "@/components/ReviewForm";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConferenceReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect(`/login?next=/conferences/${slug}/review`);
  if (!session.isVerified) redirect(`/dashboard?error=${encodeURIComponent("Contributing unlocks once your account is verified.")}`);

  const supabase = await createClient();
  const { data: conference } = await supabase
    .from("conferences")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!conference) notFound();

  return (
    <div className="container-page max-w-3xl py-10">
      <FlashMessages error={error} />
      <ReviewForm
        entityType="conference"
        entityId={conference.id}
        entityName={conference.name}
        returnPath={`/conferences/${slug}`}
      />
    </div>
  );
}
