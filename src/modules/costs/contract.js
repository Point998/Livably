'use strict';

// FR-093 — Costs chapter -> headless report contract (rollout #14, the last numbered chapter).
//
// Costs is the highest-risk chapter for Livably's informed-not-judged feel, and the most likely to be
// mistaken for precise, address-specific figures when it is built on STATE-LEVEL AVERAGES. So:
//   • Component costs are emitted as factual measures — NEVER a composite affordability score (CONSTRAINT-001).
//     The carrying-cost finding is a transparent component SUM (a budgeting input), not a verdict.
//   • The only comparison is the property-tax RATE vs national_average — never income or the area's
//     economic class (CONSTRAINT-002). The chapter emits no income finding at all.
//   • All four state-average estimates are honest-provenance modeled:true AND carry a CONSTRAINT-015
//     "get your real number" action. The $300k reference-price anchor is baked into the carrying-cost unit
//     token so a consumer can't render it as an address-specific quote.
//   • Home value is deliberately NOT emitted (Census lags 3–5 yrs); the SSR template keeps its Zillow redirect.

const { safeBuild } = require('../../contract/schema');
const { computeCosts } = require('./logic');

const TAX_FALLBACK = 'Search "[county] assessor" or "[county] property tax records" for the exact assessed value and tax history for this specific parcel — often available free online. The rate shown is a state average.';
const INS_FALLBACK = 'Rates for the same home can differ 30–50% by age, construction, roof condition, and proximity to fire stations. Get at least 3 quotes before closing.';
const UTIL_FALLBACK = "Ask the seller's agent for the last 12 months of electric, gas, and water bills — seasonal swings matter, especially in older homes with original HVAC or limited insulation.";
const CARRY_FALLBACK = 'This is taxes + insurance + utilities only. Add your mortgage payment and a maintenance reserve (≈1%/yr, more for older homes) for the true monthly cost.';

// tax-comparison direction -> three-bucket framing (CONSTRAINT-001: framing, not a score).
const TAX_BUCKET = { below: 'cool', near: 'consider', above: 'check' };
const TAX_TONE = { below: 'favorable', near: 'neutral', above: 'caution' };

function buildCostsContract(propertyData, opts = {}) {
  if (!propertyData) return null;
  const c = computeCosts(propertyData);
  if (!c) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Property tax rate — the one finding that uses `comparison` (vs national_average only) ──
  const { direction, deltaPct, referenceValue } = c.taxComparison;
  push({
    id: 'property-tax-rate',
    bucket: TAX_BUCKET[direction],
    tone: TAX_TONE[direction],
    claim: {
      subject: 'Effective property tax rate (state average)',
      measure: { value: c.taxRate, unit: 'percent_effective' },
      comparison: { basis: 'national_average', referenceValue, direction, deltaPct, region: c.state },
    },
    provenance: { source: 'Lincoln Institute', asOf, modeled: true },
    fallbackAction: { type: 'instruction', label: 'Look up the actual parcel tax bill', value: TAX_FALLBACK },
  });

  // ── Insurance estimate (state average) ──
  push({
    id: 'insurance-estimate',
    bucket: 'consider',
    tone: 'neutral',
    claim: { subject: 'Estimated homeowners insurance (state average)', measure: { value: c.monthly.insurance, unit: 'usd_per_month' }, comparison: null },
    provenance: { source: 'NAIC', asOf, modeled: true },
    fallbackAction: { type: 'instruction', label: 'Get at least 3 quotes', value: INS_FALLBACK },
  });

  // ── Utilities estimate (state average) ──
  push({
    id: 'utilities-estimate',
    bucket: 'consider',
    tone: 'neutral',
    claim: { subject: 'Estimated monthly utilities (state average)', measure: { value: c.monthly.utilities, unit: 'usd_per_month' }, comparison: null },
    provenance: { source: 'EIA', asOf, modeled: true },
    fallbackAction: { type: 'instruction', label: 'Request 12 months of utility bills', value: UTIL_FALLBACK },
  });

  // ── Carrying-cost estimate — transparent component SUM at the $300k reference (NOT a score) ──
  push({
    id: 'carrying-cost-estimate',
    bucket: 'consider',
    tone: 'neutral',
    claim: {
      subject: 'Estimated monthly carrying cost at $300k reference price (excludes mortgage)',
      measure: { value: c.monthly.total, unit: 'usd_per_month_at_300k_ref' },
      comparison: null,
    },
    provenance: { source: 'Livably estimate (state averages)', asOf, modeled: true },
    fallbackAction: { type: 'instruction', label: 'Add your mortgage and a maintenance reserve', value: CARRY_FALLBACK },
  });

  // ── Homestead exemption — a genuine "cool thing to know", only when the state has one ──
  if (propertyData.homesteadNote) {
    push({
      id: 'homestead-exemption',
      bucket: 'cool',
      tone: 'favorable',
      claim: { subject: 'Homestead exemption available', measure: null, comparison: null },
      provenance: { source: 'State homestead statute', asOf, modeled: false },
      fallbackAction: null,
    }, propertyData.homesteadNote);
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('costs', () => ({
    schemaVersion: '1.0',
    chapterId: 'costs',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildCostsContract };
