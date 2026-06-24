'use strict';

// FR-091 — growth contract builder (rollout #12). Permit trend + development activity + pipeline.
// CONSTRAINT-001: growth is value-neutral context — tone is neutral throughout, never a quality score.

const { buildGrowthContract } = require('../../../src/modules/growth/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const full = {
  permits: { current: 320, currentYear: 2024, prior: 250, priorYear: 2023, percentChange: 28, trend: 'rising' },
  newConstruction: { newConstructionPct: 22 }, // must be IGNORED (property owns it)
  establishments: [
    { name: 'New Retail Plaza', label: 'Shopping', distanceMiles: 0.8, source: 'google' },
    { name: 'Medical Office Bldg', label: 'Office', distanceMiles: 1.1, source: 'google' },
    { name: 'Corner Cafe', label: 'Dining', distanceMiles: 0.4, source: 'google' },
    { name: 'Auto Center', label: 'Retail', distanceMiles: 1.5, source: 'google' },
  ],
  namedProjects: [
    { name: 'Scott County Logistics Park', status: 'Under Construction' },
    { name: 'Downtown Mixed-Use', status: 'Approved' },
  ],
  locationInfo: { state: 'KY', city: 'Georgetown' },
};

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildGrowthContract', () => {
  test('permits null + no establishments + no projects -> null (AC-7)', () => {
    expect(buildGrowthContract({ permits: null, establishments: [], namedProjects: [] }, ASOF)).toBeNull();
    expect(buildGrowthContract(null, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-1)', () => {
    const c = buildGrowthContract(full, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('growth');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('permit-trend: building_permits measure, consider/neutral, change+trend in copy (AC-2)', () => {
    const p = findById(buildGrowthContract(full, ASOF), 'permit-trend');
    expect(p.claim.measure).toEqual({ value: 320, unit: 'building_permits' });
    expect(p.bucket).toBe('consider');
    expect(p.tone).toBe('neutral');
    expect(p.defaultCopy).toMatch(/28%/);
    expect(p.defaultCopy.toLowerCase()).toMatch(/ris/); // rising
    expect(p.provenance).toMatchObject({ source: 'Census Building Permits Survey', modeled: false });
  });

  test('permits absent -> permit-trend-missing with instruction fallback (AC-3, CONSTRAINT-015)', () => {
    const c = buildGrowthContract({ permits: null, establishments: full.establishments, namedProjects: [] }, ASOF);
    const miss = findById(c, 'permit-trend-missing');
    expect(miss.bucket).toBe('check');
    expect(miss.fallbackAction.type).toBe('instruction');
    expect(findById(c, 'permit-trend')).toBeUndefined();
  });

  test('development-activity: count measure, cool/neutral; OSM source -> modeled:true (AC-4)', () => {
    const d = findById(buildGrowthContract(full, ASOF), 'development-activity');
    expect(d.claim.measure).toEqual({ value: 4, unit: 'count' });
    expect(d.bucket).toBe('cool');
    expect(d.tone).toBe('neutral');
    expect(d.defaultCopy).toContain('New Retail Plaza');
    expect(d.provenance).toMatchObject({ source: 'Google Places', modeled: false });
    const osm = findById(buildGrowthContract({ ...full, establishments: [{ name: 'OSM Shop', label: 'Retail', distanceMiles: 0.5, source: 'osm' }] }, ASOF), 'development-activity');
    expect(osm.provenance).toMatchObject({ source: 'OpenStreetMap', modeled: true });
  });

  test('named-projects: count measure, cool/neutral, names+status in copy (AC-5)', () => {
    const n = findById(buildGrowthContract(full, ASOF), 'named-projects');
    expect(n.claim.measure).toEqual({ value: 2, unit: 'count' });
    expect(n.bucket).toBe('cool');
    expect(n.tone).toBe('neutral');
    expect(n.defaultCopy).toContain('Scott County Logistics Park');
    expect(n.defaultCopy).toMatch(/Under Construction/i);
  });

  test('newConstruction is ignored (property owns it)', () => {
    const c = buildGrowthContract(full, ASOF);
    expect(c.findings.some((f) => /new-?construction/.test(f.id))).toBe(false);
    expect(JSON.stringify(c)).not.toContain('newConstructionPct');
  });

  test('all tones neutral; no score/grade/rating; no color/trend/label leak (AC-6, CONSTRAINT-001/008)', () => {
    const c = buildGrowthContract(full, ASOF);
    for (const f of c.findings) {
      expect(f.tone).toBe('neutral');
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c);
    // (provenance.source is a legitimate schema field; not an internal leak.)
    for (const key of ['"color"', '"trend"', '"label"', '"distanceMiles"']) {
      expect(json).not.toContain(key);
    }
  });

  test('provenanceSummary dedupes', () => {
    const sources = buildGrowthContract(full, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toContain('Census Building Permits Survey');
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildGrowthContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-rising': full,
    'harlan-ky-sparse': { permits: null, establishments: [], namedProjects: [{ name: 'Harlan Main St Revitalization', status: 'Approved' }], locationInfo: { state: 'KY', city: 'Harlan' } },
    'jeffersonville-in-declining': {
      permits: { current: 140, currentYear: 2024, prior: 190, priorYear: 2023, percentChange: -26, trend: 'declining' },
      establishments: [{ name: 'Riverfront Retail', label: 'Shopping', distanceMiles: 0.6, source: 'osm' }],
      namedProjects: [],
      locationInfo: { state: 'IN', city: 'Jeffersonville' },
    },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildGrowthContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
