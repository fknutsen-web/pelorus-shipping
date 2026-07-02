/** Domain vocabulary shared by forms, pages and scoring. */

export const VERIFIED_STATUSES = [
  "verified_professional",
  "verified_company_rep",
  "verified_software_vendor",
  "verified_conference_organizer",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending Verification",
  verified_professional: "Verified Maritime Professional",
  verified_company_rep: "Verified Company Representative",
  verified_software_vendor: "Verified Software Vendor",
  verified_conference_organizer: "Verified Conference Organizer",
  rejected: "Not Approved",
  suspended: "Suspended",
};

export const RELATIONSHIP_OPTIONS: { value: string; label: string; weight: number }[] = [
  { value: "customer", label: "Customer", weight: 1 },
  { value: "software_user", label: "Direct software user", weight: 1 },
  { value: "conference_attendee", label: "Conference attendee", weight: 1 },
  { value: "supplier", label: "Supplier", weight: 0.6 },
  { value: "vendor", label: "Vendor", weight: 0.6 },
  { value: "broker", label: "Broker", weight: 0.6 },
  { value: "agent", label: "Agent", weight: 0.6 },
  { value: "partner", label: "Partner", weight: 0.6 },
  { value: "former_employee", label: "Former employee", weight: 0.3 },
  { value: "current_employee", label: "Current employee (comment only, no rating)", weight: 0 },
  { value: "other", label: "Other", weight: 0.5 },
];

export const COMPANY_SCORE_CATEGORIES: { key: string; label: string }[] = [
  { key: "payment_reliability", label: "Payment Reliability" },
  { key: "communication", label: "Communication" },
  { key: "operational_reliability", label: "Operational Reliability" },
  { key: "contract_performance", label: "Contract Performance" },
  { key: "claims_handling", label: "Claims Handling" },
  { key: "commercial_professionalism", label: "Commercial Professionalism" },
];

export const SOFTWARE_SCORE_CATEGORIES: { key: string; label: string }[] = [
  { key: "ease_of_use", label: "Ease of Use" },
  { key: "implementation", label: "Implementation" },
  { key: "customer_support", label: "Customer Support" },
  { key: "reporting", label: "Reporting" },
  { key: "integration", label: "Integration" },
  { key: "ai_features", label: "AI Features" },
  { key: "roi", label: "ROI" },
  { key: "hidden_cost", label: "Hidden Cost Transparency" },
];

export const CONFERENCE_SCORE_CATEGORIES: { key: string; label: string }[] = [
  { key: "networking", label: "Networking Value" },
  { key: "decision_maker_attendance", label: "Decision-Maker Attendance" },
  { key: "content_quality", label: "Content Quality" },
  { key: "exhibitor_value", label: "Exhibitor Value" },
  { key: "deal_generation", label: "Deal Generation" },
  { key: "roi", label: "Worth the Total Cost (ROI)" },
];

export const SCORE_CATEGORIES: Record<string, { key: string; label: string }[]> = {
  company: COMPANY_SCORE_CATEGORIES,
  software: SOFTWARE_SCORE_CATEGORIES,
  conference: CONFERENCE_SCORE_CATEGORIES,
};

export const POST_TYPES: { value: string; label: string }[] = [
  { value: "general", label: "General post" },
  { value: "question", label: "Question" },
  { value: "company_discussion", label: "Company discussion" },
  { value: "software_discussion", label: "Software discussion" },
  { value: "conference_discussion", label: "Conference discussion" },
  { value: "market_observation", label: "Market observation" },
  { value: "request_for_feedback", label: "Request for feedback" },
];

export const TRUST_SIGNAL_LABELS: Record<string, string> = {
  reported_payment_concern: "Reported Payment Concern",
  verified_dispute_signal: "Verified Dispute Signal",
  communication_concern: "Communication Concern",
  contract_performance_concern: "Contract Performance Concern",
  public_legal_reference: "Public Legal/Arbitration Reference",
  low_confidence_pattern: "Low Community Confidence Pattern",
};

/** Reputation tiers — competence labels, not popularity metrics. */
export const REPUTATION_TIERS: { min: number; label: string }[] = [
  { min: 1000, label: "Community Leader" },
  { min: 500, label: "Recognized Expert" },
  { min: 250, label: "Industry Specialist" },
  { min: 100, label: "Trusted Contributor" },
  { min: 0, label: "Verified Professional" },
];

export const COUNTRIES = [
  "Norway", "United Kingdom", "Denmark", "Sweden", "Finland", "Germany",
  "Netherlands", "Belgium", "France", "Spain", "Italy", "Greece", "Cyprus",
  "Malta", "Turkey", "United Arab Emirates", "Saudi Arabia", "Qatar", "Egypt",
  "South Africa", "Nigeria", "India", "Pakistan", "Bangladesh", "Sri Lanka",
  "Singapore", "Malaysia", "Indonesia", "Philippines", "Vietnam", "Thailand",
  "China", "Hong Kong SAR", "Taiwan", "Japan", "South Korea", "Australia",
  "New Zealand", "United States", "Canada", "Mexico", "Panama", "Brazil",
  "Argentina", "Chile", "Peru", "Colombia", "Switzerland", "Monaco", "Other",
];
