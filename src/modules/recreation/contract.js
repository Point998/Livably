'use strict';

// FR-086 — Recreation chapter -> headless report contract (rollout #7).
// Maps the recreation module's amenities (park / coffee / library / recreation center / post office)
// into validated, presentation-free findings.
//
// Boundary (ADR-1): recreation owns these 5 amenities ONLY. elementarySchool (rendered alongside them
// in the shared template card) is schools-module data and is already on the contract (FR-081/082).
//
// All findings are bucket 'cool' (discretionary "Cool Things to Know" amenities). Tone is favorable or
// neutral — NEVER caution: a distant park/cafe is informational, not a risk (CONSTRAINT-001). Absent
// amenities are OMITTED (no *-missing finding) — the template omits them too, and the absence of a
// discretionary amenity is not a decision gap a buyer must "check" (cf. FR-085's daily-essentials).
// The OSM straight-line fallback is surfaced honestly as 'straight_line_miles' with modeled:true.

const { safeBuild } = require('../../contract/schema');

function amenityTone(mins) {
  return mins <= 10 ? 'favorable' : 'neutral';
}

function isOSM(r) {
  return r?.proximitySource === 'osm-straightline';
}

// PlaceSchema.address is a required string; OSM records carry address:null -> coerce to a sentinel.
function placeOf(r) {
  return { name: r.name, address: r.address || 'Location approximate (OpenStreetMap)' };
}

// Build one amenity finding (present only). Returns null for an absent amenity so the caller omits it.
function amenityFinding(record, { id, subject }, asOf) {
  if (!record) return null;

  let measure;
  let provenance;
  let tone;
  let copy;
  if (isOSM(record)) {
    measure = { value: record.distanceMiles, unit: 'straight_line_miles' };
    provenance = { source: 'OpenStreetMap', asOf, modeled: true };
    tone = 'neutral';
    copy = 'Live drive time was unavailable, so this is a straight-line (as-the-crow-flies) distance from OpenStreetMap — a rough sense of proximity; road distance and time will run somewhat longer.';
  } else {
    measure = { value: record.driveTimeMinutes, unit: 'drive_minutes' };
    provenance = { source: 'Google Places', asOf, modeled: false };
    tone = amenityTone(record.driveTimeMinutes);
  }

  return {
    finding: {
      id,
      bucket: 'cool',
      tone,
      claim: { subject, measure, comparison: null, place: placeOf(record) },
      provenance,
      fallbackAction: null,
    },
    copy,
  };
}

// input = { park, coffeeShop, library, recCenter, postOffice }. opts.asOf + opts.degraded.
function buildRecreationContract(input = {}, opts = {}) {
  const { park, coffeeShop, library, recCenter, postOffice } = input || {};
  if (!park && !coffeeShop && !library && !recCenter && !postOffice) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const findings = [];
  const push = (built) => {
    if (!built) return;
    const { finding, copy } = built;
    if (copy) finding.defaultCopy = copy;
    findings.push(finding);
  };

  push(amenityFinding(park, { id: 'nearest-park', subject: 'Nearest park' }, asOf));
  push(amenityFinding(coffeeShop, { id: 'nearest-coffee', subject: 'Nearest coffee shop' }, asOf));
  push(amenityFinding(library, { id: 'nearest-library', subject: 'Nearest public library' }, asOf));
  push(amenityFinding(recCenter, { id: 'nearest-recreation-center', subject: 'Nearest recreation center' }, asOf));
  push(amenityFinding(postOffice, { id: 'nearest-post-office', subject: 'Nearest post office' }, asOf));

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('recreation', () => ({
    schemaVersion: '1.0',
    chapterId: 'recreation',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildRecreationContract };
