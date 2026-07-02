import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { createPost, addComment, toggleHelpful } from "@/app/actions/community";
import { POST_TYPES } from "@/lib/constants";
import { EmptyState, FlashMessages, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Maritime Feed" };

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const session = await getSession();
  if (!session.userId) redirect("/login?next=/feed");

  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(30);

  const postIds = (posts ?? []).map((p) => p.id);
  const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];

  const [{ data: authors }, { data: votes }, { data: comments }] = await Promise.all([
    authorIds.length
      ? supabase
          .from("professional_profiles")
          .select("user_id, display_name, title, company_name")
          .in("user_id", authorIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string; title: string; company_name: string }[] }),
    postIds.length
      ? supabase.from("votes").select("target_id").eq("target_type", "post").in("target_id", postIds)
      : Promise.resolve({ data: [] as { target_id: string }[] }),
    postIds.length
      ? supabase
          .from("comments")
          .select("id, post_id, body, is_company_rep, created_at, author_id")
          .in("post_id", postIds)
          .eq("status", "published")
          .order("created_at")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const authorMap = new Map((authors ?? []).map((a) => [a.user_id, a]));
  const typeLabel = new Map(POST_TYPES.map((t) => [t.value, t.label]));

  return (
    <div className="container-page max-w-3xl py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Maritime Feed"
        subtitle="Moderated industry discussion for verified maritime professionals only."
      />

      {session.isVerified ? (
        <form action={createPost} className="card mb-8 space-y-3 p-5">
          <div className="flex gap-2">
            <select name="post_type" className="input !w-auto">
              {POST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input name="title" className="input flex-1" placeholder="Title (optional)" maxLength={140} />
          </div>
          <textarea
            name="body"
            className="input min-h-24"
            placeholder="Share a question, market observation or discussion point…"
            required
          />
          <div className="flex items-center gap-2">
            <input name="tags" className="input flex-1" placeholder="Tags, comma-separated (e.g. dry-bulk, laytime)" />
            <button className="btn-primary">Post</button>
          </div>
        </form>
      ) : (
        <div className="card mb-8 p-5 text-sm text-slate-500">
          Posting unlocks once your account is verified.
        </div>
      )}

      {posts && posts.length > 0 ? (
        <div className="space-y-5">
          {posts.map((p) => {
            const author = authorMap.get(p.author_id);
            const postComments = (comments ?? []).filter((c) => c.post_id === p.id);
            const helpfulCount = (votes ?? []).filter((v) => v.target_id === p.id).length;
            return (
              <article key={p.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="badge bg-navy-50 text-navy-800">{typeLabel.get(p.post_type) ?? p.post_type}</span>
                  <span className="font-semibold text-navy-800">{author?.display_name ?? "Member"}</span>
                  {author && <span>· {author.title}, {author.company_name}</span>}
                  <span>· {new Date(p.created_at).toLocaleDateString("en-GB")}</span>
                </div>
                {p.title && <h3 className="mt-2 font-semibold text-navy-900">{p.title}</h3>}
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{p.body}</p>
                {p.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.tags.map((t: string) => (
                      <span key={t} className="badge bg-slate-100 text-slate-600">#{t}</span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs">
                  <form action={toggleHelpful}>
                    <input type="hidden" name="target_type" value="post" />
                    <input type="hidden" name="target_id" value={p.id} />
                    <input type="hidden" name="return_path" value="/feed" />
                    <button className="font-medium text-navy-700 hover:underline">
                      Helpful{helpfulCount ? ` (${helpfulCount})` : ""}
                    </button>
                  </form>
                  <span className="text-slate-400">{postComments.length} comment{postComments.length === 1 ? "" : "s"}</span>
                </div>

                {postComments.map((c) => (
                  <div key={c.id} className="mt-2 rounded-md bg-slate-50 p-3 text-sm">
                    <div className="mb-0.5 text-xs text-slate-500">
                      <span className="font-medium text-navy-800">
                        {authorMap.get(c.author_id)?.display_name ?? "Member"}
                      </span>
                      {c.is_company_rep && <span className="ml-1.5 badge bg-navy-100 text-navy-800">Company Representative</span>}
                    </div>
                    <p className="text-slate-700">{c.body}</p>
                  </div>
                ))}

                {session.isVerified && (
                  <form action={addComment} className="mt-3 flex gap-2">
                    <input type="hidden" name="parent_field" value="post_id" />
                    <input type="hidden" name="parent_id" value={p.id} />
                    <input type="hidden" name="return_path" value="/feed" />
                    <input name="body" className="input flex-1 !py-1.5 text-sm" placeholder="Reply…" required />
                    <button className="btn-secondary !px-3 !py-1.5 text-xs">Reply</button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState>No posts yet — start the first discussion.</EmptyState>
      )}
    </div>
  );
}
