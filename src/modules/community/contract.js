'use strict';

// FR-079 — Community chapter -> headless report contract.
// FAIR HOUSING (CONSTRAINT-002) is the governing concern here: this chapter surfaces demographic
// FACTS but must never CHARACTERIZE an area by them. Two hard rules, enforced by tests:
//   ADR-1: every finding is tone 'neutral', bucket 'cool' — demographics are context to KNOW,
//          never a favorable/caution judgment about who lives somewhere.
//   ADR-2: income compares to the NATIONAL median only (basis 'national_median'), never local.
// Mirrors the existing logic.js, where getIncomeLevel returns a constant color per tier — it
// already refuses to characterize local economic class.

const { safeBuild } = require('../../contract/schema');

// Direction from the existing level label (no manufactured reference value).
function directionFromLabel(label) {
  const s = String(label || '').toLowerCase();
  if (s.includes('above')) return 'above';
  if (s.includes('below')) return 'below';
  return 'near';
}

// d = getDemographics(...) output. opts.asOf (ACS vintage) optional.
function buildCommunityContract(d, opts = {}) {
  if (!d) return null;
  const asOf = opts.asOf || new Date().toISOString().slice(0, 7);
  const prov = { source: 'Census ACS', asOf, modeled: false };
  const findings = [];
  const push = (f, copy) => { if (copy) f.defaultCopy = copy; findings.push(f); };

  // Population density — physical character of the area (allowed under CONSTRAINT-002).
  if (d.community?.densityType) {
    push({
      id: 'population-density',
      bucket: 'cool',
      tone: 'neutral',
      claim: {
        subject: 'Population density',
        measure: Number.isFinite(d.totalPop) ? { value: d.totalPop, unit: 'people_in_tract' } : null,
        comparison: null,
      },
      provenance: prov,
      fallbackAction: null,
    }, d.community.densityType.label);
  }

  // Age distribution — factual, never judged.
  if (d.age?.primaryGroup) {
    push({
      id: 'age-distribution',
      bucket: 'cool',
      tone: 'neutral',
      claim: { subject: 'Predominant age group', measure: null, comparison: null },
      provenance: prov,
      fallbackAction: null,
    }, d.age.primaryGroup);
  }

  // Household income — NATIONAL median comparison only (ADR-2). Missing -> actionable fallback.
  if (d.income?.median) {
    push({
      id: 'household-income',
      bucket: 'cool',
      tone: 'neutral',
      claim: {
        subject: 'Median household income',
        measure: { value: d.income.median, unit: 'usd' },
        comparison: {
          basis: 'national_median',
          referenceValue: null,                 // no manufactured precision; direction carries the signal
          direction: directionFromLabel(d.income.level?.label),
          deltaPct: null,
          region: null,
        },
      },
      provenance: prov,
      fallbackAction: null,
    });
  } else {
    push({
      id: 'income-missing',
      bucket: 'check',
      tone: 'neutral',
      claim: { subject: 'Median household income', measure: null, comparison: null },
      provenance: prov,
      fallbackAction: { type: 'url', label: 'data.census.gov', value: 'https://data.census.gov' },
    });
  }

  // Educational attainment — fact vs US average; neutral (no value judgment on residents).
  if (Number.isFinite(d.education?.collegePct)) {
    push({
      id: 'educational-attainment',
      bucket: 'cool',
      tone: 'neutral',
      claim: {
        subject: 'College-educated share of adults',
        measure: { value: d.education.collegePct, unit: 'percent' },
        comparison: {
          basis: 'national_average',
          referenceValue: null,
          direction: directionFromLabel(d.education.level?.label),
          deltaPct: null,
          region: null,
        },
      },
      provenance: prov,
      fallbackAction: null,
    });
  }

  // Homeownership + community type — housing infrastructure, neutral.
  if (Number.isFinite(d.community?.ownershipRate)) {
    push({
      id: 'homeownership',
      bucket: 'cool',
      tone: 'neutral',
      claim: {
        subject: 'Owner-occupied housing',
        measure: { value: d.community.ownershipRate, unit: 'percent' },
        comparison: null,
      },
      provenance: prov,
      fallbackAction: null,
    }, d.community.type?.label);
  }

  return safeBuild('community', () => ({
    schemaVersion: '1.0',
    chapterId: 'community',
    findings,
    degraded: !!opts.degraded,
    provenanceSummary: findings.length ? [{ source: prov.source, asOf: prov.asOf }] : [],
  }));
}

module.exports = { buildCommunityContract };
