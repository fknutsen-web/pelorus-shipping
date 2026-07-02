import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { endorsePeer } from "@/app/actions/community";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProfessionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await getSession();

  const { data: profile } = await supabase
    .from("professional_profiles")
    .select("*")
    .eq("user_id", id)
    .eq("is_public", true)
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: stats }, { data: reputation }, { data: endorsements }, { data: sector }] =
    await Promise.all([
      supabase.from("profile_stats").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("reputation_scores").select("tier, score").eq("user_id", id).maybeSingle(),
      supabase
        .from("endorsements")
        .select("specialty, endorser_id")
        .eq("endorsed_id", id)
        .limit(50),
      profile.sector_id
        ? supabase.from("sectors").select("name").eq("id", profile.sector_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const endorsementCounts = new Map<string, number>();
  for (const e of endorsements ?? []) {
    endorsementCounts.set(e.specialty, (endorsementCounts.get(e.specialty) ?? 0) + 1);
  }

  const statItems: [string, number][] = [
    ["Reviews submitted", stats?.reviews_submitted ?? 0],
    ["Software reviewed", stats?.software_reviewed ?? 0],
    ["Conferences reviewed", stats?.conferences_reviewed ?? 0],
    ["Comments", stats?.comments_submitted ?? 0],
    ["Helpful votes received", stats?.helpful_votes ?? 0],
    ["Peer endorsements", stats?.peer_endorsements ?? 0],
  ];

  return (
    <div className="container-page max-w-4xl py-10">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">{profile.display_name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {profile.title}, {profile.company_name}
            </p>
            <p className="text-xs text-slate-400">
              {[sector?.name, profile.country].filter(Boolean).join(" · ")}
              {profile.years_experience != null && ` · ${profile.years_experience} years in industry`}
            </p>
          </div>
          <div className="text-right">
            <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              ✓ {reputation?.tier ?? "Verified Professional"}
            </span>
            <div className="mt-1 text-xs text-slate-400">Reputation {reputation?.score ?? 0}</div>
          </div>
        </div>

        {profile.bio && <p className="mt-4 text-sm leading-relaxed text-slate-600">{profile.bio}</p>}

        {profile.specialties?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.specialties.map((s: string) => (
              <span key={s} className="badge bg-navy-50 text-navy-800">{s}</span>
            ))}
          </div>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-center sm:grid-cols-3 lg:grid-cols-6">
          {statItems.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="text-xl font-bold text-navy-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Peer endorsements
          </h2>
          {endorsementCounts.size > 0 ? (
            <ul className="space-y-2">
              {[...endorsementCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([specialty, count]) => (
                  <li key={specialty} className="card flex items-center justify-between p-3 text-sm">
                    <span className="font-medium text-navy-900">{specialty}</span>
                    <span className="text-xs text-slate-500">{count} endorsement{count === 1 ? "" : "s"}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <EmptyState>No endorsements yet.</EmptyState>
          )}
        </section>

        {session.isVerified && session.userId !== id && (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Endorse this professional
            </h2>
            <form action={endorsePeer} className="card space-y-3 p-4">
              <input type="hidden" name="endorsed_id" value={id} />
              <input type="hidden" name="return_path" value={`/professionals/${id}`} />
              <div>
                <label className="label">Specialty</label>
                <input name="specialty" className="input" required placeholder="e.g. Laytime & demurrage" />
              </div>
              <button className="btn-secondary">Endorse</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
