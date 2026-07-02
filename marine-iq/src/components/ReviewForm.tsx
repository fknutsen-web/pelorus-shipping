import { submitReview } from "@/app/actions/reviews";
import { RELATIONSHIP_OPTIONS, SCORE_CATEGORIES } from "@/lib/constants";

function RatingSelect({ name, required = false }: { name: string; required?: boolean }) {
  return (
    <select name={name} className="input !w-auto" defaultValue="" required={required}>
      <option value="" disabled={required}>
        {required ? "Select…" : "N/A"}
      </option>
      {[5, 4, 3, 2, 1].map((n) => (
        <option key={n} value={n}>
          {n} — {["", "Poor", "Below average", "Average", "Good", "Excellent"][n]}
        </option>
      ))}
    </select>
  );
}

/**
 * Shared review form for companies, software and conferences. Server-side
 * triggers re-enforce every rule shown here (verification, conflicts, weights).
 */
export function ReviewForm({
  entityType,
  entityId,
  entityName,
  returnPath,
}: {
  entityType: "company" | "software" | "conference";
  entityId: string;
  entityName: string;
  returnPath: string;
}) {
  const categories = SCORE_CATEGORIES[entityType];
  const relationships = RELATIONSHIP_OPTIONS.filter((r) => {
    if (entityType === "software") return !["conference_attendee"].includes(r.value);
    if (entityType === "conference")
      return ["conference_attendee", "vendor", "partner", "other"].includes(r.value);
    return !["software_user", "conference_attendee"].includes(r.value);
  });

  return (
    <form action={submitReview} className="card space-y-6 p-6">
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <input type="hidden" name="return_path" value={returnPath} />

      <div>
        <h2 className="text-lg font-bold text-navy-900">Review {entityName}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Published under your verified professional identity. Reviews are screened
          before publication and cannot target your own company. Ratings are weighted
          by your relationship to the {entityType}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Your relationship *</label>
          <select name="relationship" className="input" required defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {relationships.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Overall rating *</label>
          <RatingSelect name="overall_rating" required />
        </div>
      </div>

      {entityType === "conference" && (
        <fieldset className="grid gap-4 rounded-md border border-slate-200 p-4 sm:grid-cols-2">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            About your attendance
          </legend>
          <div>
            <label className="label">Year attended *</label>
            <input name="attended_year" type="number" min={1990} max={2100} className="input" required />
          </div>
          <div>
            <label className="label">Your role at the event</label>
            <input name="role_at_event" className="input" placeholder="e.g. Delegate, Speaker, Exhibitor" />
          </div>
          <div>
            <label className="label">Why did you attend?</label>
            <input name="why_attended" className="input" />
          </div>
          <div>
            <label className="label">Did you generate meaningful contacts?</label>
            <input name="generated_contacts" className="input" placeholder="e.g. Yes — 5 solid leads" />
          </div>
          <div>
            <label className="label">Did you generate business?</label>
            <input name="generated_business" className="input" />
          </div>
          <div>
            <label className="label">Were decision makers present?</label>
            <input name="decision_makers_present" className="input" />
          </div>
          <div>
            <label className="label">Who should attend?</label>
            <input name="who_should_attend" className="input" />
          </div>
          <div>
            <label className="label">Who should skip it?</label>
            <input name="who_should_skip" className="input" />
          </div>
          <div>
            <label className="label">Would you attend again?</label>
            <select name="would_attend_again" className="input" defaultValue="">
              <option value="">Prefer not to say</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </fieldset>
      )}

      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Structured scores (optional but valuable)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700">{c.label}</span>
              <RatingSelect name={`score_${c.key}`} />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label">Title *</label>
        <input name="title" className="input" required minLength={5} maxLength={120} placeholder="Sum up your experience in one line" />
      </div>
      <div>
        <label className="label">Your experience *</label>
        <textarea
          name="body"
          className="input min-h-36"
          required
          minLength={40}
          maxLength={6000}
          placeholder="Stick to first-hand facts. Avoid accusations you cannot support — use the Trust Index to report structured concerns instead."
        />
      </div>

      <button className="btn-primary">Submit review</button>
    </form>
  );
}
