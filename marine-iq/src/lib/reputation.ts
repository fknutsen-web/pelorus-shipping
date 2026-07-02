import { REPUTATION_TIERS } from "@/lib/constants";

export interface ReputationInputs {
  verificationMethods: number; // count of distinct verification methods passed
  yearsExperience: number;
  helpfulVotes: number;
  acceptedCorrections: number;
  publishedReviews: number;
  peerEndorsements: number;
  moderationViolations: number;
  activeMonths: number; // months with at least one contribution
}

/**
 * Reputation is a credibility signal, not a popularity contest: verification
 * strength and review quality dominate; raw vote counts are dampened (sqrt)
 * and violations subtract heavily.
 */
export function computeReputation(i: ReputationInputs): { score: number; tier: string } {
  const score = Math.max(
    0,
    Math.round(
      i.verificationMethods * 40 +
        Math.min(i.yearsExperience, 30) * 5 +
        Math.sqrt(i.helpfulVotes) * 10 +
        i.acceptedCorrections * 15 +
        i.publishedReviews * 20 +
        Math.min(i.peerEndorsements, 20) * 8 +
        Math.min(i.activeMonths, 24) * 3 -
        i.moderationViolations * 60
    )
  );

  const tier = REPUTATION_TIERS.find((t) => score >= t.min)?.label ?? "Verified Professional";
  return { score, tier };
}
