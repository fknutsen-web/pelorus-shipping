import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Stars, EmptyState, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Commercial Trust Index" };

export default async function TrustIndexPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("company_trust_index")
    .select("*")
    .order("review_count", { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <div className="container-page py-10">
      <PageTitle
        title="Commercial Trust Index"
        subtitle="A structured risk and trust system built from verified counterparty reviews and admin-reviewed dispute signals. Not a blacklist: every risk indicator passes admin review before publication, and companies can respond."
      />

      <div className="mb-6 grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
        <div className="card p-4">
          <strong className="text-navy-900">Trust categories.</strong> Payment reliability,
          contract performance, claims resolution, communication, operational reliability
          and commercial professionalism — weighted by reviewer relationship.
        </div>
        <div className="card p-4">
          <strong className="text-navy-900">Risk indicators.</strong> Reported payment
          concerns, verified dispute signals and public legal references. Published only
          after admin review.
        </div>
        <div className="card p-4">
          <strong className="text-navy-900">Reputation confidence.</strong> Grows with the
          volume of verified reviews — a low score from one review is treated differently
          from a pattern across many.
        </div>
      </div>

      {rows && rows.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-navy-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Overall</th>
                <th className="px-4 py-3">Verified reviews</th>
                <th className="px-4 py-3">Reputation confidence</th>
                <th className="px-4 py-3">Trust status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company_id} className="border-b border-slate-100 last:border-0 hover:bg-navy-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${r.slug}`} className="font-semibold text-navy-800 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><Stars score={r.overall_score} /></td>
                  <td className="px-4 py-3 text-slate-600">{r.review_count ?? 0}</td>
                  <td className="px-4 py-3 text-slate-600">{r.reputation_confidence}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        r.risk_label === "No Verified Concerns"
                          ? "bg-emerald-50 text-emerald-700"
                          : r.risk_label === "Under Review"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {r.risk_label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>The index populates as verified reviews are published.</EmptyState>
      )}
    </div>
  );
}
