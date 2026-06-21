'use strict';

// FR-078 — Utilities chapter -> headless report contract (pilot).
// Maps the assembleUtilities(...) logic output into validated, presentation-free findings.
// Tone is derived HERE from the existing semantic signals (rate delta, internet band) — never a
// color; the frontend owns visual treatment. Prose rides along only as TRANSITIONAL `defaultCopy`.
// The global logic `color` -> `tone` refactor is a deliberate follow-up; the pilot keeps logic.js
// untouched and does the mapping at the contract boundary.

const { safeBuild } = require('../../contract/schema');

function rateDirection(deltaLabel) {
  const s = String(deltaLabel || '');
  if (s.startsWith('below')) return 'below';
  if (s.startsWith('above')) return 'above';
  return 'near';
}

function toneFromDirection(dir) {
  return dir === 'below' ? 'favorable' : dir === 'above' ? 'caution' : 'neutral';
}

function toneFromBandColor(color) {
  if (color === 'green' || color === 'lightgreen') return 'favorable';
  if (color === 'orange' || color === 'muted') return 'caution';
  return 'neutral';
}

// u = assembleUtilities(...) output. opts.asOf (research/vintage date) + opts.degraded (ledger).
function buildUtilitiesContract(u, opts = {}) {
  if (!u) return null;
  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const state = u.locationInfo?.state || null;
  const findings = [];

  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Electric ──────────────────────────────────────────────────────────────
  if (u.electric && u.rateContext) {
    const rc = u.rateContext;
    const dir = rateDirection(rc.deltaLabel);
    push({
      id: 'electric-rate',
      bucket: 'consider',
      tone: toneFromDirection(dir),
      claim: {
        subject: 'Residential electric rate',
        measure: { value: Math.round(rc.rate * 100), unit: 'cents_per_kwh' },
        comparison: {
          basis: 'state_average',
          referenceValue: Math.round(rc.stateAvg * 100),
          direction: dir,
          deltaPct: Number(rc.delta.toFixed(4)),
          region: state,
        },
      },
      provenance: { source: u.electricSource || 'NREL', asOf, modeled: false },
      fallbackAction: null,
    }, rc.narrative);
  } else if (u.electric) {
    // Provider known, per-address rate unavailable (e.g. HIFLD).
    push({
      id: 'electric-provider',
      bucket: 'cool',
      tone: 'neutral',
      claim: { subject: `Electric provider: ${u.electric.utilityName}`, measure: null, comparison: null },
      provenance: { source: u.electricSource || 'HIFLD', asOf, modeled: false },
      fallbackAction: null,
    }, u.utilityType?.label);
  } else {
    // No electric data — actionable fallback (CONSTRAINT-015), as a contract field.
    push({
      id: 'electric-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Electric provider & rate', measure: null, comparison: null },
      provenance: { source: 'NREL', asOf, modeled: false },
      fallbackAction: { type: 'url', label: 'OpenEI Utility Rate Database', value: 'https://apps.openei.org/USURDB/' },
    });
  }

  // ── EV charging (informational; emitted only when present) ─────────────────
  if (u.evCharging) {
    push({
      id: 'ev-charging',
      bucket: 'cool',
      tone: u.evCharging.dcFast ? 'favorable' : 'neutral',
      claim: { subject: 'EV charging access', measure: null, comparison: null },
      provenance: { source: u.evSource || 'NREL', asOf, modeled: false },
      fallbackAction: null,
    }, u.evCost?.homeNote);
  }

  // ── Internet ──────────────────────────────────────────────────────────────
  if (u.internet) {
    push({
      id: 'internet-band',
      bucket: 'consider',
      tone: toneFromBandColor(u.internet.band?.color),
      claim: { subject: 'Home internet', measure: null, comparison: null },
      provenance: { source: 'FCC', asOf, modeled: false },
      fallbackAction: null,
    }, u.internet.meaning);
  } else {
    push({
      id: 'internet-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Home internet', measure: null, comparison: null },
      provenance: { source: 'FCC', asOf, modeled: false },
      fallbackAction: { type: 'url', label: 'FCC National Broadband Map', value: 'https://broadbandmap.fcc.gov/' },
    });
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('utilities', () => ({
    schemaVersion: '1.0',
    chapterId: 'utilities',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildUtilitiesContract };
