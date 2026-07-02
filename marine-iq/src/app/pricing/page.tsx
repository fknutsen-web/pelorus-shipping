import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { startSubscriptionCheckout, orderMarketplaceService } from "@/app/actions/commerce";
import { FlashMessages, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans & Marketplace" };

const COMPANY_TIERS = [
  {
    tier: "free", name: "Free", price: "$0",
    features: ["Basic company profile", "Respond to reviews", "Company description", "Website link"],
  },
  {
    tier: "professional", name: "Professional", price: "$199/mo",
    features: ["Enhanced profile", "Photos & videos", "News posts", "Analytics", "Lead notifications", "Review insights"],
  },
  {
    tier: "enterprise", name: "Enterprise", price: "$699/mo",
    features: ["Multiple representatives", "Benchmark reports", "AI sentiment analysis", "Competitor comparisons", "API access", "Unlimited media", "Featured placement"],
  },
];

const VENDOR_FEATURES = [
  "Enhanced product pages", "Demo request forms", "Product videos", "Customer case studies",
  "Release announcements", "Feature comparison tables", "Lead generation", "Sponsored placement",
];
const CONFERENCE_FEATURES = [
  "Featured event listing", "Registration links", "Agenda pages", "Speaker profiles",
  "Exhibitor directory", "Sponsored newsletters", "Event countdown", "Live updates",
];
const PREMIUM_FEATURES = [
  "Advanced search", "Unlimited saved companies", "Market intelligence dashboards",
  "Conference discounts", "Industry benchmarking", "AI research assistant",
  "Early access to reports", "Custom alerts", "Personalized news feed",
];

const SERVICES = [
  ["sponsored_webinar", "Sponsored webinar", "$2,500"],
  ["sponsored_report", "Sponsored report", "$3,500"],
  ["sponsored_podcast", "Sponsored podcast episode", "$1,500"],
  ["industry_survey", "Industry survey", "$4,000"],
  ["whitepaper_promotion", "White paper promotion", "$1,200"],
  ["product_launch", "Product launch package", "$3,000"],
  ["event_promotion", "Event promotion package", "$2,000"],
] as const;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const session = await getSession();

  // Companies the viewer represents (for marketplace orders).
  const supabase = await createClient();
  const { data: repOf } = session.userId
    ? await supabase
        .from("company_representatives")
        .select("company_id, companies:company_id(name)")
        .eq("user_id", session.userId)
    : { data: [] };

  return (
    <div className="container-page py-10">
      <FlashMessages error={error} notice={notice} />
      <PageTitle
        title="Plans & Marketplace"
        subtitle="Paid plans buy visibility and functionality — never preferential treatment. Rankings, ratings, reviews and trust scores are not for sale, and sponsored content is always labeled."
      />

      <section>
        <h2 className="mb-4 text-lg font-bold text-navy-900">Company subscriptions</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {COMPANY_TIERS.map((t) => (
            <div key={t.tier} className={`card flex flex-col p-6 ${t.tier === "professional" ? "border-navy-600 ring-1 ring-navy-600" : ""}`}>
              <div className="text-sm font-bold uppercase tracking-wide text-slate-500">{t.name}</div>
              <div className="mt-1 text-3xl font-bold text-navy-900">{t.price}</div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
                {t.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {t.tier === "free" ? (
                <Link href="/companies" className="btn-secondary mt-5 w-full">Claim your profile</Link>
              ) : (
                <form action={startSubscriptionCheckout} className="mt-5">
                  <input type="hidden" name="tier" value={t.tier} />
                  <button className="btn-primary w-full">Subscribe</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-3">
        <div className="card p-6">
          <h3 className="font-bold text-navy-900">Software vendor plans</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            {VENDOR_FEATURES.map((f) => <li key={f}>✓ {f}</li>)}
          </ul>
          <Link href="/advertise" className="btn-secondary mt-4 w-full">Build a vendor campaign</Link>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-navy-900">Conference packages</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            {CONFERENCE_FEATURES.map((f) => <li key={f}>✓ {f}</li>)}
          </ul>
          <Link href="/advertise" className="btn-secondary mt-4 w-full">Promote your event</Link>
        </div>
        <div className="card border-brass-500/40 p-6">
          <h3 className="font-bold text-navy-900">Premium membership <span className="text-sm font-normal text-slate-400">— $29/mo</span></h3>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            {PREMIUM_FEATURES.map((f) => <li key={f}>✓ {f}</li>)}
          </ul>
          <form action={startSubscriptionCheckout} className="mt-4">
            <input type="hidden" name="tier" value="premium_member" />
            <button className="btn-primary w-full">Go premium</button>
          </form>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-1 text-lg font-bold text-navy-900">Marketplace</h2>
        <p className="mb-4 text-sm text-slate-500">
          Self-service sponsored services for company representatives. Everything is
          labeled sponsored content — separated from editorial and community content.
        </p>
        {repOf && repOf.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(([value, label, price]) => (
              <form key={value} action={orderMarketplaceService} className="card space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-navy-900">{label}</span>
                  <span className="text-sm font-bold text-brass-500">{price}</span>
                </div>
                <input type="hidden" name="service" value={value} />
                <select name="company_id" className="input !py-1.5 text-xs" required>
                  {repOf.map((r) => (
                    <option key={r.company_id} value={r.company_id}>
                      {(r.companies as unknown as { name: string } | null)?.name ?? "My company"}
                    </option>
                  ))}
                </select>
                <input name="details" className="input !py-1.5 text-xs" placeholder="Topic / notes (optional)" />
                <button className="btn-secondary w-full !py-1.5 text-xs">Order</button>
              </form>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-sm text-slate-500">
            Marketplace orders are placed by approved company representatives.{" "}
            <Link href="/companies" className="font-semibold text-navy-700 hover:underline">
              Claim your company profile
            </Link>{" "}
            to unlock sponsored webinars, reports, surveys and launch packages.
          </div>
        )}
      </section>
    </div>
  );
}
