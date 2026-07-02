import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { uploadVerificationDoc } from "@/app/actions/auth";
import { VerificationBadge, FlashMessages, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; uploaded?: string }>;
}) {
  const { error, notice, uploaded } = await searchParams;
  const session = await getSession();
  if (!session.userId || !session.account) redirect("/login?next=/dashboard");
  const account = session.account;

  const supabase = await createClient();
  const [{ data: docs }, { data: myReviews }, { data: myClaims }] = await Promise.all([
    supabase
      .from("verification_documents")
      .select("id, doc_type, status, created_at")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, title, entity_type, status, created_at")
      .eq("author_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("company_claims")
      .select("id, status, created_at, company_id")
      .eq("user_id", session.userId),
  ]);

  return (
    <div className="container-page max-w-4xl py-10">
      <FlashMessages
        error={error}
        notice={uploaded ? "Document uploaded — an admin will review it." : notice}
      />
      <PageTitle title={`Welcome, ${account.full_name}`} />

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-600">
              {account.job_title}, {account.company_name} · {account.country}
            </div>
            <div className="mt-2">
              <VerificationBadge status={account.status} />
            </div>
          </div>
          {session.isVerified && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/professionals/${session.userId}`} className="btn-secondary">
                View my public profile
              </Link>
              <Link href="/dashboard/leads" className="btn-secondary">
                Leads
              </Link>
            </div>
          )}
        </div>

        {account.status === "pending" && (
          <p className="mt-4 rounded-md bg-navy-50 p-4 text-sm text-slate-600">
            Your application is with our admins. Strengthen it by uploading a business
            card or conference badge below — uploads are private and visible only to you
            and platform admins.
          </p>
        )}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Verification documents
        </h2>
        <div className="card p-5">
          {docs && docs.length > 0 && (
            <ul className="mb-4 space-y-1.5 text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="text-slate-700">
                    {d.doc_type === "business_card" ? "Business card" : d.doc_type === "conference_badge" ? "Conference badge" : "Document"}
                    {" · "}
                    {new Date(d.created_at).toLocaleDateString("en-GB")}
                  </span>
                  <span
                    className={`badge ${
                      d.status === "accepted"
                        ? "bg-emerald-50 text-emerald-700"
                        : d.status === "rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form action={uploadVerificationDoc} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Document type</label>
              <select name="doc_type" className="input !w-auto">
                <option value="business_card">Business card</option>
                <option value="conference_badge">Conference badge</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="label">File (image or PDF, max 8 MB)</label>
              <input name="file" type="file" accept="image/*,.pdf" className="input" required />
            </div>
            <button className="btn-primary">Upload</button>
          </form>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          My reviews
        </h2>
        <div className="card divide-y divide-slate-100">
          {myReviews && myReviews.length > 0 ? (
            myReviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-700">
                  <span className="badge mr-2 bg-navy-50 text-navy-800">{r.entity_type}</span>
                  {r.title}
                </span>
                <span
                  className={`badge ${
                    r.status === "published"
                      ? "bg-emerald-50 text-emerald-700"
                      : r.status === "removed"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.status.replace(/_/g, " ")}
                </span>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No reviews yet.{" "}
              <Link href="/companies" className="font-semibold text-navy-700 hover:underline">
                Find a company to review
              </Link>
            </div>
          )}
        </div>
        {myClaims && myClaims.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Company claims: {myClaims.map((c) => c.status).join(", ")}
          </p>
        )}
      </section>
    </div>
  );
}
