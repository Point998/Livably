'use strict';

// FR-081 — Schools chapter -> headless report contract (rollout #3).
// Maps getSchoolRatings(...) output into validated, presentation-free findings. Reuses the
// FR-080 ClaimSchema.place located-facility primitive (no schema change).
//
// The chapter's headline is a product RULE, not a data point: nearest school != assigned
// school. That becomes the `assigned-school` check finding carrying the district-verification
// instruction (CONSTRAINT-015). The data carries NO ratings (GreatSchools is an external link
// only), so the contract surfaces none (CONSTRAINT-001).
//
// NOTE (out of scope): getSchoolRatings does not cross-state filter (unlike findNearestSchool);
// see FR-081 spec — a separate FR should route it through checkCrossState (CONSTRAINT-006).

const { safeBuild } = require('../../contract/schema');

// Commute tone from drive minutes — semantic, not a color (CONSTRAINT-008).
function commuteTone(mins) {
  if (mins == null) return 'neutral';
  if (mins <= 10) return 'favorable';
  if (mins <= 20) return 'neutral';
  return 'caution';
}

// Drive time is the primary measure; fall back to straight-line miles when drive time is null
// (mirrors the template, which shows miles when no drive time is available).
function schoolMeasure(s) {
  if (s.driveTimeMinutes != null) return { value: s.driveTimeMinutes, unit: 'drive_minutes' };
  const miles = parseFloat(s.distanceMiles);
  return Number.isFinite(miles) ? { value: miles, unit: 'miles' } : null;
}

// schools = getSchoolRatings(...) output. opts.asOf (research date) + opts.degraded (ledger).
function buildSchoolsContract(schools, opts = {}) {
  if (!schools) return null;
  const publicSchools = (schools.public || []).filter(Boolean);
  const privateSchools = schools.private || [];
  if (!publicSchools.length && !privateSchools.length) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const prov = { source: 'Google Places', asOf, modeled: false };
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Headline caveat: nearest != assigned (the chapter's defining action) ─────
  push({
    id: 'assigned-school',
    bucket: 'check',
    tone: 'caution',
    claim: { subject: 'Assigned school zone', measure: null, comparison: null },
    provenance: prov,
    fallbackAction: {
      type: 'instruction',
      label: 'Call the district office',
      value: 'Call the district office with your exact address and ask which school your parcel is zoned to at each level — attendance boundaries can split streets, so the nearest school is often not the assigned one.',
    },
  });

  // ── Nearest public school per level ─────────────────────────────────────────
  // FR-082: a school the data layer flagged cross-state (no in-state option nearby) is a
  // caution, with the note surfaced via defaultCopy — mirrors the health contract.
  for (const s of publicSchools) {
    push({
      id: `nearest-public-${s.level.toLowerCase()}`,
      bucket: 'consider',
      tone: s.crossState ? 'caution' : commuteTone(s.driveTimeMinutes),
      claim: {
        subject: `Nearest public ${s.level.toLowerCase()} school`,
        measure: schoolMeasure(s),
        comparison: null,
        place: { name: s.name, address: s.address },
      },
      provenance: prov,
      fallbackAction: null,
    }, s.crossState ? s.crossStateNote : undefined);
  }

  // ── Nearby private schools (each durable for the FE) ────────────────────────
  privateSchools.forEach((s, i) => {
    const miles = parseFloat(s.distanceMiles);
    push({
      id: `private-school-${i + 1}`,
      bucket: 'cool',
      tone: 'neutral',
      claim: {
        subject: 'Nearby private school',
        measure: Number.isFinite(miles) ? { value: miles, unit: 'miles' } : null,
        comparison: null,
        place: { name: s.name, address: s.address },
      },
      provenance: prov,
      fallbackAction: null,
    });
  });

  return safeBuild('schools', () => ({
    schemaVersion: '1.0',
    chapterId: 'schools',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary: [{ source: prov.source, asOf: prov.asOf }],
  }));
}

module.exports = { buildSchoolsContract };
