import { addComment } from "@/app/actions/community";
import { RepBadge } from "@/components/ui";

export interface CommentItem {
  id: string;
  body: string;
  is_company_rep: boolean;
  created_at: string;
  author?: { display_name: string; title: string; company_name: string } | null;
}

export function CommentSection({
  comments,
  parentField,
  parentId,
  returnPath,
  canComment,
}: {
  comments: CommentItem[];
  parentField: "review_id" | "post_id" | "company_id" | "software_id" | "conference_id";
  parentId: string;
  returnPath: string;
  canComment: boolean;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Discussion ({comments.length})
      </h3>
      {comments.map((c) => (
        <div key={c.id} className="card p-4 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-navy-800">{c.author?.display_name ?? "Member"}</span>
            {c.author && <span>· {c.author.title}, {c.author.company_name}</span>}
            {c.is_company_rep && <RepBadge />}
            <span>· {new Date(c.created_at).toLocaleDateString("en-GB")}</span>
          </div>
          <p className="whitespace-pre-line text-slate-700">{c.body}</p>
        </div>
      ))}
      {canComment ? (
        <form action={addComment} className="card space-y-3 p-4">
          <input type="hidden" name="parent_field" value={parentField} />
          <input type="hidden" name="parent_id" value={parentId} />
          <input type="hidden" name="return_path" value={returnPath} />
          <textarea
            name="body"
            className="input min-h-20"
            placeholder="Add a professional comment… (comments by company employees are automatically labeled Company Representative)"
            required
          />
          <button className="btn-secondary">Post comment</button>
        </form>
      ) : (
        <p className="text-xs text-slate-400">
          Verified members can join the discussion.
        </p>
      )}
    </section>
  );
}
