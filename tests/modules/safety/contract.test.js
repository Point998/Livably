'use strict';

// FR-084 — safety contract builder (rollout #5).

const { buildSafetyContract } = require('../../../src/modules/safety/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

// Stations carry response.category (label + color) in the INPUT — the builder must DROP it
// (CONSTRAINT-001/008) and derive tone instead.
const station = (name, address, mins, dist) => ({
  name, address, distanceMiles: dist, driveTimeMinutes: mins,
  response: { estimate: mins, category: { label: 'Good', color: 'gold' } },
});

const policeNear = station('Georgetown Police Dept', '100 Court St, Georgetown, KY', 6, '2.1');
const fireNear   = station('Scott County Fire Station 1', '200 Main St, Georgetown, KY', 7, '2.8');
const safetyLoc  = { state: 'KY', city: 'Georgetown', county: 'Scott County' };

const fullInput = { emergency: { police: policeNear, fire: fireNear }, safetyLocation: safetyLoc };

describe('buildSafetyContract', () => {
  test('all-absent input -> null (AC-8)', () => {
    expect(buildSafetyContract({ emergency: { police: null, fire: null }, safetyLocation: null }, ASOF)).toBeNull();
    expect(buildSafetyContract(null, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-1)', () => {
    const c = buildSafetyContract(fullInput, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('safety');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('police + fire findings carry place + response_minutes measure, modeled provenance (AC-2)', () => {
    const c = buildSafetyContract(fullInput, ASOF);
    const p = c.findings.find((f) => f.id === 'police-response');
    expect(p.claim.place).toEqual({ name: 'Georgetown Police Dept', address: '100 Court St, Georgetown, KY' });
    expect(p.claim.measure).toEqual({ value: 6, unit: 'response_minutes' });
    expect(p.bucket).toBe('consider');
    expect(p.provenance.modeled).toBe(true);
    const f = c.findings.find((x) => x.id === 'fire-response');
    expect(f.claim.measure).toEqual({ value: 7, unit: 'response_minutes' });
    expect(f.provenance.modeled).toBe(true);
  });

  test('responseTone derives across tiers for both stations (AC-3)', () => {
    const ptone = (m) => buildSafetyContract({ emergency: { police: station('P', 'A', m, '1') } }, ASOF)
      .findings.find((f) => f.id === 'police-response').tone;
    expect(ptone(6)).toBe('favorable');  // <= 8
    expect(ptone(11)).toBe('neutral');   // <= 12
    expect(ptone(18)).toBe('caution');   // > 12
    const ftone = (m) => buildSafetyContract({ emergency: { fire: station('F', 'A', m, '1') } }, ASOF)
      .findings.find((f) => f.id === 'fire-response').tone;
    expect(ftone(8)).toBe('favorable');
    expect(ftone(12)).toBe('neutral');
    expect(ftone(25)).toBe('caution');
  });

  test('missing police/fire -> *-missing check finding with instruction fallback (AC-4, CONSTRAINT-015)', () => {
    const c = buildSafetyContract({ emergency: { police: null, fire: fireNear }, safetyLocation: safetyLoc }, ASOF);
    const miss = c.findings.find((f) => f.id === 'police-response-missing');
    expect(miss.bucket).toBe('check');
    expect(miss.tone).toBe('caution');
    expect(miss.claim.measure).toBeNull();
    expect(miss.fallbackAction.type).toBe('instruction');
    expect(c.findings.find((f) => f.id === 'police-response')).toBeUndefined();

    const c2 = buildSafetyContract({ emergency: { police: policeNear, fire: null } }, ASOF);
    expect(c2.findings.find((f) => f.id === 'fire-response-missing').fallbackAction.type).toBe('instruction');
  });

  test('iso-ppc always emitted: check bucket, no measure, instruction fallback (AC-5)', () => {
    const iso = buildSafetyContract(fullInput, ASOF).findings.find((f) => f.id === 'iso-ppc');
    expect(iso).toBeDefined();
    expect(iso.bucket).toBe('check');
    expect(iso.tone).toBe('neutral');
    expect(iso.claim.measure).toBeNull();
    expect(iso.fallbackAction.type).toBe('instruction');
  });

  test('crime-research always emitted: no measure/comparison, url fallback (AC-6, CONSTRAINT-002/015)', () => {
    const crime = buildSafetyContract(fullInput, ASOF).findings.find((f) => f.id === 'crime-research');
    expect(crime).toBeDefined();
    expect(crime.bucket).toBe('check');
    expect(crime.claim.measure).toBeNull();
    expect(crime.claim.comparison).toBeNull();
    expect(crime.fallbackAction).toMatchObject({ type: 'url' });
  });

  test('no finding carries score/grade/rating; no color anywhere (AC-7, CONSTRAINT-001/008)', () => {
    const c = buildSafetyContract(fullInput, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    expect(JSON.stringify(c)).not.toMatch(/"color"/);
    expect(JSON.stringify(c)).not.toMatch(/"category"/);
  });

  test('provenanceSummary dedupes sources', () => {
    const sources = buildSafetyContract(fullInput, ASOF).provenanceSummary.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources).toContain('Google Places + dispatch model');
  });

  test('safetyLocation alone (no stations) still yields iso + crime findings (CONSTRAINT-015)', () => {
    const c = buildSafetyContract({ emergency: { police: null, fire: null }, safetyLocation: safetyLoc }, ASOF);
    expect(c).not.toBeNull();
    expect(c.findings.find((f) => f.id === 'iso-ppc')).toBeDefined();
    expect(c.findings.find((f) => f.id === 'crime-research')).toBeDefined();
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildSafetyContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': fullInput,
    'harlan-ky-rural-far': {
      emergency: {
        police: station('Harlan Police Dept', '210 E Central St, Harlan, KY', 17, '11.4'),
        fire: station('Harlan Fire Dept', '201 S Main St, Harlan, KY', 21, '14.2'),
      },
      safetyLocation: { state: 'KY', city: 'Harlan', county: 'Harlan County' },
    },
    'jeffersonville-in': {
      emergency: {
        police: station('Jeffersonville Police Dept', '2218 E 10th St, Jeffersonville, IN', 7, '3.0'),
        fire: station('Jeffersonville Fire Station 4', '1100 Spring St, Jeffersonville, IN', 6, '2.4'),
      },
      safetyLocation: { state: 'IN', city: 'Jeffersonville', county: 'Clark County' },
    },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildSafetyContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
