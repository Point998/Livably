'use strict';

// FR-088 — Property Intelligence chapter -> headless report contract (rollout #9).
// The FIRST non-located chapter: findings are designed bespoke from the propIntel logic output
// (soil + construction era/vintage) — no place{} primitive.
//
// Boundary (ADR-1): scope is getPropertyIntelligence output. The tax/insurance/utilities propertyData
// is rendered by the costs module and belongs to a future costs contract.
//
// CONSTRAINT-001/008: no composite score/grade. The soil drainage `color` is consumed to derive `tone`
// and then dropped (never emitted); .strict() rejects stray fields. CONSTRAINT-002: only housing-stock
// facts (year built, new-construction %), never demographic character. CONSTRAINT-015: soil always
// yields a finding (drainage OR a point-specific SoilWeb url fallback); older-era homes carry an
// inspection instruction. Honest provenance: Census ACS / USDA SDA, modeled:false.

const { safeBuild } = require('../../contract/schema');

// Mirrors utilities' toneFromBandColor — color in, semantic tone out (the color itself is never emitted).
function toneFromDrainageColor(color) {
  if (color === 'green' || color === 'lightgreen') return 'favorable';
  if (color === 'orange' || color === 'red') return 'caution';
  return 'neutral';
}

const HYDRIC_NOTE = ' USDA classifies this soil as hydric (a potential wetland indicator) — it may affect foundation drainage, landscaping, and additions; discuss a drainage evaluation with your inspector.';

// propIntel = { soil, soilwebUrl, era, housingAgeBands, locationInfo }. opts.asOf + opts.degraded.
function buildPropertyContract(propIntel, opts = {}) {
  if (!propIntel) return null;

  const { soil, soilwebUrl, era } = propIntel;
  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const census = { source: 'Census ACS', asOf, modeled: false };
  const usda = { source: 'USDA Soil Data Access', asOf, modeled: false };

  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // ── Construction era (factual median — not a quality judgment, CONSTRAINT-001) ──
  if (Number.isFinite(era?.medianYearBuilt)) {
    push({
      id: 'construction-era',
      bucket: 'consider',
      tone: 'neutral',
      claim: {
        subject: 'Median home construction year (area)',
        measure: { value: era.medianYearBuilt, unit: 'year_built' },
        comparison: null,
      },
      provenance: census,
      fallbackAction: null,
    }, era.context?.era || undefined);
  }

  // ── Era-derived health risks (older homes) — a "thing to check" before closing ──
  if (era?.context?.cautions?.length) {
    push({
      id: 'era-health-risks',
      bucket: 'check',
      tone: 'caution',
      claim: { subject: 'Age-related material risks to inspect', measure: null, comparison: null },
      provenance: census,
      fallbackAction: {
        type: 'instruction',
        label: 'Test and inspect before closing',
        value: 'Have an inspector test for the era-typical hazards below (e.g. lead paint, asbestos, aging wiring/plumbing). Sellers must disclose known hazards, but testing is the only way to confirm presence and scope.',
      },
    }, era.context.cautions.join(' '));
  }

  // ── Soil drainage (qualitative USDA classification; tone from color) ────────────
  if (soil?.drainageCategory) {
    const dc = soil.drainageCategory;
    let tone = toneFromDrainageColor(dc.color);
    let copy = `${dc.label} — ${dc.implication}`;
    if (soil.isHydric) { tone = 'caution'; copy += HYDRIC_NOTE; }
    push({
      id: 'soil-drainage',
      bucket: 'check',
      tone,
      claim: { subject: 'Soil drainage (USDA)', measure: null, comparison: null },
      provenance: usda,
      fallbackAction: null,
    }, copy);
  } else {
    // CONSTRAINT-015 floor — the point-specific SoilWeb deep link is always available.
    push({
      id: 'soil-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Soil drainage (USDA)', measure: null, comparison: null },
      provenance: usda,
      fallbackAction: soilwebUrl
        ? { type: 'url', label: 'Look up this exact location on SoilWeb', value: soilwebUrl }
        : { type: 'instruction', label: 'Request a geotechnical report', value: 'USDA soil data was unavailable here. Request a geotechnical report or ask the seller about any known drainage issues.' },
    });
  }

  // ── New-construction share (housing-stock fact; CONSTRAINT-002 safe) ────────────
  if (Number.isFinite(era?.newConstructionPct)) {
    push({
      id: 'new-construction',
      bucket: 'cool',
      tone: 'neutral',
      claim: {
        subject: 'Share of nearby homes built since 2010',
        measure: { value: era.newConstructionPct, unit: 'percent' },
        comparison: null,
      },
      provenance: census,
      fallbackAction: null,
    });
  }

  const provenanceSummary = [
    ...new Map(
      findings.map((f) => [`${f.provenance.source}|${f.provenance.asOf}`, { source: f.provenance.source, asOf: f.provenance.asOf }])
    ).values(),
  ];

  return safeBuild('property', () => ({
    schemaVersion: '1.0',
    chapterId: 'property',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary,
  }));
}

module.exports = { buildPropertyContract };
