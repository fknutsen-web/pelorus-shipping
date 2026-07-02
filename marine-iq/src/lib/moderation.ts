/**
 * Automated pre-publication screen. Every review/comment/post passes through
 * this before it is published. It is intentionally conservative: content that
 * trips a rule is held as `under_review` with moderation flags for an admin —
 * never silently deleted, never published with defamatory language.
 */

export interface ModerationResult {
  clean: boolean;
  flags: { reason: string; details: string }[];
}

// Words that create defamation exposure in public UI. Held for admin review
// so the underlying concern can be recorded as a structured trust signal.
const DEFAMATION_TERMS = [
  "scam", "scammer", "fraud", "fraudster", "crook", "crooks", "swindler",
  "swindle", "thief", "thieves", "criminal", "blacklist", "black list",
  "mafia", "con artist", "conman", "con-man", "ponzi", "money launder",
];

const PROFANITY_TERMS = [
  "fuck", "shit", "bitch", "bastard", "asshole", "cunt", "dickhead",
  "motherfucker", "bullshit", "wanker",
];

const THREAT_TERMS = [
  "i will destroy", "you will regret", "i will ruin", "watch your back",
  "we will find you", "i will make sure you never",
];

const PERSONAL_ATTACK_PATTERNS = [
  /\b(he|she|they)\s+(is|are)\s+(an?\s+)?(idiot|moron|liar|incompetent fool)/i,
  /\bnever trust (him|her|them|this man|this woman)\b/i,
];

const SPAM_PATTERNS = [
  /\b(buy now|limited offer|discount code|dm me for|whatsapp me|telegram me)\b/i,
  /(https?:\/\/\S+){3,}/i,
];

const SELF_PROMOTION_PATTERNS = [
  /\b(check out (our|my)|we offer|contact (us|me) (for|at)|our (product|platform|services?) (is|are|can))\b/i,
];

function containsTerm(text: string, terms: string[]): string | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const term of terms) {
    const re = new RegExp(`[^a-z]${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    if (re.test(lower)) return term;
  }
  return null;
}

export function screenContent(text: string): ModerationResult {
  const flags: ModerationResult["flags"] = [];

  const defam = containsTerm(text, DEFAMATION_TERMS);
  if (defam) {
    flags.push({
      reason: "defamation_risk",
      details: `Contains high-risk term "${defam}". Consider converting the underlying concern into a structured trust signal.`,
    });
  }
  if (defam === "scam" || defam === "fraud" || defam === "fraudster" || defam === "scammer") {
    flags.push({
      reason: "unsupported_accusation",
      details: "Fraud/scam accusation requires supporting evidence and admin review.",
    });
  }

  const prof = containsTerm(text, PROFANITY_TERMS);
  if (prof) flags.push({ reason: "profanity", details: `Contains profanity ("${prof}").` });

  const threat = containsTerm(text, THREAT_TERMS);
  if (threat) flags.push({ reason: "threat", details: `Possible threat ("${threat}").` });

  for (const p of PERSONAL_ATTACK_PATTERNS) {
    if (p.test(text)) {
      flags.push({ reason: "personal_attack", details: "Possible personal attack phrasing." });
      break;
    }
  }
  for (const p of SPAM_PATTERNS) {
    if (p.test(text)) {
      flags.push({ reason: "commercial_spam", details: "Possible commercial spam." });
      break;
    }
  }
  for (const p of SELF_PROMOTION_PATTERNS) {
    if (p.test(text)) {
      flags.push({ reason: "self_promotion", details: "Possible self-promotion." });
      break;
    }
  }

  return { clean: flags.length === 0, flags };
}
