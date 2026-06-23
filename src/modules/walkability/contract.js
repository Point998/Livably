'use strict';

// FR-089 — Walkability chapter -> headless report contract (rollout #10). COUNTS-ONLY.
//
// Walkability uniquely produces a 0–100 composite `score` + graded `category` (Walker's Paradise / …) —
// a numerical quality rating CONSTRAINT-001 forbids, and the contract schema has no `score` field.
// Product decision (Nathan, 2026-06-23): surface only the underlying per-category destination COUNTS as
// factual measures; the composite `score`/`category` are NEVER read or emitted here (they remain in the
// data output for the SSR template only). A test asserts no "score"/"category"/"color" leaks.
//
// CONSTRAINT-015: a car-dependent or data-unavailable address still gets an actionable Walk Score pointer.

const { safeBuild } = require('../../contract/schema');

// WALK_TYPE label -> finding id + subject. Order = display order.
const CATEGORIES = [
  { label: 'Grocery',  id: 'walkable-grocery',  subject: 'Grocery within walking distance' },
  { label: 'Dining',   id: 'walkable-dining',   subject: 'Dining within walking distance' },
  { label: 'Transit',  id: 'walkable-transit',  subject: 'Transit within walking distance' },
  { label: 'Park',     id: 'walkable-park',     subject: 'Parks within walking distance' },
  { label: 'Pharmacy', id: 'walkable-pharmacy', subject: 'Pharmacy within walking distance' },
];

function buildWalkabilityContract(walkability, opts = {}) {
  if (!walkability) return null;

  const { counts = {}, destinations = [], source } = walkability;
  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const provenance = source === 'osm'
    ? { source: 'OpenStreetMap', asOf, modeled: true }   // straight-line radius
    : { source: 'Google Places', asOf, modeled: false };

  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // Nearest destination per category (destinations is nearest-first) for transitional copy.
  const nearestByLabel = {};
  for (const d of destinations) if (!nearestByLabel[d.label]) nearestByLabel[d.label] = d;

  for (const { label, id, subject } of CATEGORIES) {
    const count = counts[label];
    if (!Number.isFinite(count) || count <= 0) continue;
    const nearest = nearestByLabel[label];
    const copy = nearest
      ? `Nearest is ${nearest.name}, about a ${nearest.walkMinutes} min walk.`
      : undefined;
    push({
      id,
      bucket: 'cool',
      tone: 'favorable',
      claim: {
        subject,
        measure: { value: count, unit: 'places_within_walk' },
        comparison: null,
      },
      provenance,
      fallbackAction: null,
    }, copy);
  }

  // CONSTRAINT-015 — car-dependent or data-unavailable: a single actionable Walk Score pointer
  // (mirrors the template's FR-067 fallback). No composite rating.
  if (!findings.length) {
    push({
      id: 'walkability-pointer',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Walkable everyday destinations', measure: null, comparison: null },
      provenance: { source: 'Walk Score', asOf, modeled: false },
      fallbackAction: { type: 'url', label: 'Check this address on Walk Score', value: 'https://www.walkscore.com/' },
    }, 'Few everyday destinations appear to be within walking distance — this reads as a drive-first location. Confirm specific walk routes and times on Walk Score, and walk the block at the time of day you would actually run errands.');
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('walkability', () => ({
    schemaVersion: '1.0',
    chapterId: 'walkability',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildWalkabilityContract };
