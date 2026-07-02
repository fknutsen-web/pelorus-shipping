import { createClient } from "@/lib/supabase/server";
import { decideTrustSignal } from "@/app/actions/admin";
import { TRUST_SIGNAL_LABELS } from "@/lib/constants";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trust Signals" };

export default async function AdminTrustSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const supabase = await createClient();

  const { data: signals } = await supabase
    .from("trust_signals")
    .select("*")
    .eq("status", "pending_admin_review")
    .order("created_at");

  const companyIds = [...new Set((signals ?? []).map((s) => s.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] };
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <FlashMessages error={error} notice={notice} />
      <h1 className="mb-1 text-lg font-bold text-navy-900">Trust signals awaiting review</h1>
      <p className="mb-4 text-xs text-slate-500">
        Risk indicators are never published without admin review. Check supporting
        evidence before publishing — prefer structured, factual language.
      </p>
      <div className="space-y-4">
        {(signals ?? []).map((s) => (
          <div key={s.id} className="card p-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-navy-900">{companyMap.get(s.company_id) ?? "Company"}</span>
              <span className="badge bg-amber-100 text-amber-800">
                {TRUST_SIGNAL_LABELS[s.signal_type] ?? s.signal_type}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(s.created_at).toLocaleDateString("en-GB")}
              </span>
            </div>
            <p className="mt-2 text-slate-700">{s.description}</p>
            {s.reference_url && (
              <a href={s.reference_url} className="mt-1 block text-xs text-navy-700 hover:underline" rel="nofollow noopener" target="_blank">
                Supporting reference
              </a>
            )}
            <form action={decideTrustSignal} className="mt-3 flex gap-2">
              <input type="hidden" name="signal_id" value={s.id} />
              <button name="decision" value="published" className="btn-primary !py-1.5 text-xs">
                Publish signal
              </button>
              <button name="decision" value="dismissed" className="btn-secondary !py-1.5 text-xs">
                Dismiss
              </button>
            </form>
          </div>
        ))}
        {(!signals || signals.length === 0) && (
          <div className="card p-10 text-center text-sm text-slate-400">Nothing waiting. ⚓</div>
        )}
      </div>
    </div>
  );
}
