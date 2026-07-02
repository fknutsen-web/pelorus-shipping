import Link from "next/link";
import { STATUS_LABELS } from "@/lib/constants";

/** Star row for a 0–5 score. */
export function Stars({ score, size = "text-sm" }: { score: number | null; size?: string }) {
  if (score == null) return <span className="text-xs text-slate-400">No ratings yet</span>;
  const full = Math.round(score);
  return (
    <span className={`${size} tracking-tight`} aria-label={`${score} out of 5`}>
      <span className="text-brass-500">{"★".repeat(full)}</span>
      <span className="text-slate-300">{"★".repeat(5 - full)}</span>
      <span className="ml-1.5 font-semibold text-slate-700">{Number(score).toFixed(1)}</span>
    </span>
  );
}

/** Horizontal score bar for a structured category. */
export function ScoreBar({ label, score, count }: { label: string; score: number; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-48 shrink-0 text-xs font-medium text-slate-600">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-navy-700"
          style={{ width: `${(score / 5) * 100}%` }}
        />
      </div>
      <div className="w-14 shrink-0 text-right text-xs font-semibold text-slate-700">
        {Number(score).toFixed(1)}
        {count != null && <span className="ml-1 font-normal text-slate-400">({count})</span>}
      </div>
    </div>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  const verified = status.startsWith("verified");
  return (
    <span
      className={`badge ${verified ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-600"}`}
    >
      {verified && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path
            fillRule="evenodd"
            d="M16.4 3.9a.75.75 0 01.2 1L9.6 15.4a.75.75 0 01-1.2.05L4.4 10.9a.75.75 0 111.15-.96l3.35 4 6.45-9.85a.75.75 0 011.05-.2z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function RepBadge() {
  return (
    <span className="badge bg-navy-100 text-navy-800 ring-1 ring-navy-600/20">
      Company Representative
    </span>
  );
}

/** Renders ?error= / ?notice= messages passed back by server actions. */
export function FlashMessages({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <div className="mb-6 space-y-2">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center text-sm text-slate-500">{children}</div>
  );
}

export function EntityCard({
  href,
  name,
  meta,
  description,
  score,
  reviewCount,
  tag,
}: {
  href: string;
  name: string;
  meta?: string;
  description?: string | null;
  score?: number | null;
  reviewCount?: number;
  tag?: string;
}) {
  return (
    <Link href={href} className="card block p-5 transition hover:border-navy-600 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-navy-900">{name}</div>
          {meta && <div className="mt-0.5 text-xs text-slate-500">{meta}</div>}
        </div>
        {tag && <span className="badge bg-navy-50 text-navy-800">{tag}</span>}
      </div>
      {description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{description}</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <Stars score={score ?? null} />
        {reviewCount != null && reviewCount > 0 && (
          <span className="text-xs text-slate-400">
            {reviewCount} verified review{reviewCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </Link>
  );
}
