// =====================================================================
//  ENGAGEMENT ESTIMATE  —  server-side only. Never shipped to the browser.
//  Maps the "Build your commercial freight desk" configurator selections
//  to an INDICATIVE "from" figure using the private rate card (lib/rates.js).
//
//  This is the single integration point for real pricing logic: swap the
//  body of computeEstimate() for a CRM / quoting-engine call later without
//  touching the page. The browser only ever receives the figure below —
//  the rate card itself stays here.
// =====================================================================

// Estimated annual volume bands → representative tonnage (band midpoint).
export const VOLUME_BANDS = {
  'lt25k':    { label: 'Less than 25,000 MT',      mid: 15000 },
  '25-100k':  { label: '25,000 – 100,000 MT',      mid: 60000 },
  '100-500k': { label: '100,000 – 500,000 MT',     mid: 300000 },
  '500k-1m':  { label: '500,000 – 1 million MT',   mid: 750000 },
  '1-5m':     { label: '1 – 5 million MT',         mid: 3000000 },
  '5m+':      { label: '5 million+ MT',            mid: 7000000 },
};

const GEO_ADD = { domestic: 0, 'north-america': 0.03, international: 0.08, worldwide: 0.12 };
const ENGAGEMENTS = ['single', 'recurring', 'desk', 'advisory'];

function round(n, step) { return Math.round(n / step) * step; }

// A transparent complexity multiplier (1.0 – 1.6) derived from the breadth of
// the configuration. More cargo types, modes, services, wider geography and
// project cargo each add commercial scope.
export function complexityOf(config = {}) {
  const cargo = Array.isArray(config.cargo) ? config.cargo : [];
  const modes = Array.isArray(config.modes) ? config.modes : [];
  const services = Array.isArray(config.services) ? config.services : [];
  const geo = config.geo in GEO_ADD ? config.geo : 'international';
  let c = 1
    + Math.max(0, cargo.length - 1) * 0.04
    + Math.max(0, modes.length - 1) * 0.03
    + Math.max(0, services.length - 3) * 0.02
    + (cargo.includes('project') ? 0.10 : 0)
    + (GEO_ADD[geo] || 0);
  return Math.min(Math.max(c, 1), 1.6);
}

export function computeEstimate(config = {}, R) {
  const engagement = ENGAGEMENTS.includes(config.engagement) ? config.engagement : 'desk';
  const band = VOLUME_BANDS[config.volume] || VOLUME_BANDS['25-100k'];
  const tonnes = band.mid;
  const complexity = complexityOf(config);
  const cur = R.currency;

  const base = {
    currency: cur, engagement, volumeLabel: band.label, tonnes,
    complexity: +complexity.toFixed(2),
    note: 'Final pricing depends on cargo complexity, shipment frequency and commercial scope.',
  };

  if (engagement === 'single') {
    const fee = round(R.spot.min * complexity, 500);
    return { ...base, kind: 'project', label: 'Estimated Project Fee',
             amount: fee, display: cur + fee.toLocaleString('en-US'), per: 'per shipment · one-off engagement' };
  }
  if (engagement === 'recurring') {
    const perMT = +(R.recur.rate * complexity).toFixed(2);
    return { ...base, kind: 'perMT', label: 'Estimated Commercial Management Fee',
             amount: perMT, display: cur + perMT.toFixed(2), per: 'per metric tonne' };
  }
  if (engagement === 'advisory') {
    const monthly = round((R.advisory?.retainer || 9000) * complexity, 500);
    return { ...base, kind: 'monthly', label: 'Estimated Advisory Engagement',
             amount: monthly, display: cur + monthly.toLocaleString('en-US'), per: 'per month · scope-based' };
  }
  // desk — outsourced commercial freight desk (retainer + indicative per-tonne)
  const monthly = round((R.desk.retainer / 12) * complexity, 500);
  return { ...base, kind: 'monthly', label: 'Estimated Monthly Commercial Retainer',
           amount: monthly, display: cur + monthly.toLocaleString('en-US'),
           per: 'per month · plus an indicative per-tonne management fee' };
}
