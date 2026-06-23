'use strict';

// FR-086 — recreation contract builder (rollout #7).

const { buildRecreationContract } = require('../../../src/modules/recreation/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const rec = (name, address, mins) => ({
  name, address, location: { lat: 38, lng: -84 }, driveTimeMinutes: mins,
});
const osm = (name, miles) => ({
  name, address: null, location: { lat: 38, lng: -84 },
  driveTimeMinutes: null, distanceMiles: miles, proximitySource: 'osm-straightline',
});

const fullInput = {
  park: rec('Suffoletta Park', '1 Park Dr, Georgetown, KY', 4),
  coffeeShop: rec('Lock & Key Coffee', '101 Main St, Georgetown, KY', 7),
  library: rec('Scott County Public Library', '104 S Bradford Ln, Georgetown, KY', 5),
  recCenter: rec('Georgetown Rec Center', '100 Rec Dr, Georgetown, KY', 9),
  postOffice: rec('Georgetown Post Office', '200 Main St, Georgetown, KY', 3),
};

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildRecreationContract', () => {
  test('all-absent input -> null (AC-7)', () => {
    expect(buildRecreationContract({}, ASOF)).toBeNull();
    expect(buildRecreationContract(null, ASOF)).toBeNull();
    expect(buildRecreationContract({ park: null, coffeeShop: null, library: null, recCenter: null, postOffice: null }, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version, 5 cool findings (AC-1, AC-2)', () => {
    const c = buildRecreationContract(fullInput, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('recreation');
    expect(c.schemaVersion).toBe('1.0');
    expect(c.findings).toHaveLength(5);
    for (const f of c.findings) expect(f.bucket).toBe('cool');
  });

  test('park finding carries place + drive_minutes measure, modeled false (AC-2)', () => {
    const p = findById(buildRecreationContract(fullInput, ASOF), 'nearest-park');
    expect(p.claim.place).toEqual({ name: 'Suffoletta Park', address: '1 Park Dr, Georgetown, KY' });
    expect(p.claim.measure).toEqual({ value: 4, unit: 'drive_minutes' });
    expect(p.provenance).toMatchObject({ source: 'Google Places', modeled: false });
  });

  test('amenityTone: favorable <=10, neutral >10, never caution (AC-3)', () => {
    const tone = (m) => findById(buildRecreationContract({ park: rec('P', 'A', m) }, ASOF), 'nearest-park').tone;
    expect(tone(4)).toBe('favorable');
    expect(tone(10)).toBe('favorable');
    expect(tone(18)).toBe('neutral');
    expect(tone(40)).toBe('neutral'); // far amenity is neutral, NOT caution
  });

  test('OSM straight-line -> straight_line_miles measure, modeled true, null address coerced (AC-4)', () => {
    const c = buildRecreationContract({ library: osm('OSM Library', 0.8) }, ASOF);
    const l = findById(c, 'nearest-library');
    expect(l.claim.measure).toEqual({ value: 0.8, unit: 'straight_line_miles' });
    expect(l.provenance).toMatchObject({ source: 'OpenStreetMap', modeled: true });
    expect(typeof l.claim.place.address).toBe('string');
    expect(l.claim.place.address.length).toBeGreaterThan(0);
    expect(l.defaultCopy).toMatch(/straight-line/i);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
  });

  test('absent amenity is omitted, not flagged as missing (AC-5)', () => {
    const c = buildRecreationContract({ park: rec('P', 'A', 4), coffeeShop: null }, ASOF);
    expect(findById(c, 'nearest-park')).toBeDefined();
    expect(findById(c, 'nearest-coffee')).toBeUndefined();
    expect(c.findings.some((f) => /missing/.test(f.id))).toBe(false);
    expect(c.findings).toHaveLength(1);
  });

  test('no score/grade/rating; no leaked internal keys (AC-6, CONSTRAINT-001/008)', () => {
    const c = buildRecreationContract(fullInput, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c);
    for (const key of ['"color"', '"proximitySource"', '"location"', '"distanceMiles"']) {
      expect(json).not.toContain(key);
    }
  });

  test('provenanceSummary dedupes sources', () => {
    const sources = buildRecreationContract({ park: osm('A', 1), library: rec('L', 'addr', 5) }, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toEqual(expect.arrayContaining(['Google Places', 'OpenStreetMap']));
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildRecreationContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': fullInput,
    'harlan-ky-osm-and-absent': {
      park: rec('Harlan City Park', '100 Park St, Harlan, KY', 8),
      coffeeShop: osm('OSM Cafe', 2.1),
      library: rec('Harlan County Public Library', '107 N 3rd St, Harlan, KY', 11),
      recCenter: null,
      postOffice: rec('Harlan Post Office', '201 Central St, Harlan, KY', 9),
    },
    'jeffersonville-in': {
      park: rec('Duffy Park', '1300 Spring St, Jeffersonville, IN', 6),
      coffeeShop: rec('Red Yeti', '256 Spring St, Jeffersonville, IN', 5),
      library: rec('Jeffersonville Township Public Library', '211 E Court Ave, Jeffersonville, IN', 7),
      recCenter: rec('Ken Ellis Center', '724 Locust St, Jeffersonville, IN', 8),
      postOffice: rec('Jeffersonville Post Office', '1401 E 10th St, Jeffersonville, IN', 4),
    },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildRecreationContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
