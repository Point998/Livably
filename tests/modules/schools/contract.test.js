'use strict';

// FR-081 — schools contract builder.

const { buildSchoolsContract } = require('../../../src/modules/schools/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const fullSchools = {
  public: [
    { level: 'Elementary', name: 'Garth Elementary', address: '100 Wishing Well Path, Georgetown, KY', distanceMiles: '0.8', driveTimeMinutes: 4 },
    { level: 'Middle', name: 'Scott County Middle', address: '1701 Cardinal Dr, Georgetown, KY', distanceMiles: '2.3', driveTimeMinutes: 12 },
    { level: 'High', name: 'Great Crossing High', address: '200 Great Crossing Dr, Georgetown, KY', distanceMiles: '4.1', driveTimeMinutes: 23 },
  ],
  private: [
    { name: 'St. John School', address: '419 W Main St, Georgetown, KY', distanceMiles: '1.5' },
    { name: 'Georgetown Christian Academy', address: '2300 Lexington Rd, Georgetown, KY', distanceMiles: '3.2' },
  ],
};

describe('buildSchoolsContract', () => {
  test('returns null on null / empty input', () => {
    expect(buildSchoolsContract(null, ASOF)).toBeNull();
    expect(buildSchoolsContract({ public: [null], private: [] }, ASOF)).toBeNull();
  });

  test('full input: schema-valid', () => {
    const c = buildSchoolsContract(fullSchools, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('schools');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('assigned-school headline: check / caution with instruction fallback (AC-3, CONSTRAINT-015)', () => {
    const a = buildSchoolsContract(fullSchools, ASOF).findings.find((f) => f.id === 'assigned-school');
    expect(a.bucket).toBe('check');
    expect(a.tone).toBe('caution');
    expect(a.fallbackAction).toMatchObject({ type: 'instruction' });
    expect(a.fallbackAction.value).toMatch(/district/i);
  });

  test('public findings carry place + measure; tone derives across drive-time tiers (AC-4)', () => {
    const c = buildSchoolsContract(fullSchools, ASOF);
    const elem = c.findings.find((f) => f.id === 'nearest-public-elementary');
    expect(elem.claim.place).toEqual({ name: 'Garth Elementary', address: '100 Wishing Well Path, Georgetown, KY' });
    expect(elem.claim.measure).toEqual({ value: 4, unit: 'drive_minutes' });
    expect(elem.tone).toBe('favorable');                                   // 4
    expect(c.findings.find((f) => f.id === 'nearest-public-middle').tone).toBe('neutral');  // 12
    expect(c.findings.find((f) => f.id === 'nearest-public-high').tone).toBe('caution');    // 23
  });

  test('public school with null drive time -> miles measure, neutral tone (AC-5)', () => {
    const s = { public: [{ level: 'Elementary', name: 'Rural Elem', address: 'Harlan, KY', distanceMiles: '6.4', driveTimeMinutes: null }], private: [] };
    const elem = buildSchoolsContract(s, ASOF).findings.find((f) => f.id === 'nearest-public-elementary');
    expect(elem.claim.measure).toEqual({ value: 6.4, unit: 'miles' });
    expect(elem.tone).toBe('neutral');
  });

  test('each private school is its own finding with place + miles measure, bucket cool (AC-6)', () => {
    const c = buildSchoolsContract(fullSchools, ASOF);
    const priv = c.findings.filter((f) => f.id.startsWith('private-school-'));
    expect(priv).toHaveLength(2);
    expect(priv[0].bucket).toBe('cool');
    expect(priv[0].claim.place).toEqual({ name: 'St. John School', address: '419 W Main St, Georgetown, KY' });
    expect(priv[0].claim.measure).toEqual({ value: 1.5, unit: 'miles' });
  });

  test('no finding carries a numeric score/grade/rating (CONSTRAINT-001)', () => {
    for (const f of buildSchoolsContract(fullSchools, ASOF).findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
  });

  test('the contract carries no color anywhere (CONSTRAINT-008)', () => {
    expect(JSON.stringify(buildSchoolsContract(fullSchools, ASOF))).not.toMatch(/"color"/);
  });

  test('cross-state public school -> tone caution + note in defaultCopy (FR-082)', () => {
    const s = { public: [{ level: 'Elementary', name: 'Louisville Elementary', address: 'Louisville, KY', distanceMiles: '3.0', driveTimeMinutes: 9, crossState: true, crossStateNote: 'The nearest public elementary school option is in KY — no in-state option was found nearby. Confirm school zoning with your district.' }], private: [] };
    const elem = buildSchoolsContract(s, ASOF).findings.find((f) => f.id === 'nearest-public-elementary');
    expect(elem.tone).toBe('caution');
    expect(elem.defaultCopy).toMatch(/KY/);
  });

  test('private-only input still produces a valid contract', () => {
    const c = buildSchoolsContract({ public: [], private: fullSchools.private }, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.findings.some((f) => f.id === 'assigned-school')).toBe(true);
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildSchoolsContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': fullSchools,
    'harlan-ky-rural': { public: [{ level: 'Elementary', name: 'Harlan Independent Elementary', address: '420 E Central St, Harlan, KY', distanceMiles: '1.1', driveTimeMinutes: 6 }, { level: 'High', name: 'Harlan High', address: '420 E Central St, Harlan, KY', distanceMiles: '1.2', driveTimeMinutes: 7 }], private: [] },
    // Jeffersonville IN: getSchoolRatings does NOT cross-state filter (see spec); contract
    // serializes whatever it returns. Snapshot documents current behavior pending the cross-state FR.
    'jeffersonville-in': { public: [{ level: 'Elementary', name: 'Spring Hill Elementary', address: '2901 Allison Ln, Jeffersonville, IN', distanceMiles: '0.9', driveTimeMinutes: 5 }, { level: 'High', name: 'Jeffersonville High', address: '2315 Allison Ln, Jeffersonville, IN', distanceMiles: '1.4', driveTimeMinutes: 8 }], private: [{ name: 'Sacred Heart School', address: '1842 E 8th St, Jeffersonville, IN', distanceMiles: '2.0' }] },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildSchoolsContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
