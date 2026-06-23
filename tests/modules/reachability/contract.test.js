'use strict';

// FR-085 — reachability contract builder (rollout #6).

const { buildReachabilityContract } = require('../../../src/modules/reachability/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const rec = (name, address, mins) => ({
  name, address, location: { lat: 38, lng: -84 }, driveTimeMinutes: mins,
  bandRung: 1, mode: 'suburban', centroidDriveMinutes: mins,
});
const osm = (name, miles) => ({
  name, address: null, location: { lat: 38, lng: -84 },
  driveTimeMinutes: null, distanceMiles: miles, proximitySource: 'osm-straightline',
});

const grocery = [rec('Kroger', '100 Main St, Georgetown, KY', 6), rec('Aldi', '200 Oak St', 9)];
const pharmacy = rec('CVS', '300 Elm St, Georgetown, KY', 5);
const gasStation = rec("Casey's", '400 Pine St, Georgetown, KY', 4);

const fullInput = { grocery, pharmacy, gasStation };

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildReachabilityContract', () => {
  test('all-absent input -> null (AC-9)', () => {
    expect(buildReachabilityContract({ grocery: null, pharmacy: null, gasStation: null }, ASOF)).toBeNull();
    expect(buildReachabilityContract(null, ASOF)).toBeNull();
    expect(buildReachabilityContract({ grocery: [] }, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-1)', () => {
    const c = buildReachabilityContract(fullInput, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('reachability');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('nearest-grocery uses grocery[0], place + drive_minutes measure, modeled false (AC-2)', () => {
    const g = findById(buildReachabilityContract(fullInput, ASOF), 'nearest-grocery');
    expect(g.claim.place).toEqual({ name: 'Kroger', address: '100 Main St, Georgetown, KY' });
    expect(g.claim.measure).toEqual({ value: 6, unit: 'drive_minutes' });
    expect(g.bucket).toBe('consider');
    expect(g.provenance).toMatchObject({ source: 'Google Places', modeled: false });
  });

  test('driveTone derives across tiers (AC-3)', () => {
    const tone = (m) => findById(buildReachabilityContract({ gasStation: rec('G', 'A', m) }, ASOF), 'nearest-gas').tone;
    expect(tone(8)).toBe('favorable');  // <= 10
    expect(tone(15)).toBe('neutral');   // <= 20
    expect(tone(28)).toBe('caution');   // > 20
  });

  test('grocery coherenceWarning -> caution + reason in defaultCopy (AC-4, CONSTRAINT-010)', () => {
    const far = { ...rec('Distant Kroger', '9 Far Rd', 52), coherenceWarning: true, coherenceReason: 'grocery store drive time of 52 min exceeds 45 min threshold for suburban address' };
    const g = findById(buildReachabilityContract({ grocery: [far] }, ASOF), 'nearest-grocery');
    expect(g.tone).toBe('caution');
    expect(g.defaultCopy).toContain('exceeds 45 min');
  });

  test('pharmacy crossStateWarning -> caution + note in defaultCopy (AC-5, FR-083/CONSTRAINT-006)', () => {
    const xs = { ...rec('Louisville CVS', '1 KY Ave', 9), crossStateWarning: true, crossStateNote: 'This pharmacy is in KY. No in-state pharmacy was found within the search radius.' };
    const p = findById(buildReachabilityContract({ pharmacy: xs }, ASOF), 'nearest-pharmacy');
    expect(p.tone).toBe('caution');
    expect(p.defaultCopy).toContain('No in-state pharmacy');
  });

  test('OSM straight-line -> straight_line_miles measure, modeled true, null address coerced (AC-6)', () => {
    const c = buildReachabilityContract({ grocery: [osm('OSM Grocer', 1.2)] }, ASOF);
    const g = findById(c, 'nearest-grocery');
    expect(g.claim.measure).toEqual({ value: 1.2, unit: 'straight_line_miles' });
    expect(g.provenance).toMatchObject({ source: 'OpenStreetMap', modeled: true });
    expect(typeof g.claim.place.address).toBe('string');
    expect(g.claim.place.address.length).toBeGreaterThan(0);
    expect(g.defaultCopy).toMatch(/straight-line/i);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
  });

  test('missing destination -> *-missing check finding with url fallback (AC-7, CONSTRAINT-015)', () => {
    const c = buildReachabilityContract({ grocery: null, pharmacy, gasStation }, ASOF);
    const miss = findById(c, 'nearest-grocery-missing');
    expect(miss.bucket).toBe('check');
    expect(miss.claim.measure).toBeNull();
    expect(miss.fallbackAction.type).toBe('url');
    expect(findById(c, 'nearest-grocery')).toBeUndefined();
  });

  test('no score/grade/rating; no leaked internal keys (AC-8, CONSTRAINT-001/008)', () => {
    const c = buildReachabilityContract(fullInput, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c);
    for (const key of ['"color"', '"bandRung"', '"mode"', '"coherenceWarning"', '"proximitySource"', '"centroidDriveMinutes"', '"location"']) {
      expect(json).not.toContain(key);
    }
  });

  test('provenanceSummary dedupes sources', () => {
    const sources = buildReachabilityContract({ grocery: [osm('A', 1)], pharmacy, gasStation }, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toEqual(expect.arrayContaining(['Google Places', 'OpenStreetMap']));
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildReachabilityContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': fullInput,
    'harlan-ky-osm-and-coherence': {
      grocery: [{ ...rec('Harlan IGA', '101 Main St, Harlan, KY', 48), coherenceWarning: false }],
      pharmacy: osm('OSM Pharmacy', 3.4),
      gasStation: rec('Harlan Fuel', '55 Hwy 421, Harlan, KY', 12),
    },
    'jeffersonville-in-crossstate-pharmacy': {
      grocery: [rec('Kroger Jeffersonville', '2100 E 10th St, Jeffersonville, IN', 7)],
      pharmacy: { ...rec('UofL Pharmacy', '530 S Jackson St, Louisville, KY', 10), crossStateWarning: true, crossStateNote: 'This pharmacy is in KY. No in-state pharmacy was found within the search radius.' },
      gasStation: rec('Thorntons', '1400 E 10th St, Jeffersonville, IN', 5),
    },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildReachabilityContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
