'use strict';

// FR-088 — property contract builder (rollout #9). First non-located chapter.

const { buildPropertyContract } = require('../../../src/modules/property/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const soilWellDrained = {
  muname: 'Maury silt loam', drainagecl: 'Well drained', hydricrating: 'No', isHydric: false,
  drainageCategory: { label: 'Well drained', color: 'green', implication: 'Water drains readily. Low risk of basement moisture from soil conditions.' },
};
const soilPoor = {
  muname: 'Lowland clay', drainagecl: 'Poorly drained', hydricrating: 'Yes', isHydric: true,
  drainageCategory: { label: 'Poorly drained', color: 'red', implication: 'Wet soil most of the year. High basement moisture risk — thorough foundation inspection essential.' },
};

const eraOld = { medianYearBuilt: 1952, newConstructionPct: 4, context: { era: '1940s–50s construction', cautions: ['Lead paint presumed in original surfaces', 'Asbestos in insulation and building materials is common'] } };
const eraModern = { medianYearBuilt: 2015, newConstructionPct: 38, context: { era: 'Modern construction (2010s–present)', cautions: [] } };

const SOILWEB = 'https://casoilresource.lawr.ucdavis.edu/gmap/?loc=38.2,-84.5';

const full = { soil: soilWellDrained, soilwebUrl: SOILWEB, era: eraOld, housingAgeBands: null, locationInfo: { state: 'KY' } };

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildPropertyContract', () => {
  test('absent propIntel -> null (AC-8)', () => {
    expect(buildPropertyContract(null, ASOF)).toBeNull();
    expect(buildPropertyContract(undefined, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-1)', () => {
    const c = buildPropertyContract(full, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('property');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('construction-era: year_built measure, consider, neutral (AC-2)', () => {
    const e = findById(buildPropertyContract(full, ASOF), 'construction-era');
    expect(e.claim.measure).toEqual({ value: 1952, unit: 'year_built' });
    expect(e.bucket).toBe('consider');
    expect(e.tone).toBe('neutral');
    expect(e.provenance).toMatchObject({ source: 'Census ACS', modeled: false });
    expect(e.defaultCopy).toContain('1940s');
  });

  test('era-health-risks emitted only when cautions non-empty (AC-3)', () => {
    const withRisks = findById(buildPropertyContract(full, ASOF), 'era-health-risks');
    expect(withRisks.bucket).toBe('check');
    expect(withRisks.tone).toBe('caution');
    expect(withRisks.fallbackAction.type).toBe('instruction');
    expect(withRisks.defaultCopy).toMatch(/Lead paint/);
    // modern construction -> no era-health-risks
    const modern = buildPropertyContract({ ...full, era: eraModern }, ASOF);
    expect(findById(modern, 'era-health-risks')).toBeUndefined();
  });

  test('soil-drainage tone derives from color; favorable for well-drained (AC-4)', () => {
    const s = findById(buildPropertyContract(full, ASOF), 'soil-drainage');
    expect(s.bucket).toBe('check');
    expect(s.tone).toBe('favorable'); // green
    expect(s.claim.measure).toBeNull();
    expect(s.defaultCopy).toContain('Well drained');
    expect(s.provenance).toMatchObject({ source: 'USDA Soil Data Access', modeled: false });
  });

  test('isHydric / poorly-drained soil forces caution + hydric note (AC-4)', () => {
    const s = findById(buildPropertyContract({ ...full, soil: soilPoor }, ASOF), 'soil-drainage');
    expect(s.tone).toBe('caution');
    expect(s.defaultCopy.toLowerCase()).toMatch(/hydric|wetland/);
  });

  test('soil absent / no drainageCategory -> soil-missing with soilwebUrl fallback (AC-5, CONSTRAINT-015)', () => {
    const c = buildPropertyContract({ ...full, soil: null }, ASOF);
    const miss = findById(c, 'soil-missing');
    expect(miss.bucket).toBe('check');
    expect(miss.claim.measure).toBeNull();
    expect(miss.fallbackAction).toMatchObject({ type: 'url', value: SOILWEB });
    expect(findById(c, 'soil-drainage')).toBeUndefined();
  });

  test('new-construction: percent measure, cool, neutral (AC-6)', () => {
    const n = findById(buildPropertyContract(full, ASOF), 'new-construction');
    expect(n.claim.measure).toEqual({ value: 4, unit: 'percent' });
    expect(n.bucket).toBe('cool');
    expect(n.tone).toBe('neutral');
  });

  test('no score/grade/rating; no leaked internal keys (AC-7, CONSTRAINT-001/008)', () => {
    const c = buildPropertyContract({ ...full, soil: soilPoor }, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c);
    for (const key of ['"color"', '"drainagecl"', '"muname"', '"context"', '"hydricrating"']) {
      expect(json).not.toContain(key);
    }
  });

  test('provenanceSummary dedupes Census + USDA sources', () => {
    const sources = buildPropertyContract(full, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toEqual(expect.arrayContaining(['Census ACS', 'USDA Soil Data Access']));
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildPropertyContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': full,
    'harlan-ky-old-poor-drainage': { soil: soilPoor, soilwebUrl: SOILWEB, era: eraOld, housingAgeBands: null, locationInfo: { state: 'KY' } },
    'jeffersonville-in-modern': { soil: soilWellDrained, soilwebUrl: SOILWEB, era: eraModern, housingAgeBands: null, locationInfo: { state: 'IN' } },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildPropertyContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
