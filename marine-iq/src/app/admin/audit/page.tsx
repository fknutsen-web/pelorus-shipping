import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log" };

export default async function AdminAuditPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("users").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-navy-900">Audit log</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-navy-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                  {new Date(l.created_at).toLocaleString("en-GB")}
                </td>
                <td className="px-4 py-2 text-xs">{l.actor_id ? actorMap.get(l.actor_id) ?? l.actor_id.slice(0, 8) : "system"}</td>
                <td className="px-4 py-2 text-xs font-semibold text-navy-800">{l.action}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {l.target_type} {l.target_id?.slice(0, 8)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  <code>{JSON.stringify(l.metadata)}</code>
                </td>
              </tr>
            ))}
            {(!logs || logs.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
