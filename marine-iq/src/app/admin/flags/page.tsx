import { createClient } from "@/lib/supabase/server";
import { resolveFlag } from "@/app/actions/admin";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Flagged Content" };

export default async function AdminFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const supabase = await createClient();

  const { data: flags } = await supabase
    .from("moderation_flags")
    .select("*")
    .eq("status", "open")
    .order("created_at")
    .limit(100);

  // Pull the flagged content bodies for context.
  const byType = (t: string) => (flags ?? []).filter((f) => f.target_type === t).map((f) => f.target_id);
  const [{ data: reviews }, { data: comments }, { data: posts }] = await Promise.all([
    byType("review").length
      ? supabase.from("reviews").select("id, title, body, status, relationship").in("id", byType("review"))
      : Promise.resolve({ data: [] as { id: string; title: string; body: string; status: string; relationship: string }[] }),
    byType("comment").length
      ? supabase.from("comments").select("id, body, status").in("id", byType("comment"))
      : Promise.resolve({ data: [] as { id: string; body: string; status: string }[] }),
    byType("post").length
      ? supabase.from("posts").select("id, title, body, status").in("id", byType("post"))
      : Promise.resolve({ data: [] as { id: string; title: string | null; body: string; status: string }[] }),
  ]);

  function contentFor(f: { target_type: string; target_id: string }) {
    if (f.target_type === "review") return reviews?.find((r) => r.id === f.target_id);
    if (f.target_type === "comment") return comments?.find((c) => c.id === f.target_id);
    if (f.target_type === "post") return posts?.find((p) => p.id === f.target_id);
    return undefined;
  }

  return (
    <div>
      <FlashMessages error={error} notice={notice} />
      <h1 className="mb-4 text-lg font-bold text-navy-900">Open moderation flags</h1>

      <div className="space-y-4">
        {(flags ?? []).map((f) => {
          const content = contentFor(f) as
            | { title?: string | null; body?: string; status?: string }
            | undefined;
          return (
            <div key={f.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="badge bg-amber-100 text-amber-800">{f.reason.replace(/_/g, " ")}</span>
                <span className="badge bg-slate-100 text-slate-600">{f.target_type}</span>
                <span className="text-slate-400">
                  {f.flagged_by ? "Reported by a member" : "Automated screen"} ·{" "}
                  {new Date(f.created_at).toLocaleString("en-GB")}
                </span>
                {content?.status && (
                  <span className="badge bg-navy-50 text-navy-800">content: {content.status.replace(/_/g, " ")}</span>
                )}
              </div>
              {f.details && <p className="mt-2 text-xs text-slate-500">{f.details}</p>}
              {content && (
                <blockquote className="mt-3 rounded-md border-l-4 border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {"title" in content && content.title && (
                    <div className="font-semibold text-navy-900">{content.title}</div>
                  )}
                  <p className="whitespace-pre-line">{content.body}</p>
                </blockquote>
              )}
              <form action={resolveFlag} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="flag_id" value={f.id} />
                <input type="hidden" name="target_type" value={f.target_type} />
                <input type="hidden" name="target_id" value={f.target_id} />
                <button name="decision" value="resolved_kept" className="btn-secondary !py-1.5 text-xs">
                  Publish / keep content
                </button>
                <button name="decision" value="resolved_removed" className="rounded-md bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800">
                  Remove content
                </button>
                <button name="decision" value="dismissed" className="rounded-md px-4 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                  Dismiss flag
                </button>
              </form>
            </div>
          );
        })}
        {(!flags || flags.length === 0) && (
          <div className="card p-10 text-center text-sm text-slate-400">No open flags. ⚓</div>
        )}
      </div>
    </div>
  );
}
