import Link from "next/link";

export const metadata = { title: "Application received" };

export default function VerificationPendingPage() {
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <div className="card p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-2xl">
          ⚓
        </div>
        <h1 className="mt-4 text-2xl font-bold text-navy-900">Application received</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Thank you for applying to join Marine IQ. Confirm your email if prompted, then
          our admins will verify your identity — corporate email domain, LinkedIn profile
          and any documents you uploaded. You will be able to browse immediately and
          contribute once you are approved as a Verified Maritime Professional.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">Check status</Link>
          <Link href="/companies" className="btn-secondary">Browse the directory</Link>
        </div>
      </div>
    </div>
  );
}
