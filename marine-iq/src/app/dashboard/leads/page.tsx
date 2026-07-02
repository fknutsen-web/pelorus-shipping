import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { updateLeadStatus } from "@/app/actions/engagement";
import { FlashMessages, PageTitle, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

const LEAD_LABELS: Record<string, string> = {
  request_demo: "Request Demo",
  request_quote: "Request Quote",
  contact_sales: "Contact Sales",
  become_partner: "Become Partner",
  book_meeting: "Book Meeting",
  download_brochure: "Download Brochure",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/dashboard/leads");

  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const companyIds = [...new Set((leads ?? []).map((l) => l.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] };
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="container-page max-w-4xl py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Leads"
        subtitle="Contact-form submissions from your company profile — demos, quotes, partnerships and meetings."
      />

      {leads && leads.length > 0 ? (
        <div className="space-y-3">
          {leads.map((l) => (
            <div key={l.id} className="card p-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="badge bg-navy-50 text-navy-800">{LEAD_LABELS[l.lead_type] ?? l.lead_type}</span>
                  <span className="ml-2 font-semibold text-navy-900">{l.name}</span>
                  <a href={`mailto:${l.email}`} className="ml-2 text-navy-700 hover:underline">{l.email}</a>
                  <span className="ml-2 text-xs text-slate-400">
                    {companyMap.get(l.company_id)} · {new Date(l.created_at).toLocaleString("en-GB")}
                  </span>
                </div>
                <form action={updateLeadStatus} className="flex items-center gap-2">
                  <input type="hidden" name="lead_id" value={l.id} />
                  <select name="status" defaultValue={l.status} className="input !w-auto !py-1 text-xs">
                    <option value="new">New</option>
                    <option value="viewed">Viewed</option>
                    <option value="responded">Responded</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button className="btn-secondary !px-2 !py-1 text-xs">Update</button>
                </form>
              </div>
              {l.message && <p className="mt-2 whitespace-pre-line text-slate-600">{l.message}</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>
          No leads yet. Leads arrive when visitors use the contact forms on company
          profiles you represent.
        </EmptyState>
      )}
    </div>
  );
}
