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
  // FR-095 — sensory ambiance (rollout #16)
  airports: [{ name: 'Bluegrass Airport', distanceMiles: 12.34, lat: 38.04, lng: -84.6 }],
  rail: { type: 'rail', name: 'CSX Line', distanceMiles: 1.42 },
  lightPollution: { bortle: 5, label: 'Suburban sky', desc: 'The Milky Way is a faint smudge on a good night.' },
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
    // FR-095: ambiance must not leak the raw lightPollution structured keys (desc/bortle).
    // NB: "label" is a legitimate FallbackActionSchema key, so it is intentionally NOT asserted here.
    for (const key of ['"color"', '"category"', '"primaryPollutant"', '"superfundPct"', '"desc"', '"bortle"']) {
      expect(json).not.toContain(key);
    }
  });

  test('provenanceSummary dedupes the EPA/FEMA sources', () => {
    const sources = buildEnvironmentContract(full, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toEqual(expect.arrayContaining(['FEMA NFHL', 'EPA AirNow']));
  });
});

// FR-095 — sensory ambiance findings (rollout #16). Airports / rail / light pollution.
describe('buildEnvironmentContract — ambiance findings (FR-095)', () => {
  test('airport-noise: consider bucket, miles measure, tone by distance band (AC-2)', () => {
    const f = findById(buildEnvironmentContract(full, ASOF), 'airport-noise');
    expect(f.bucket).toBe('consider');
    expect(f.claim.measure).toEqual({ value: 12.3, unit: 'miles' });
    expect(f.tone).toBe('neutral'); // 12.3 mi -> 5..15 band
    expect(f.provenance.source).toBe('Google Places');
    expect(f.provenance.modeled).toBe(false);
    expect(f.fallbackAction).toBeNull();
    expect(f.defaultCopy).toContain('Bluegrass Airport');

    const near = findById(buildEnvironmentContract({ ...full, airports: [{ name: 'Muni', distanceMiles: 3.1, lat: 1, lng: 1 }] }, ASOF), 'airport-noise');
    expect(near.tone).toBe('caution');
    const far = findById(buildEnvironmentContract({ ...full, airports: [{ name: 'Regional', distanceMiles: 18.2, lat: 1, lng: 1 }] }, ASOF), 'airport-noise');
    expect(far.tone).toBe('favorable');
  });

  test('airport-noise: OSM fallback flips provenance source (AC-2, FR-070 parity)', () => {
    const f = findById(buildEnvironmentContract({ ...full, airports: [{ name: 'Aerodrome', distanceMiles: 9.0, lat: 1, lng: 1, source: 'osm' }] }, ASOF), 'airport-noise');
    expect(f.provenance.source).toBe('OpenStreetMap');
  });

  test('airport-noise: none in range -> favorable, null measure, no fallbackAction (AC-2)', () => {
    const f = findById(buildEnvironmentContract({ ...full, airports: null }, ASOF), 'airport-noise');
    expect(f.tone).toBe('favorable');
    expect(f.claim.measure).toBeNull();
    expect(f.fallbackAction).toBeNull();
    expect(f.defaultCopy.toLowerCase()).toContain('no airports');
    // empty array behaves like none
    expect(findById(buildEnvironmentContract({ ...full, airports: [] }, ASOF), 'airport-noise').tone).toBe('favorable');
  });

  test('rail-proximity: tone by distance band; none -> favorable; no fallbackAction (AC-3)', () => {
    const f = findById(buildEnvironmentContract(full, ASOF), 'rail-proximity');
    expect(f.bucket).toBe('consider');
    expect(f.claim.measure).toEqual({ value: 1.42, unit: 'miles' });
    expect(f.tone).toBe('favorable'); // 1.42 mi -> >=0.75
    expect(f.fallbackAction).toBeNull();
    expect(f.provenance.source).toBe('OpenStreetMap');

    const close = findById(buildEnvironmentContract({ ...full, rail: { type: 'light_rail', name: 'TARC', distanceMiles: 0.2 } }, ASOF), 'rail-proximity');
    expect(close.tone).toBe('caution');
    const mid = findById(buildEnvironmentContract({ ...full, rail: { type: 'rail', name: 'CSX', distanceMiles: 0.5 } }, ASOF), 'rail-proximity');
    expect(mid.tone).toBe('neutral');
    const none = findById(buildEnvironmentContract({ ...full, rail: null }, ASOF), 'rail-proximity');
    expect(none.tone).toBe('favorable');
    expect(none.claim.measure).toBeNull();
    expect(none.fallbackAction).toBeNull();
    expect(none.defaultCopy.toLowerCase()).toContain('no rail');
  });

  test('light-pollution: cool bucket, bortle measure, tone, modeled true (AC-4)', () => {
    const f = findById(buildEnvironmentContract(full, ASOF), 'light-pollution');
    expect(f.bucket).toBe('cool');
    expect(f.claim.measure).toEqual({ value: 5, unit: 'bortle_class' });
    expect(f.tone).toBe('neutral'); // bortle 5
    expect(f.provenance.source).toBe('U.S. Census ACS / OpenStreetMap');
    expect(f.provenance.modeled).toBe(true);
    expect(f.fallbackAction).toBeNull();
    expect(f.defaultCopy).toContain('Suburban sky');

    const dark = findById(buildEnvironmentContract({ ...full, lightPollution: { bortle: 3, label: 'Rural dark sky', desc: 'Milky Way clearly visible.' } }, ASOF), 'light-pollution');
    expect(dark.tone).toBe('favorable');
  });

  test('light-pollution: never caution (light level is not a hazard)', () => {
    const bright = findById(buildEnvironmentContract({ ...full, lightPollution: { bortle: 8, label: 'Urban sky', desc: 'Only the brightest stars.' } }, ASOF), 'light-pollution');
    expect(bright.tone).toBe('neutral');
  });

  test('ambiance findings ride along only when chapter already emits (AC-5 guard preserved)', () => {
    // health/safety absent but ambiance present -> still null (existing FR-090 contract).
    expect(buildEnvironmentContract({ airports: full.airports, rail: full.rail, lightPollution: full.lightPollution }, ASOF)).toBeNull();
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildEnvironmentContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-clean': full,
    'harlan-ky-high-radon': {
      ...full,
      radon: { zone: 1 },
      roadNoise: { dnl: 42, source: 'estimated', category: { label: 'Very Quiet', color: 'green', hint: 'well below threshold' } },
      // rural Appalachian: no airport, no rail in range, dark sky
      airports: null,
      rail: null,
      lightPollution: { bortle: 3, label: 'Rural dark sky', desc: 'The Milky Way is clearly visible with obvious structure.' },
    },
    'jeffersonville-in-flood-and-hazard': {
      airQuality: { aqi: 72, category: { label: 'Moderate', color: 'gold', description: 'Acceptable for most.' }, primaryPollutant: 'Ozone' },
      floodRisk: { zone: 'AE', risk: 'High', insuranceRequired: true, description: '1% annual flood chance with base flood elevation.' },
      roadNoise: { dnl: 66, source: 'BTS', category: { label: 'Elevated', color: 'orange', hint: 'above FHWA standard' } },
      waterQuality: { systemName: 'Jeffersonville Water', violations: [{ code: 'TT' }] },
      radon: { zone: 2 },
      ejscreen: { superfundPct: 82, rmpPct: 78, tsdfPct: 55, flagged: true },
      // border city: nearby airport (Louisville is across the river) + rail within town
      airports: [{ name: 'Louisville Muhammad Ali International', distanceMiles: 6.8, lat: 38.17, lng: -85.74 }],
      rail: { type: 'rail', name: 'CSX', distanceMiles: 0.31 },
      lightPollution: { bortle: 6, label: 'Bright suburban sky', desc: 'The Milky Way is at or below the threshold of visibility.' },
    },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildEnvironmentContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
