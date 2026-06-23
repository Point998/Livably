'use strict';

// FR-085 — Reachability chapter -> headless report contract (rollout #6).
// Maps the reachability module's "Daily Conveniences" (grocery / pharmacy / gas station) into
// validated, presentation-free findings.
//
// Boundary (ADR-1): reachability owns grocery/pharmacy/gas ONLY. Civic items (park/coffee/library/
// rec/post) belong to the recreation module; highway to access; hospital/ER to health — each its
// own contract; the frontend composes them.
//
// FR-058: lifestyle drive times are cell-centroid-based (a documented sub-block approximation; the
// safety tier recomputes exact). They are surfaced as a real 'drive_minutes' measure — the value the
// template already renders. The OSM fallback is as-the-crow-flies and is surfaced honestly as
// 'straight_line_miles' with modeled:true. Per-finding warnings propagate as tone:caution + note:
//   - grocery coherenceWarning (CONSTRAINT-010: implausibly far daily destination)
//   - pharmacy crossStateWarning (FR-083 / CONSTRAINT-006)
// CONSTRAINT-001/008: no score/grade/color — tone is derived; .strict() rejects stray fields.

const { safeBuild } = require('../../contract/schema');

// Faithful to the daily-conveniences narrative framing (effortless / accessible / plan-ahead).
function driveTone(mins) {
  if (mins <= 10) return 'favorable';
  if (mins <= 20) return 'neutral';
  return 'caution';
}

function isOSM(r) {
  return r?.proximitySource === 'osm-straightline';
}

// PlaceSchema.address is a required string; OSM records carry address:null -> coerce to a sentinel.
function placeOf(r) {
  return { name: r.name, address: r.address || 'Location approximate (OpenStreetMap)' };
}

// Build one destination finding (present or missing) + its transitional defaultCopy.
function destFinding(record, { id, missingId, subject, fallbackUrl, fallbackLabel }, asOf) {
  if (!record) {
    return {
      finding: {
        id: missingId,
        bucket: 'check',
        tone: 'neutral',
        claim: { subject, measure: null, comparison: null },
        provenance: { source: 'Google Places', asOf, modeled: false },
        fallbackAction: { type: 'url', label: fallbackLabel, value: fallbackUrl },
      },
      copy: undefined,
    };
  }

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
    tone = driveTone(record.driveTimeMinutes);
  }

  // Caution overrides (force tone + surface the upstream note). Only one applies per record type.
  if (record.coherenceWarning) { tone = 'caution'; copy = record.coherenceReason; }
  if (record.crossStateWarning) { tone = 'caution'; copy = record.crossStateNote; }

  return {
    finding: {
      id,
      bucket: 'consider',
      tone,
      claim: { subject, measure, comparison: null, place: placeOf(record) },
      provenance,
      fallbackAction: null,
    },
    copy,
  };
}

// input = { grocery (array|record|null), pharmacy, gasStation }. opts.asOf + opts.degraded.
function buildReachabilityContract(input = {}, opts = {}) {
  const { grocery, pharmacy, gasStation } = input || {};
  const g0 = Array.isArray(grocery) ? grocery[0] : grocery;
  if (!g0 && !pharmacy && !gasStation) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const findings = [];
  const push = ({ finding, copy }) => { if (copy) finding.defaultCopy = copy; findings.push(finding); };

  push(destFinding(g0, {
    id: 'nearest-grocery', missingId: 'nearest-grocery-missing', subject: 'Nearest grocery store',
    fallbackUrl: 'https://www.google.com/maps/search/grocery+store', fallbackLabel: 'Find groceries on Google Maps',
  }, asOf));
  push(destFinding(pharmacy, {
    id: 'nearest-pharmacy', missingId: 'nearest-pharmacy-missing', subject: 'Nearest pharmacy',
    fallbackUrl: 'https://www.google.com/maps/search/pharmacy', fallbackLabel: 'Find pharmacies on Google Maps',
  }, asOf));
  push(destFinding(gasStation, {
    id: 'nearest-gas', missingId: 'nearest-gas-missing', subject: 'Nearest gas station',
    fallbackUrl: 'https://www.google.com/maps/search/gas+station', fallbackLabel: 'Find gas stations on Google Maps',
  }, asOf));

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('reachability', () => ({
    schemaVersion: '1.0',
    chapterId: 'reachability',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildReachabilityContract };
