'use strict';

// FR-094 — climate contract builder (rollout #15). Consumes climateHistory only; flood/AQI/radon are
// environment-owned (FR-090). Value-neutral facts; external indices as measures, no composite score.

const { buildClimateContract } = require('../../../src/modules/climate/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', state: 'KY', county: 'Scott County', degraded: false };

const base = () => ({
  seismic: { pga: 0.06, band: 'low', label: 'Low seismic hazard', color: 'green', promote: false, narrative: 'USGS models low earthquake ground motion here — about 0.06g.', ss: 0.5, s1: 0.2, sds: 0.4 },
  climateNormals: { annual: { daysAbove90: 18, daysAbove95: 4, daysBelow32: 95 }, stationName: 'LEXINGTON', normalsSource: 'NOAA' },
  femaDeclarations: { weatherRelated: [{}, {}, {}], all: [], count: 3 },
  glance: { lastSignificantEvent: { type: 'Flood', year: 2021 } },
  watershed: { topographicPosition: 'lowpoint', elevations: [800, 820, 830, 815, 825], named: { huc12Name: 'Elkhorn Creek', basinName: 'Kentucky River' } },
  preparedness: { emergencySystem: { tier: 1, name: 'Smart911', url: 'https://smart911.com', searchUrl: 'https://google.com/search?q=x', note: null }, roadPriority: null },
});

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildClimateContract', () => {
  test('absent climateHistory -> null (AC-10)', () => {
    expect(buildClimateContract(null, ASOF)).toBeNull();
    expect(buildClimateContract(undefined, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-2)', () => {
    const c = buildClimateContract(base(), ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('climate');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('seismic-hazard: pga measure, tone/bucket from band, no graded-label leak (AC-3)', () => {
    const low = findById(buildClimateContract(base(), ASOF), 'seismic-hazard');
    expect(low.claim.measure).toEqual({ value: 0.06, unit: 'g_pga' });
    expect(low.bucket).toBe('cool');
    expect(low.tone).toBe('favorable');
    expect(low.provenance).toMatchObject({ source: 'USGS ASCE 7-16', modeled: false });
    expect(low.defaultCopy).toContain('USGS');

    const hi = base(); hi.seismic = { ...hi.seismic, pga: 0.35, band: 'high', promote: true };
    const sHi = findById(buildClimateContract(hi, ASOF), 'seismic-hazard');
    expect(sHi.bucket).toBe('check');
    expect(sHi.tone).toBe('caution');

    // no internal seismic keys leak; no graded-label TEXT leak (CONSTRAINT-001/008).
    // (fallbackAction.label is a legitimate schema field, so check keys precisely, not the substring.)
    const json = JSON.stringify(buildClimateContract(base(), ASOF));
    for (const key of ['"band"', '"color"', '"promote"', '"ss"', '"sds"', '"s1"']) {
      expect(json).not.toContain(key);
    }
    expect(json.toLowerCase()).not.toContain('seismic hazard'); // the graded label text
    expect(low.claim).not.toHaveProperty('band');
  });

  test('seismic absent -> no finding', () => {
    const ch = base(); ch.seismic = null;
    expect(findById(buildClimateContract(ch, ASOF), 'seismic-hazard')).toBeUndefined();
  });

  test('hot-days / cold-days: days_per_year, modeled flag from normalsSource (AC-4)', () => {
    const c = buildClimateContract(base(), ASOF);
    expect(findById(c, 'hot-days').claim.measure).toEqual({ value: 18, unit: 'days_per_year' });
    expect(findById(c, 'cold-days').claim.measure).toEqual({ value: 95, unit: 'days_per_year' });
    expect(findById(c, 'hot-days').provenance).toMatchObject({ source: 'NOAA 30-yr normals', modeled: false });
    expect(findById(c, 'hot-days').bucket).toBe('cool');
    expect(findById(c, 'hot-days').tone).toBe('neutral');

    const model = base(); model.climateNormals = { ...model.climateNormals, normalsSource: 'model' };
    expect(findById(buildClimateContract(model, ASOF), 'hot-days').provenance).toMatchObject({ source: 'Open-Meteo ERA5 modeled normals', modeled: true });
  });

  test('disaster-history: 0 -> cool/favorable, >0 -> consider/neutral (AC-5)', () => {
    const big = findById(buildClimateContract(base(), ASOF), 'disaster-history');
    expect(big.claim.measure).toEqual({ value: 3, unit: 'federal_disaster_declarations' });
    expect(big.bucket).toBe('consider');
    expect(big.tone).toBe('neutral');
    expect(big.defaultCopy).toMatch(/2021|Flood/);

    const none = base(); none.femaDeclarations = { weatherRelated: [], all: [], count: 0 };
    const z = findById(buildClimateContract(none, ASOF), 'disaster-history');
    expect(z.bucket).toBe('cool');
    expect(z.tone).toBe('favorable');
    expect(z.claim.measure.value).toBe(0);
  });

  test('tornado-frequency: tone/bucket per tier; omitted when no state / Unknown (AC-6)', () => {
    const hi = findById(buildClimateContract(base(), ASOF), 'tornado-frequency'); // KY High
    expect(hi.bucket).toBe('check');
    expect(hi.tone).toBe('caution');
    expect(hi.claim.measure).toBeNull();
    expect(hi.provenance.modeled).toBe(true);

    const lo = findById(buildClimateContract(base(), { ...ASOF, state: 'CA' }), 'tornado-frequency');
    expect(lo.bucket).toBe('cool');
    expect(lo.tone).toBe('favorable');

    expect(findById(buildClimateContract(base(), { ...ASOF, state: '' }), 'tornado-frequency')).toBeUndefined();
    expect(findById(buildClimateContract(base(), { ...ASOF, state: 'ZZ' }), 'tornado-frequency')).toBeUndefined();
  });

  test('topographic-position: lowpoint->check/caution+instruction, uphill->cool/favorable, midslope omitted (AC-7)', () => {
    const low = findById(buildClimateContract(base(), ASOF), 'topographic-position');
    expect(low.bucket).toBe('check');
    expect(low.tone).toBe('caution');
    expect(low.fallbackAction.type).toBe('instruction');

    const up = base(); up.watershed = { ...up.watershed, topographicPosition: 'uphill' };
    const u = findById(buildClimateContract(up, ASOF), 'topographic-position');
    expect(u.bucket).toBe('cool');
    expect(u.tone).toBe('favorable');

    const mid = base(); mid.watershed = { ...mid.watershed, topographicPosition: 'midslope' };
    expect(findById(buildClimateContract(mid, ASOF), 'topographic-position')).toBeUndefined();
  });

  test('named-watershed (cool/neutral) and emergency-alerts (tier-1 url vs tier-2 searchUrl) (AC-8)', () => {
    const c = buildClimateContract(base(), ASOF);
    const w = findById(c, 'named-watershed');
    expect(w.bucket).toBe('cool');
    expect(w.tone).toBe('neutral');
    expect(w.defaultCopy).toContain('Elkhorn Creek');

    const a1 = findById(c, 'emergency-alerts');
    expect(a1.bucket).toBe('check');
    expect(a1.fallbackAction).toMatchObject({ type: 'url', value: 'https://smart911.com' });
    expect(a1.defaultCopy).toBe('Smart911');

    const t2 = base(); t2.preparedness = { emergencySystem: { tier: 2, name: null, url: 'https://guess.gov', searchUrl: 'https://google.com/search?q=alerts', note: 'Managed locally.' }, roadPriority: null };
    const a2 = findById(buildClimateContract(t2, ASOF), 'emergency-alerts');
    expect(a2.fallbackAction.value).toBe('https://google.com/search?q=alerts');
    expect(a2.defaultCopy).toBe('Managed locally.');
  });

  test('no score/grade/rating; no env-owned (flood/aqi/radon) leakage (AC-9, CONSTRAINT-001)', () => {
    const c = buildClimateContract(base(), ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c).toLowerCase();
    for (const banned of [/\bscore\b/, /\bgrade\b/, /\brating\b/]) {
      expect(json).not.toMatch(banned);
    }
    for (const key of ['floodrisk', '"aqi"', 'radon']) {
      expect(json).not.toContain(key);
    }
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN + Bozeman MT included.
describe('buildClimateContract — per-address snapshots', () => {
  const caHighSeismic = () => {
    const ch = base();
    ch.seismic = { pga: 0.42, band: 'very-high', label: 'Very high seismic hazard', color: 'red', promote: true, narrative: 'Seismically active country — about 0.42g.', ss: 1.5, s1: 0.6, sds: 1.0 };
    ch.femaDeclarations = { weatherRelated: [], all: [], count: 0 };
    ch.watershed = { topographicPosition: 'uphill', elevations: [], named: { huc12Name: 'Coyote Creek', basinName: null } };
    return ch;
  };
  const cases = {
    'georgetown-ky': [base(), { asOf: '2026-06', state: 'KY', county: 'Scott County' }],
    'jeffersonville-in': [base(), { asOf: '2026-06', state: 'IN', county: 'Clark County' }],
    'bozeman-mt': [base(), { asOf: '2026-06', state: 'MT', county: 'Gallatin County' }],
    'synthetic-ca-low-tornado-high-seismic': [caHighSeismic(), { asOf: '2026-06', state: 'CA', county: 'Santa Clara County' }],
  };
  for (const [name, [ch, opts]] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildClimateContract(ch, opts)).toMatchSnapshot();
    });
  }
});
