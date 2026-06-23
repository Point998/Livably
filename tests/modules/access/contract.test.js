'use strict';

// FR-087 — access (highway) contract builder (rollout #8). Last located-facility chapter.

const { buildAccessContract } = require('../../../src/modules/access/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const ramp = (name, address, mins, note = null) => ({
  name, address, location: { lat: 38, lng: -84 }, driveTimeMinutes: mins, note,
});

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildAccessContract', () => {
  test('absent highwayRamp -> null (AC-5)', () => {
    expect(buildAccessContract({ highwayRamp: null }, ASOF)).toBeNull();
    expect(buildAccessContract({}, ASOF)).toBeNull();
    expect(buildAccessContract(null, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version, exactly one finding (AC-1)', () => {
    const c = buildAccessContract({ highwayRamp: ramp('I-75', 'I-75 near Georgetown, KY', 6) }, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('access');
    expect(c.schemaVersion).toBe('1.0');
    expect(c.findings).toHaveLength(1);
  });

  test('highway-access carries place + drive_minutes measure, consider/modeled-false (AC-2)', () => {
    const f = findById(buildAccessContract({ highwayRamp: ramp('I-75', 'I-75 near Georgetown, KY', 6) }, ASOF), 'highway-access');
    expect(f.claim.place).toEqual({ name: 'I-75', address: 'I-75 near Georgetown, KY' });
    expect(f.claim.measure).toEqual({ value: 6, unit: 'drive_minutes' });
    expect(f.bucket).toBe('consider');
    expect(f.provenance).toMatchObject({ source: 'Google geocoding + Distance Matrix', modeled: false });
  });

  test('driveTone derives across tiers (AC-3)', () => {
    const tone = (m) => findById(buildAccessContract({ highwayRamp: ramp('I-75', 'A', m) }, ASOF), 'highway-access').tone;
    expect(tone(6)).toBe('favorable');   // <= 10
    expect(tone(16)).toBe('neutral');    // <= 20
    expect(tone(27)).toBe('caution');    // > 20 (rural far — test-the-drive framing)
  });

  test('note -> defaultCopy when present, absent otherwise (AC-4)', () => {
    const withNote = findById(buildAccessContract({ highwayRamp: ramp('I-75', 'A', 6, 'Also within 20 minutes: I-64 (12 min)') }, ASOF), 'highway-access');
    expect(withNote.defaultCopy).toContain('Also within 20 minutes');
    const noNote = findById(buildAccessContract({ highwayRamp: ramp('I-75', 'A', 6) }, ASOF), 'highway-access');
    expect(noNote.defaultCopy).toBeUndefined();
  });

  test('no score/grade/rating; no leaked internal keys (AC-6, CONSTRAINT-001/008)', () => {
    const c = buildAccessContract({ highwayRamp: ramp('I-75', 'A', 6, 'note here') }, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c);
    for (const key of ['"color"', '"location"', '"note"']) {
      expect(json).not.toContain(key);
    }
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildAccessContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-with-note': { highwayRamp: ramp('I-75', 'I-75 near Georgetown, KY', 6, 'Also within 20 minutes: I-64 (14 min)') },
    'harlan-ky-rural-far': { highwayRamp: ramp('US-421', 'US-421 near Harlan, KY', 26) },
    'jeffersonville-in': { highwayRamp: ramp('I-65', 'I-65 near Jeffersonville, IN', 5, 'Also within 20 minutes: I-64 (9 min), I-265 (11 min)') },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildAccessContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
