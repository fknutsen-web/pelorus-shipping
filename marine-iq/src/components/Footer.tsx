import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-navy-800 bg-navy-950 py-10 text-sm text-navy-100">
      <div className="container-page grid gap-8 md:grid-cols-4">
        <div>
          <div className="text-lg font-bold text-white">
            Marine<span className="text-brass-400">IQ</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-navy-100/80">
            A verified maritime-only trust, intelligence and reputation network.
            All contributions come from verified maritime professionals — anonymous
            reviews are not permitted.
          </p>
        </div>
        <div>
          <div className="mb-2 font-semibold text-white">Intelligence</div>
          <ul className="space-y-1.5">
            <li><Link href="/companies" className="hover:text-white">Company Directory</Link></li>
            <li><Link href="/software" className="hover:text-white">Software Reviews</Link></li>
            <li><Link href="/conferences" className="hover:text-white">Conference ROI Ratings</Link></li>
            <li><Link href="/trust-index" className="hover:text-white">Commercial Trust Index</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 font-semibold text-white">Community</div>
          <ul className="space-y-1.5">
            <li><Link href="/professionals" className="hover:text-white">Professional Directory</Link></li>
            <li><Link href="/feed" className="hover:text-white">Maritime Feed</Link></li>
            <li><Link href="/register" className="hover:text-white">Join as a Verified Professional</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 font-semibold text-white">Companies</div>
          <ul className="space-y-1.5">
            <li><Link href="/companies" className="hover:text-white">Claim Your Company Profile</Link></li>
            <li><Link href="/register" className="hover:text-white">Company Representatives</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-page mt-8 border-t border-navy-800 pt-4 text-xs text-navy-100/60">
        © {new Date().getFullYear()} Marine IQ. Reviews reflect the opinions of individual
        verified professionals, moderated for accuracy and fairness.
      </div>
    </footer>
  );
}
