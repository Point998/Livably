'use strict';

// FR-090 — environment contract builder (rollout #11). Environmental health & safety findings
// from getEnvironmentalData. External indices (AQI/flood/radon/DNL/EJSCREEN) are factual measures,
// NOT Livably composite scores (CONSTRAINT-001); graded label/color dropped.

const { buildEnvironmentContract } = require('../../../src/modules/sensory/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const full = {
  airQuality: { aqi: 38, category: { label: 'Good', color: 'green', description: 'Air quality is satisfactory.' }, primaryPollutant: 'Ozone' },
  floodRisk: { zone: 'X', risk: 'Minimal', insuranceRequired: false, description: 'Outside high-risk flood areas.' },
  roadNoise: { dnl: 52, source: 'BTS', category: { label: 'Quiet', color: 'lightgreen', hint: 'within the quiet residential range' }, nearestRoad: null },
  waterQuality: { systemName: 'Georgetown Municipal Water', pwsId: 'KY0000123', violations: [] },
  radon: { zone: 2 },
  ejscreen: { superfundPct: 40, rmpPct: 30, tsdfPct: 20, flagged: false },
};

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildEnvironmentContract', () => {
  test('all health/safety inputs absent -> null (AC-9)', () => {
    expect(buildEnvironmentContract({ airports: [{ name: 'X' }] }, ASOF)).toBeNull();
    expect(buildEnvironmentContract(null, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-1)', () => {
    const c = buildEnvironmentContract(full, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('environment');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('flood-risk: tone from risk; zone+insurance in copy; absent -> FEMA url (AC-2)', () => {
    const f = findById(buildEnvironmentContract(full, ASOF), 'flood-risk');
    expect(f.bucket).toBe('check');
    expect(f.tone).toBe('favorable'); // Minimal
    expect(f.defaultCopy).toContain('Zone X');
    const high = findById(buildEnvironmentContract({ ...full, floodRisk: { zone: 'AE', risk: 'High', insuranceRequired: true, description: '1% annual chance.' } }, ASOF), 'flood-risk');
    expect(high.tone).toBe('caution');
    const miss = findById(buildEnvironmentContract({ ...full, floodRisk: null }, ASOF), 'flood-risk-missing');
    expect(miss.fallbackAction.type).toBe('url');
  });

  test('air-quality: aqi measure, tone from category color (AC-3)', () => {
    const a = findById(buildEnvironmentContract(full, ASOF), 'air-quality');
    expect(a.claim.measure).toEqual({ value: 38, unit: 'aqi' });
    expect(a.bucket).toBe('consider');
    expect(a.tone).toBe('favorable'); // green
    const bad = findById(buildEnvironmentContract({ ...full, airQuality: { aqi: 165, category: { label: 'Unhealthy', color: 'red' }, primaryPollutant: 'PM2.5' } }, ASOF), 'air-quality');
    expect(bad.tone).toBe('caution');
  });

  test('road-noise: dnl measure, modeled true when estimated (AC-4)', () => {
    const measured = findById(buildEnvironmentContract(full, ASOF), 'road-noise');
    expect(measured.claim.measure).toEqual({ value: 52, unit: 'dnl_db' });
    expect(measured.provenance.modeled).toBe(false);
    const est = findById(buildEnvironmentContract({ ...full, roadNoise: { dnl: 65, source: 'estimated from highway proximity', category: { label: 'Moderate', color: 'gold', hint: 'approaching standard' } } }, ASOF), 'road-noise');
    expect(est.provenance.modeled).toBe(true);
    expect(est.tone).toBe('neutral'); // gold
  });

  test('water-quality: violations count drives tone (AC-5)', () => {
    const clean = findById(buildEnvironmentContract(full, ASOF), 'water-quality');
    expect(clean.claim.measure).toEqual({ value: 0, unit: 'violation_count' });
    expect(clean.tone).toBe('favorable');
    const dirty = findById(buildEnvironmentContract({ ...full, waterQuality: { systemName: 'Rural Water', violations: [{ x: 1 }, { x: 2 }] } }, ASOF), 'water-quality');
    expect(dirty.claim.measure.value).toBe(2);
    expect(dirty.tone).toBe('caution');
  });

  test('radon: tone from zone, modeled:true, test recommendation (AC-6)', () => {
    const z2 = findById(buildEnvironmentContract(full, ASOF), 'radon');
    expect(z2.tone).toBe('neutral');
    expect(z2.provenance.modeled).toBe(true);
    expect(z2.defaultCopy.toLowerCase()).toMatch(/test/);
    expect(findById(buildEnvironmentContract({ ...full, radon: { zone: 1 } }, ASOF), 'radon').tone).toBe('caution');
    expect(findById(buildEnvironmentContract({ ...full, radon: { zone: 3 } }, ASOF), 'radon').tone).toBe('favorable');
  });

  test('hazard-proximity: caution when flagged; EPA ECHO url; no demographics (AC-7, CONSTRAINT-002)', () => {
    const clean = findById(buildEnvironmentContract(full, ASOF), 'hazard-proximity');
    expect(clean.tone).toBe('neutral');
    const flagged = findById(buildEnvironmentContract({ ...full, ejscreen: { superfundPct: 88, rmpPct: 40, tsdfPct: 30, flagged: true } }, ASOF), 'hazard-proximity');
    expect(flagged.tone).toBe('caution');
    expect(flagged.fallbackAction.type).toBe('url');
    // No demographic terms anywhere.
    const json = JSON.stringify(buildEnvironmentContract({ ...full, ejscreen: { superfundPct: 88, rmpPct: 40, tsdfPct: 30, flagged: true } }, ASOF)).toLowerCase();
    for (const term of ['minority', 'income', 'race', 'demographic', 'poverty']) expect(json).not.toContain(term);
  });

  test('no score/grade/rating; no color/category leak (AC-8, CONSTRAINT-001/008)', () => {
    const c = buildEnvironmentContract(full, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c);
    for (const key of ['"color"', '"category"', '"primaryPollutant"', '"superfundPct"']) {
      expect(json).not.toContain(key);
    }
  });

  test('provenanceSummary dedupes the EPA/FEMA sources', () => {
    const sources = buildEnvironmentContract(full, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toEqual(expect.arrayContaining(['FEMA NFHL', 'EPA AirNow']));
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildEnvironmentContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-clean': full,
    'harlan-ky-high-radon': { ...full, radon: { zone: 1 }, roadNoise: { dnl: 42, source: 'estimated', category: { label: 'Very Quiet', color: 'green', hint: 'well below threshold' } } },
    'jeffersonville-in-flood-and-hazard': {
      airQuality: { aqi: 72, category: { label: 'Moderate', color: 'gold', description: 'Acceptable for most.' }, primaryPollutant: 'Ozone' },
      floodRisk: { zone: 'AE', risk: 'High', insuranceRequired: true, description: '1% annual flood chance with base flood elevation.' },
      roadNoise: { dnl: 66, source: 'BTS', category: { label: 'Elevated', color: 'orange', hint: 'above FHWA standard' } },
      waterQuality: { systemName: 'Jeffersonville Water', violations: [{ code: 'TT' }] },
      radon: { zone: 2 },
      ejscreen: { superfundPct: 82, rmpPct: 78, tsdfPct: 55, flagged: true },
    },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildEnvironmentContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
