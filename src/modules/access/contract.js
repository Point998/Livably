'use strict';

// FR-087 — Access (highway) chapter -> headless report contract (rollout #8). The LAST
// located-facility chapter. Maps the nearest interstate on-ramp into a single validated finding.
//
// Boundary (ADR-1): access owns highway access only. The record arrives from the geocoding strategy
// (CONSTRAINT-005 / PM-002) — there is no OSM fallback and no cross-state/coherence flag here.
//
// CONSTRAINT-001/008: no score/grade/color — tone is derived; .strict() rejects stray fields. The
// input record's `location`/`note` are not copied verbatim (the claim is built fresh; `note` becomes
// transitional defaultCopy). CONSTRAINT-015: an absent highway -> the chapter is omitted (returns null,
// matching the template, which drops the "Getting Around" section entirely), never an empty render.

const { safeBuild } = require('../../contract/schema');

// Faithful to the template's "Getting Around" tiers (<5/<10 close -> favorable; <20 buffer -> neutral;
// >=20 "test the drive at actual rush hour before committing" -> caution).
function driveTone(mins) {
  if (mins <= 10) return 'favorable';
  if (mins <= 20) return 'neutral';
  return 'caution';
}

// input = { highwayRamp }. opts.asOf + opts.degraded.
function buildAccessContract(input = {}, opts = {}) {
  const { highwayRamp } = input || {};
  if (!highwayRamp) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);

  const finding = {
    id: 'highway-access',
    bucket: 'consider',
    tone: driveTone(highwayRamp.driveTimeMinutes),
    claim: {
      subject: 'Nearest interstate access',
      measure: { value: highwayRamp.driveTimeMinutes, unit: 'drive_minutes' },
      comparison: null,
      place: { name: highwayRamp.name, address: highwayRamp.address },
    },
    provenance: { source: 'Google geocoding + Distance Matrix', asOf, modeled: false },
    fallbackAction: null,
  };
  if (highwayRamp.note) finding.defaultCopy = highwayRamp.note;

  const findings = [finding];
  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('access', () => ({
    schemaVersion: '1.0',
    chapterId: 'access',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildAccessContract };
