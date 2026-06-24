// Pure pricing logic — shared by the quote API and the internal tool.
export function inhouseAnnual(r) {
  const i = r.inhouse;
  return i.senior + i.ops + i.data + i.overhead + i.recruit / Math.max(i.recruitYrs, 1);
}

export function computeTiers(input, r) {
  const ton = Math.max(+input.annualTonnes || 0, 0);
  const voy = Math.max(+input.shipments || 1, 1);
  const e = r.engagementFee;
  const perShip = ton / voy;

  const v1 = Math.max(r.spot.rate * perShip, r.spot.min);
  const t1 = { key: 'spot', name: 'Single voyage', tagline: 'Pay as you ship',
               annual: (v1 + e) * voy, engPerYear: e * voy, engOnce: false, perShip: v1 };
  const t2 = { key: 'recur', name: 'Recurring program', tagline: 'A repeating cargo flow',
               annual: r.recur.rate * ton + e, engPerYear: e, engOnce: true };
  const t3 = { key: 'desk', name: 'Outsourced desk', tagline: 'Exclusive standing desk',
               annual: r.desk.retainer + r.desk.rate * ton + e, engPerYear: e, engOnce: true };
  [t1, t2, t3].forEach(t => { t.perTon = ton > 0 ? t.annual / ton : 0; });

  const best = [t1, t2, t3].reduce((a, b) => (b.annual < a.annual ? b : a));

  // Logistics contract negotiation (episodic, fixed fee, waived on the desk)
  const lightN = Math.max(+input.lightContracts || 0, 0);
  const structN = Math.max(+input.structuredContracts || 0, 0);
  const contractTotal = lightN * r.contract.light + structN * r.contract.structured;
  const contracts = (lightN + structN) > 0 ? {
    lightN, structN, lightFee: r.contract.light, structFee: r.contract.structured,
    total: contractTotal, waivedOnDesk: true,
  } : null;

  const bench = +input.benchmark || 0;
  const freight = bench > 0 ? {
    low: bench * r.freightCut.low / 100, high: bench * r.freightCut.high / 100,
    annualLow: bench * r.freightCut.low / 100 * ton, annualHigh: bench * r.freightCut.high / 100 * ton,
    cutLow: r.freightCut.low, cutHigh: r.freightCut.high, benchmark: bench,
  } : null;

  return {
    currency: r.currency, tiers: [t1, t2, t3], bestKey: best.key,
    inhouse: inhouseAnnual(r), engagementFee: e, deskTerm: r.desk.term,
    contracts, freight,
    input: { annualTonnes: ton, shipments: voy, benchmark: bench, lightContracts: lightN, structuredContracts: structN },
  };
}
