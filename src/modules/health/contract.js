'use strict';

// FR-080 — Health chapter -> headless report contract (rollout #2).
// Maps the health module's outputs (hospital/urgent care/healthcare depth) into validated,
// presentation-free findings. CONSTRAINT-003 is upstream: hospital/urgentCare arrive already
// drive-time-verified across top-5 candidates (PM-003) — this layer only serializes.
//
// Boundary (ADR-1): health module data only. Fire/police ("emergency") belongs to the safety
// module and gets its own contract; the frontend composes the two into one visual chapter.
//
// Tone is DERIVED from existing semantic signals (drive-time tiers, primary-care count tiers) —
// never a color (CONSTRAINT-008). The drive time itself is a real measure ('drive_minutes').

const { safeBuild } = require('../../contract/schema');

// ER proximity tone — faithful to the template's existing narrative tiers (≤10 / 11–20 / >20).
function erTone(mins) {
  if (mins <= 10) return 'favorable';
  if (mins <= 20) return 'neutral';
  return 'caution';
}

// Primary-care availability tone — mirrors the template's interpretation tiers.
function pcTone(count) {
  if (count <= 5) return 'caution';
  if (count <= 15) return 'neutral';
  return 'favorable';
}

function placeOf(facility) {
  return { name: facility.name, address: facility.address };
}

// input = { hospital, urgentCare, healthcareDepth }. opts.asOf (research date) + opts.degraded.
function buildHealthContract(input = {}, opts = {}) {
  const { hospital, urgentCare, healthcareDepth } = input || {};
  if (!hospital && !urgentCare && !healthcareDepth) return null;

  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const googleProv = { source: 'Google Places', asOf, modeled: false };
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Emergency room (CONSTRAINT-003 verified upstream) ───────────────────────
  if (hospital) {
    const crossState = !!hospital.crossStateWarning;
    push({
      id: 'emergency-room',
      bucket: 'consider',
      tone: crossState ? 'caution' : erTone(hospital.driveTimeMinutes),
      claim: {
        subject: 'Nearest emergency room',
        measure: { value: hospital.driveTimeMinutes, unit: 'drive_minutes' },
        comparison: null,
        place: placeOf(hospital),
      },
      provenance: googleProv,
      fallbackAction: null,
    }, crossState ? hospital.crossStateNote : undefined);
  } else {
    push({
      id: 'emergency-room-missing',
      bucket: 'check',
      tone: 'caution',
      claim: { subject: 'Nearest emergency room', measure: null, comparison: null },
      provenance: googleProv,
      fallbackAction: { type: 'url', label: 'CMS Care Compare', value: 'https://www.medicare.gov/care-compare/' },
    });
  }

  // ── Urgent care (Cool thing to know — convenience asset) ────────────────────
  if (urgentCare) {
    const crossState = !!urgentCare.crossStateWarning;
    const closerThanER = hospital ? urgentCare.driveTimeMinutes < hospital.driveTimeMinutes : false;
    push({
      id: 'urgent-care',
      bucket: 'cool',
      tone: crossState ? 'caution' : closerThanER ? 'favorable' : 'neutral',
      claim: {
        subject: 'Nearest urgent care',
        measure: { value: urgentCare.driveTimeMinutes, unit: 'drive_minutes' },
        comparison: null,
        place: placeOf(urgentCare),
      },
      provenance: googleProv,
      fallbackAction: null,
    }, crossState ? urgentCare.crossStateNote : undefined);
  } else {
    push({
      id: 'urgent-care-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Nearest urgent care', measure: null, comparison: null },
      provenance: googleProv,
      fallbackAction: { type: 'url', label: 'Solv Health', value: 'https://www.solvhealth.com/' },
    });
  }

  // ── Hospital designation (L3 enrichment; omitted when absent) ───────────────
  const designation = healthcareDepth?.designation;
  if (designation) {
    push({
      id: 'hospital-type',
      bucket: 'cool',
      tone: 'neutral',
      claim: { subject: 'Hospital designation', measure: null, comparison: null },
      provenance: { source: 'CMS', asOf, modeled: false },
      fallbackAction: null,
    }, `${designation.label} — ${designation.note}`);
  }

  // ── Primary care availability ───────────────────────────────────────────────
  const pcCount = healthcareDepth?.primaryCareCount;
  if (Number.isFinite(pcCount)) {
    push({
      id: 'primary-care',
      bucket: 'consider',
      tone: pcTone(pcCount),
      claim: {
        subject: 'Primary care physicians in area',
        measure: { value: pcCount, unit: 'physicians' },
        comparison: null,
      },
      provenance: { source: 'CMS NPI Registry', asOf, modeled: false },
      fallbackAction: pcCount === 0
        ? { type: 'instruction', label: 'Verify with your insurer', value: 'Contact your health insurer for in-network family medicine physicians accepting new patients near this address.' }
        : null,
    });
  } else if (healthcareDepth) {
    // Depth was fetched but the count is unavailable — actionable fallback (CONSTRAINT-015).
    push({
      id: 'primary-care-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Primary care physicians in area', measure: null, comparison: null },
      provenance: { source: 'CMS NPI Registry', asOf, modeled: false },
      fallbackAction: { type: 'instruction', label: 'Contact your insurer', value: 'Ask your health insurer for in-network primary care physicians accepting new patients at this zip code.' },
    });
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('health', () => ({
    schemaVersion: '1.0',
    chapterId: 'health',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildHealthContract };
