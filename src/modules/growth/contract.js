'use strict';

// FR-091 — Growth & Development chapter -> headless report contract (rollout #12).
// Maps the growth module output (building-permit trend + nearby commercial development + named project
// pipeline) into findings.
//
// CONSTRAINT-001: growth is value-NEUTRAL context for a buyer (appreciation vs construction noise/change
// cut both ways). The permit `trend` (rising/declining/stable) is a directional FACT, not a quality score
// — every finding uses tone 'neutral'; no finding implies growth is good or bad. The trend string and the
// establishment label/source are read but never emitted verbatim into the claim. .strict() enforces it.
//
// newConstruction is intentionally NOT surfaced here — the same metric is already on the property
// contract (`new-construction`, FR-088); avoid double-counting.

const { safeBuild } = require('../../contract/schema');

const trendPhrase = (t) => (t === 'rising' ? 'rising' : t === 'declining' ? 'declining' : 'roughly stable');

function buildGrowthContract(growth, opts = {}) {
  if (!growth) return null;
  const { permits, establishments = [], namedProjects = [] } = growth;
  if (!permits && !establishments.length && !namedProjects.length) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Building-permit trend (Census BPS) — directional fact, tone neutral ──────
  if (permits) {
    const yoy = permits.percentChange != null && permits.prior != null
      ? ` That is ${permits.percentChange >= 0 ? 'up' : 'down'} ${Math.abs(permits.percentChange)}% from ${permits.prior.toLocaleString()} in ${permits.priorYear} — permitting is ${trendPhrase(permits.trend)}.`
      : ` Year-over-year comparison is unavailable; treat this as a single-year snapshot.`;
    push({
      id: 'permit-trend',
      bucket: 'consider',
      tone: 'neutral',
      claim: { subject: 'New residential building permits (area)', measure: { value: permits.current, unit: 'building_permits' }, comparison: null },
      provenance: { source: 'Census Building Permits Survey', asOf, modeled: false },
      fallbackAction: null,
    }, `${permits.current.toLocaleString()} residential permits were issued in ${permits.currentYear}.${yoy}`);
  } else {
    push({
      id: 'permit-trend-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'New residential building permits (area)', measure: null, comparison: null },
      provenance: { source: 'Census Building Permits Survey', asOf, modeled: false },
      fallbackAction: {
        type: 'instruction',
        label: 'Ask the county planning office',
        value: 'Permit-trend data was unavailable for this area. Call the county/city planning & zoning office for recent residential permit volumes, or search the Census Building Permits Survey for the county.',
      },
    });
  }

  // ── Nearby commercial development activity ───────────────────────────────────
  if (establishments.length) {
    const osm = establishments[0]?.source === 'osm';
    const sample = establishments.slice(0, 3).map((e) => `${e.name}${e.label ? ` (${e.label})` : ''}`).join(', ');
    push({
      id: 'development-activity',
      bucket: 'cool',
      tone: 'neutral',
      claim: { subject: 'Recent commercial development nearby', measure: { value: establishments.length, unit: 'count' }, comparison: null },
      provenance: { source: osm ? 'OpenStreetMap' : 'Google Places', asOf, modeled: !!osm },
      fallbackAction: null,
    }, `Recently active commercial sites nearby include ${sample}.`);
  }

  // ── Named project pipeline (development news) ────────────────────────────────
  if (namedProjects.length) {
    const sample = namedProjects.slice(0, 3).map((p) => `${p.name}${p.status ? ` — ${p.status}` : ''}`).join('; ');
    push({
      id: 'named-projects',
      bucket: 'cool',
      tone: 'neutral',
      claim: { subject: 'Named development projects in the pipeline', measure: { value: namedProjects.length, unit: 'count' }, comparison: null },
      provenance: { source: 'Google News', asOf, modeled: false },
      fallbackAction: null,
    }, `Reported projects: ${sample}.`);
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('growth', () => ({
    schemaVersion: '1.0',
    chapterId: 'growth',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildGrowthContract };
