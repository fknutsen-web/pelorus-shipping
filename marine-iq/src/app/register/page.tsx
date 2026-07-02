import { register } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { getSectors } from "@/lib/data";
import { COUNTRIES } from "@/lib/constants";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join as a Verified Maritime Professional" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const sectors = await getSectors(supabase);

  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-2xl font-bold text-navy-900">Apply for verification</h1>
      <p className="mt-2 text-sm text-slate-500">
        Marine IQ is verified-only. Register with your professional identity — an admin
        reviews every application before you can contribute. Your email, uploads and
        verification notes are never shown publicly.
      </p>

      <div className="mt-8">
        <FlashMessages error={error} />
        <form action={register} className="card space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name *</label>
              <input name="full_name" className="input" required />
            </div>
            <div>
              <label className="label">Company *</label>
              <input name="company_name" className="input" required />
            </div>
            <div>
              <label className="label">Job title *</label>
              <input name="job_title" className="input" required />
            </div>
            <div>
              <label className="label">Corporate email *</label>
              <input name="email" type="email" className="input" required placeholder="you@yourcompany.com" />
            </div>
            <div>
              <label className="label">Password *</label>
              <input name="password" type="password" className="input" required minLength={10} />
            </div>
            <div>
              <label className="label">LinkedIn profile *</label>
              <input name="linkedin_url" type="url" className="input" required placeholder="https://linkedin.com/in/…" />
            </div>
            <div>
              <label className="label">Country *</label>
              <select name="country" className="input" required defaultValue="">
                <option value="" disabled>Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Maritime sector *</label>
              <select name="sector_id" className="input" required defaultValue="">
                <option value="" disabled>Select…</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Business card (optional)</label>
              <input name="business_card" type="file" accept="image/*,.pdf" className="input" />
            </div>
            <div>
              <label className="label">Conference badge (optional)</label>
              <input name="conference_badge" type="file" accept="image/*,.pdf" className="input" />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Verification methods: corporate email domain match, LinkedIn review, business
            card or conference badge upload, and manual admin approval. Uploads are stored
            privately and visible only to you and platform admins.
          </p>
          <button className="btn-primary w-full">Submit application</button>
        </form>
      </div>
    </div>
  );
}
