import { createClient } from "@/lib/supabase/server";
import { decideUser } from "@/app/actions/admin";
import { FlashMessages, VerificationBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "User Approvals" };

const METHODS = [
  { value: "corporate_email_domain", label: "Corporate email domain" },
  { value: "linkedin_review", label: "LinkedIn reviewed" },
  { value: "business_card", label: "Business card" },
  { value: "conference_badge", label: "Conference badge" },
  { value: "manual_admin", label: "Manual approval" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; show?: string }>;
}) {
  const { error, notice, show } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("users").select("*").order("created_at", { ascending: false }).limit(100);
  if (show !== "all") query = query.eq("status", "pending");
  const { data: users } = await query;

  const userIds = (users ?? []).map((u) => u.id);
  const { data: docs } = userIds.length
    ? await supabase
        .from("verification_documents")
        .select("id, user_id, doc_type, status")
        .in("user_id", userIds)
    : { data: [] };

  return (
    <div>
      <FlashMessages error={error} notice={notice} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy-900">
          {show === "all" ? "All users" : "Users awaiting approval"}
        </h1>
        <a href={show === "all" ? "/admin/users" : "/admin/users?show=all"} className="text-sm text-navy-700 hover:underline">
          {show === "all" ? "Show pending only" : "Show all users"}
        </a>
      </div>

      <div className="space-y-4">
        {(users ?? []).map((u) => {
          const userDocs = (docs ?? []).filter((d) => d.user_id === u.id);
          return (
            <div key={u.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="text-sm">
                  <div className="font-semibold text-navy-900">{u.full_name}</div>
                  <div className="text-slate-600">
                    {u.job_title}, {u.company_name} · {u.country}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {u.email} ·{" "}
                    <a href={u.linkedin_url} className="text-navy-700 hover:underline" rel="nofollow noopener" target="_blank">
                      LinkedIn profile
                    </a>{" "}
                    · applied {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <VerificationBadge status={u.status} />
                    {userDocs.map((d) => (
                      <a
                        key={d.id}
                        href={`/admin/docs/${d.id}`}
                        target="_blank"
                        className="badge bg-navy-50 text-navy-800 hover:bg-navy-100"
                      >
                        View {d.doc_type.replace("_", " ")} ({d.status})
                      </a>
                    ))}
                  </div>
                </div>

                <form action={decideUser} className="w-full max-w-sm space-y-2 text-xs">
                  <input type="hidden" name="user_id" value={u.id} />
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {METHODS.map((m) => (
                      <label key={m.value} className="flex items-center gap-1 text-slate-600">
                        <input
                          type="checkbox"
                          name="methods"
                          value={m.value}
                          defaultChecked={u.verification_methods?.includes(m.value)}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select name="status" className="input !py-1.5 text-xs" defaultValue="verified_professional">
                      <option value="verified_professional">Verified Maritime Professional</option>
                      <option value="verified_company_rep">Verified Company Representative</option>
                      <option value="verified_software_vendor">Verified Software Vendor</option>
                      <option value="verified_conference_organizer">Verified Conference Organizer</option>
                      <option value="rejected">Reject</option>
                      <option value="suspended">Suspend</option>
                      <option value="pending">Back to pending</option>
                    </select>
                    <button className="btn-primary !px-3 !py-1.5 text-xs">Apply</button>
                  </div>
                </form>
              </div>
            </div>
          );
        })}
        {(!users || users.length === 0) && (
          <div className="card p-10 text-center text-sm text-slate-400">Nothing waiting. ⚓</div>
        )}
      </div>
    </div>
  );
}
