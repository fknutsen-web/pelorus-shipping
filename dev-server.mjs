// =====================================================================
//  PRIVATE RATE CARD  —  server-side only. Never shipped to the browser.
//  Edit these numbers to change pricing everywhere. Redeploy to apply.
// =====================================================================
export const RATES = {
  currency: '$',
  engagementFee: 7500,                 // one-off per engagement
  spot:  { rate: 1.20, min: 12000 },   // single voyage (per tonne)
  recur: { rate: 1.00 },               // recurring program (per tonne, no retainer)
  desk:  { retainer: 60000, rate: 0.60, term: 3, esc: 3 }, // outsourced desk
  // Logistics contract negotiation (any mode: ocean, barge, rail, road,
  // terminal handling, storage). Fixed project fee by complexity, NOT per tonne.
  // Included (waived) on the outsourced-desk tier.
  contract: { light: 6000, structured: 18000 },
  freightCut: { low: 3, high: 6 },     // % reduction target vs benchmark (NOT guaranteed)
  inhouse: { senior: 180000, ops: 110000, data: 40000, overhead: 35000, recruit: 45000, recruitYrs: 3 },
};
