'use strict';

// FR-084 — Safety chapter -> headless report contract (rollout #5).
// Maps the safety module's outputs (police/fire emergency response + location context) into
// validated, presentation-free findings, and adds the chapter's always-on actionable pointers
// (ISO/PPC rating, crime research).
//
// Boundary (ADR-1, mirrors the health contract): SAFETY module data only — police/fire
// ("emergency") + crime/ISO research. The hospital/urgent-care "emergency" of the visual
// "Health & Safety" chapter lives in the health contract; the frontend composes the two.
//
// CONSTRAINT-001/008: the input stations carry a graded `response.category` ({label, color}).
// This layer DROPS it and DERIVES `tone` from the modeled response minutes — no grade, no color.
// CONSTRAINT-002 (Fair Housing): the safety chapter fetches NO crime data; the crime finding is a
// pure actionable pointer with no measure/comparison — it never characterizes the area.
// Honest provenance: the response estimate is MODELED (distance / dispatch speed) -> modeled:true.

const { safeBuild } = require('../../contract/schema');

// Faithful collapse of the template's narrative tiers (≤5/≤8 positive, ≤12 "average",
// >12/>20 increasingly cautionary) into the contract's 3-level tone. Used for both stations.
function responseTone(mins) {
  if (mins <= 8) return 'favorable';
  if (mins <= 12) return 'neutral';
  return 'caution';
}

function placeOf(station) {
  return { name: station.name, address: station.address };
}

// input = { emergency: { police, fire }, safetyLocation: { state, city, county } }.
// opts.asOf (research date) + opts.degraded.
function buildSafetyContract(input = {}, opts = {}) {
  const { emergency, safetyLocation } = input || {};
  const police = emergency?.police || null;
  const fire = emergency?.fire || null;
  if (!police && !fire && !safetyLocation) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const responseProv = { source: 'Google Places + dispatch model', asOf, modeled: true };
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Police + fire emergency response ────────────────────────────────────────
  // Shared shape: nearest station by distance; the displayed estimate is MODELED.
  function pushStation(station, kind, label) {
    const hasEstimate = Number.isFinite(station?.response?.estimate);
    if (station && hasEstimate) {
      push({
        id: `${kind}-response`,
        bucket: 'consider',
        tone: responseTone(station.response.estimate),
        claim: {
          subject: `${label} response time`,
          measure: { value: station.response.estimate, unit: 'response_minutes' },
          comparison: null,
          place: placeOf(station),
        },
        provenance: responseProv,
        fallbackAction: null,
      });
    } else {
      push({
        id: `${kind}-response-missing`,
        bucket: 'check',
        tone: 'caution',
        claim: { subject: `${label} response time`, measure: null, comparison: null },
        provenance: { source: 'Google Places + dispatch model', asOf, modeled: false },
        fallbackAction: {
          type: 'instruction',
          label: `Find the nearest ${label.toLowerCase()} station`,
          value: `Search "${kind === 'police' ? 'police department' : 'fire station'} near ${[safetyLocation?.city, safetyLocation?.state].filter(Boolean).join(', ') || 'this address'}" and call the non-emergency line to confirm which station serves this address and its typical response time.`,
        },
      });
    }
  }
  pushStation(police, 'police', 'Police');
  pushStation(fire, 'fire', 'Fire');

  // ── ISO Public Protection Classification (always — actionable, premium-relevant) ──
  push({
    id: 'iso-ppc',
    bucket: 'check',
    tone: 'neutral',
    claim: { subject: 'ISO fire protection class (PPC)', measure: null, comparison: null },
    provenance: { source: 'ISO Public Protection Classification', asOf, modeled: false },
    fallbackAction: {
      type: 'instruction',
      label: 'Ask your insurer for the ISO PPC rating',
      value: 'Ask your homeowner\'s insurance agent for the ISO Public Protection Classification (PPC) for this exact address. Ratings 1–4 are excellent; 8–10 mean limited coverage and higher premiums. It is address-specific and free to pull.',
    },
  }, 'The ISO PPC for this address directly sets your fire-coverage premium — confirm it before you close.');

  // ── Crime research (always) — CONSTRAINT-002: pointer only, never a characterization ──
  const place = [safetyLocation?.city, safetyLocation?.county].filter(Boolean).join(', ');
  push({
    id: 'crime-research',
    bucket: 'check',
    tone: 'neutral',
    claim: { subject: 'Neighborhood incident research', measure: null, comparison: null },
    provenance: { source: 'Local law enforcement / CrimeMapping.com', asOf, modeled: false },
    fallbackAction: {
      type: 'url',
      label: 'Open a neighborhood crime map',
      value: 'https://www.crimemapping.com/map',
    },
  }, `No single database covers every block equally. Combine two or three sources${place ? ` for ${place}` : ''} — CrimeMapping.com, SpotCrime.com, and your local department's own incident log — and read at the block level, not the city average.`);

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('safety', () => ({
    schemaVersion: '1.0',
    chapterId: 'safety',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildSafetyContract };
