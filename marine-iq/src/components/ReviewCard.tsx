import Link from "next/link";
import { flagContent } from "@/app/actions/reviews";
import { toggleHelpful } from "@/app/actions/community";
import { postOfficialResponse } from "@/app/actions/engagement";
import { RELATIONSHIP_OPTIONS } from "@/lib/constants";
import { Stars, RepBadge } from "@/components/ui";
import type { ReviewRow } from "@/lib/types";

export interface ReviewWithAuthor extends ReviewRow {
  author?: { display_name: string; company_name: string; title: string } | null;
  helpful_count?: number;
  scores?: { category: string; score: number }[];
  responses?: {
    id: string;
    body: string;
    is_company_rep: boolean;
    is_official_response?: boolean;
    created_at: string;
    author?: { display_name: string } | null;
  }[];
}

const CONF_ANSWER_LABELS: Record<string, string> = {
  role_at_event: "Role at the event",
  why_attended: "Why they attended",
  generated_contacts: "Meaningful contacts generated",
  generated_business: "Business generated",
  decision_makers_present: "Decision makers present",
  who_should_attend: "Who should attend",
  who_should_skip: "Who should skip it",
};

export function ReviewCard({
  review,
  returnPath,
  canInteract,
  categoryLabels,
  canOfficiallyRespond = false,
}: {
  review: ReviewWithAuthor;
  returnPath: string;
  canInteract: boolean;
  categoryLabels: Record<string, string>;
  /** True when the viewer is an approved rep of the reviewed company. */
  canOfficiallyRespond?: boolean;
}) {
  const relLabel =
    RELATIONSHIP_OPTIONS.find((r) => r.value === review.relationship)?.label ??
    review.relationship;

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-navy-900">{review.title}</h3>
          <div className="mt-1 text-xs text-slate-500">
            {review.author ? (
              <Link href={`/professionals/${review.author_id}`} className="font-medium text-navy-700 hover:underline">
                {review.author.display_name}
              </Link>
            ) : (
              <span>Verified member</span>
            )}
            {review.author && <> · {review.author.title}, {review.author.company_name}</>}
            {" · "}
            <span className="badge bg-slate-100 text-slate-600">{relLabel}</span>
            {review.attended_year && <> · Attended {review.attended_year}</>}
            {" · "}
            {new Date(review.created_at).toLocaleDateString("en-GB", { year: "numeric", month: "short" })}
          </div>
        </div>
        <Stars score={review.overall_rating} />
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{review.body}</p>

      {review.scores && review.scores.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.scores.map((s) => (
            <span key={s.category} className="badge bg-navy-50 text-navy-800">
              {categoryLabels[s.category] ?? s.category}: {s.score}/5
            </span>
          ))}
        </div>
      )}

      {review.entity_type === "conference" && Object.keys(review.answers ?? {}).length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          {Object.entries(review.answers).map(([k, v]) =>
            CONF_ANSWER_LABELS[k] ? (
              <div key={k}>
                <dt className="font-semibold text-slate-500">{CONF_ANSWER_LABELS[k]}</dt>
                <dd className="text-slate-700">{String(v)}</dd>
              </div>
            ) : null
          )}
          {review.would_attend_again != null && (
            <div>
              <dt className="font-semibold text-slate-500">Would attend again</dt>
              <dd className="text-slate-700">{review.would_attend_again ? "Yes" : "No"}</dd>
            </div>
          )}
        </dl>
      )}

      {review.responses?.map((resp) => (
        <div
          key={resp.id}
          className={`mt-3 rounded-md border-l-4 p-3 text-sm ${
            resp.is_official_response
              ? "border-brass-500 bg-brass-500/5"
              : "border-navy-600 bg-navy-50"
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
            {resp.is_official_response ? (
              <span className="badge bg-brass-500/15 text-brass-500">Official Company Response</span>
            ) : (
              resp.is_company_rep && <RepBadge />
            )}
            <span className="font-medium text-navy-800">{resp.author?.display_name ?? "Member"}</span>
            <span>{new Date(resp.created_at).toLocaleDateString("en-GB")}</span>
          </div>
          <p className="whitespace-pre-line text-slate-700">{resp.body}</p>
        </div>
      ))}

      {canOfficiallyRespond && !review.responses?.some((r) => r.is_official_response) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-brass-500">
            Post official company response
          </summary>
          <form action={postOfficialResponse} className="mt-2 space-y-2">
            <input type="hidden" name="review_id" value={review.id} />
            <input type="hidden" name="return_path" value={returnPath} />
            <textarea
              name="body"
              className="input min-h-20 text-sm"
              required
              placeholder="One official public response per review. Post follow-up clarifications as regular comments."
            />
            <button className="btn-primary !py-1.5 text-xs">Publish official response</button>
          </form>
        </details>
      )}

      {canInteract && (
        <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs">
          <form action={toggleHelpful}>
            <input type="hidden" name="target_type" value="review" />
            <input type="hidden" name="target_id" value={review.id} />
            <input type="hidden" name="return_path" value={returnPath} />
            <button className="font-medium text-navy-700 hover:underline">
              Helpful{review.helpful_count ? ` (${review.helpful_count})` : ""}
            </button>
          </form>
          <details>
            <summary className="cursor-pointer text-slate-400 hover:text-slate-600">Report</summary>
            <form action={flagContent} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="target_type" value="review" />
              <input type="hidden" name="target_id" value={review.id} />
              <input type="hidden" name="return_path" value={returnPath} />
              <select name="reason" className="input !w-auto !py-1 text-xs">
                <option value="conflict_of_interest">Conflict of interest</option>
                <option value="personal_attack">Personal attack</option>
                <option value="defamation_risk">Defamation risk</option>
                <option value="commercial_spam">Commercial spam</option>
                <option value="duplicate_review">Duplicate review</option>
                <option value="unsupported_accusation">Unsupported accusation</option>
                <option value="other">Other</option>
              </select>
              <input name="details" placeholder="Details (optional)" className="input !w-56 !py-1 text-xs" />
              <button className="btn-secondary !px-2 !py-1 text-xs">Send</button>
            </form>
          </details>
        </div>
      )}
    </article>
  );
}
