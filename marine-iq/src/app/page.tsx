import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function searchAll(formData: FormData) {
  "use server";
  const q = String(formData.get("q") ?? "").trim();
  const scope = String(formData.get("scope") ?? "companies");
  redirect(`/${scope}?q=${encodeURIComponent(q)}`);
}

const PILLARS = [
  {
    href: "/companies",
    title: "Company Directory & Reviews",
    text: "Structured ratings on payment reliability, communication, operational reliability, contract performance, claims handling and commercial professionalism — from verified counterparties only.",
  },
  {
    href: "/software",
    title: "Maritime Software Reviews",
    text: "Real implementations reviewed by the people who use them: ease of use, support, integrations, AI features, ROI and hidden costs.",
  },
  {
    href: "/conferences",
    title: "Conference ROI Ratings",
    text: "Was it worth the total cost? Networking value, decision-maker attendance, deal generation and would-attend-again rates from actual delegates.",
  },
  {
    href: "/trust-index",
    title: "Commercial Trust Index",
    text: "A structured risk and trust system — verified dispute signals, reported payment concerns and community confidence. Admin-reviewed before publication, never a blacklist.",
  },
  {
    href: "/professionals",
    title: "Professional Reputation Profiles",
    text: "Verification badges, contribution history, peer endorsements and reputation labels from Verified Professional to Community Leader.",
  },
  {
    href: "/feed",
    title: "Maritime Feed",
    text: "Moderated industry discussion — questions, market observations and company, software and conference threads. Maritime-only, verified-only.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const [{ count: companies }, { count: reviews }, { count: professionals }] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("professional_profiles").select("user_id", { count: "exact", head: true }).eq("is_public", true),
  ]);

  return (
    <>
      <section className="bg-navy-900 py-20 text-white">
        <div className="container-page">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-brass-400">
            The maritime trust, intelligence &amp; reputation network
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Trusted reviews from verified maritime professionals. No anonymity. No noise.
          </h1>
          <p className="mt-4 max-w-2xl text-navy-100">
            Research companies, software and conferences before you commit — rated by
            verified charterers, owners, operators, brokers, agents and service
            providers. Every contributor is identity-verified. Every review is moderated.
          </p>

          <form action={searchAll} className="mt-8 flex max-w-2xl gap-2">
            <select name="scope" className="rounded-md border-0 bg-navy-800 px-3 py-3 text-sm text-white">
              <option value="companies">Companies</option>
              <option value="software">Software</option>
              <option value="conferences">Conferences</option>
              <option value="professionals">Professionals</option>
            </select>
            <input
              name="q"
              placeholder="Search maritime companies, software, conferences and professionals…"
              className="flex-1 rounded-md border-0 px-4 py-3 text-sm text-slate-900"
            />
            <button className="rounded-md bg-brass-500 px-6 py-3 text-sm font-bold text-navy-950 hover:bg-brass-400">
              Search
            </button>
          </form>

          <div className="mt-10 flex flex-wrap gap-10 text-sm">
            {[
              [companies ?? 0, "companies in the directory"],
              [reviews ?? 0, "verified reviews published"],
              [professionals ?? 0, "verified professionals"],
            ].map(([n, label]) => (
              <div key={String(label)}>
                <div className="text-3xl font-bold text-brass-400">{String(n)}</div>
                <div className="text-navy-100">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="text-xl font-bold text-navy-900">Built for maritime decisions</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <Link key={p.href} href={p.href} className="card p-6 transition hover:border-navy-600 hover:shadow-md">
              <h3 className="font-semibold text-navy-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16">
        <div className="container-page grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-navy-900">Join as a Verified Maritime Professional</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Register with your corporate email, LinkedIn profile and role. Our admins
              verify every account — by corporate email domain, LinkedIn review, business
              card or conference badge — before you can contribute. Anonymous public
              reviews are not allowed, and conflict-of-interest rules are enforced
              server-side: you can never rate your own company, your own software, or
              your own conference.
            </p>
            <Link href="/register" className="btn-primary mt-5">
              Apply for verification
            </Link>
          </div>
          <div>
            <h2 className="text-xl font-bold text-navy-900">Claim Your Company Profile</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Company representatives can claim their profile with a corporate email,
              respond to reviews as a labeled Company Representative, and keep factual
              information current. Claimed companies can never delete reviews, edit
              ratings or hide negative feedback.
            </p>
            <Link href="/companies" className="btn-secondary mt-5">
              Find your company
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
