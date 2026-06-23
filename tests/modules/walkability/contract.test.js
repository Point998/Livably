'use strict';

// FR-089 — walkability contract builder (rollout #10). Counts-only — NO composite score
// (CONSTRAINT-001). Surfaces per-category walkable destination counts as factual measures.

const { buildWalkabilityContract } = require('../../../src/modules/walkability/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

// NOTE: score/category are present in the INPUT (the SSR template still uses them) — the builder
// must NOT read or emit them.
const urban = {
  score: 88,
  category: { label: 'Very Walkable', color: 'lightgreen', description: '…' },
  counts: { Grocery: 3, Dining: 9, Transit: 2, Park: 4, Pharmacy: 1 },
  destinations: [
    { label: 'Grocery', icon: '🛒', name: 'Downtown Market', distanceMiles: 0.2, walkMinutes: 4 },
    { label: 'Dining', icon: '🍽️', name: 'Corner Bistro', distanceMiles: 0.1, walkMinutes: 2 },
    { label: 'Pharmacy', icon: '💊', name: 'Main St Rx', distanceMiles: 0.3, walkMinutes: 6 },
  ],
  isProxy: true, source: 'google',
};
const carDependent = { score: 8, category: { label: 'Very Car-Dependent', color: 'red' }, counts: { Grocery: 0, Dining: 0, Transit: 0, Park: 0, Pharmacy: 0 }, destinations: [], isProxy: true, source: 'google' };
const unavailable = { score: null, category: { label: 'Walkability Unavailable', color: 'gold' }, counts: {}, destinations: [], isProxy: true, source: 'unavailable' };
const osmInput = { score: 40, category: { label: 'Car-Dependent', color: 'orange' }, counts: { Grocery: 1, Dining: 2, Park: 1, Transit: 0, Pharmacy: 0 }, destinations: [{ label: 'Grocery', icon: '🛒', name: 'OSM Market', distanceMiles: 0.4, walkMinutes: 8 }], isProxy: true, source: 'osm' };

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildWalkabilityContract', () => {
  test('absent input -> null (AC-8)', () => {
    expect(buildWalkabilityContract(null, ASOF)).toBeNull();
    expect(buildWalkabilityContract(undefined, ASOF)).toBeNull();
  });

  test('urban: schema-valid, chapterId/version (AC-2)', () => {
    const c = buildWalkabilityContract(urban, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('walkability');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('one walkable-{category} cool/favorable finding per count>0, count measure (AC-3)', () => {
    const c = buildWalkabilityContract(urban, ASOF);
    const g = findById(c, 'walkable-grocery');
    expect(g.bucket).toBe('cool');
    expect(g.tone).toBe('favorable');
    expect(g.claim.measure).toEqual({ value: 3, unit: 'places_within_walk' });
    expect(findById(c, 'walkable-dining').claim.measure.value).toBe(9);
    expect(findById(c, 'walkable-pharmacy').claim.measure.value).toBe(1);
  });

  test('a category with count 0/absent -> no finding (AC-4)', () => {
    const c = buildWalkabilityContract({ ...urban, counts: { Grocery: 2, Dining: 0 } }, ASOF);
    expect(findById(c, 'walkable-grocery')).toBeDefined();
    expect(findById(c, 'walkable-dining')).toBeUndefined();
    expect(findById(c, 'walkable-park')).toBeUndefined();
  });

  test('nearest destination -> name + walk minutes in defaultCopy (AC-5)', () => {
    const g = findById(buildWalkabilityContract(urban, ASOF), 'walkable-grocery');
    expect(g.defaultCopy).toContain('Downtown Market');
    expect(g.defaultCopy).toMatch(/4\s*min/);
  });

  test('no walkable destinations -> single walkability-pointer with Walk Score url (AC-6, CONSTRAINT-015)', () => {
    const c = buildWalkabilityContract(carDependent, ASOF);
    expect(c.findings).toHaveLength(1);
    const p = findById(c, 'walkability-pointer');
    expect(p.bucket).toBe('check');
    expect(p.claim.measure).toBeNull();
    expect(p.fallbackAction).toMatchObject({ type: 'url', value: 'https://www.walkscore.com/' });
    expect(c.findings.some((f) => /^walkable-/.test(f.id))).toBe(false);
  });

  test('source unavailable -> walkability-pointer (AC-6)', () => {
    const c = buildWalkabilityContract(unavailable, ASOF);
    expect(findById(c, 'walkability-pointer')).toBeDefined();
  });

  test('NO score/category/color/grade anywhere in the contract (AC-7, CONSTRAINT-001/008)', () => {
    const c = buildWalkabilityContract(urban, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c);
    for (const key of ['"score"', '"category"', '"color"', '"grade"']) {
      expect(json).not.toContain(key);
    }
  });

  test('OSM source -> provenance modeled:true, source OpenStreetMap (AC-9)', () => {
    const g = findById(buildWalkabilityContract(osmInput, ASOF), 'walkable-grocery');
    expect(g.provenance).toMatchObject({ source: 'OpenStreetMap', modeled: true });
  });

  test('provenanceSummary dedupes', () => {
    const sources = buildWalkabilityContract(urban, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toContain('Google Places');
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildWalkabilityContract — per-address snapshots', () => {
  const cases = {
    'urban-google': urban,
    'car-dependent-pointer': carDependent,
    'jeffersonville-in-osm': { ...osmInput, destinations: [{ label: 'Grocery', icon: '🛒', name: 'Schimpff\'s corner store', distanceMiles: 0.3, walkMinutes: 6 }, { label: 'Dining', icon: '🍽️', name: 'Parlour', distanceMiles: 0.2, walkMinutes: 4 }] },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildWalkabilityContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
