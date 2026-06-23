'use strict';

// FR-080 — health contract builder.

const { buildHealthContract } = require('../../../src/modules/health/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const hospitalNear = { name: 'Baptist Health Lexington', address: '1740 Nicholasville Rd, Lexington, KY', location: { lat: 38, lng: -84 }, driveTimeMinutes: 8 };
const hospitalMid = { ...hospitalNear, driveTimeMinutes: 16 };
const hospitalFar = { ...hospitalNear, driveTimeMinutes: 27 };
const urgentCareCloser = { name: 'Norton Immediate Care', address: '200 Main St, Lexington, KY', location: { lat: 38, lng: -84 }, driveTimeMinutes: 5 };
const urgentCareFarther = { ...urgentCareCloser, driveTimeMinutes: 12 };
const depthFull = { designation: { label: 'Acute Care Hospital', note: 'Equipped for most emergencies.' }, primaryCareCount: 22 };

const fullInput = { hospital: hospitalNear, urgentCare: urgentCareFarther, healthcareDepth: depthFull };

describe('buildHealthContract', () => {
  test('returns null when all inputs absent', () => {
    expect(buildHealthContract({ hospital: null, urgentCare: null, healthcareDepth: null }, ASOF)).toBeNull();
    expect(buildHealthContract(null, ASOF)).toBeNull();
  });

  test('full input: schema-valid', () => {
    const c = buildHealthContract(fullInput, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('health');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('ER finding carries place + drive_minutes measure (AC-3)', () => {
    const er = buildHealthContract(fullInput, ASOF).findings.find((f) => f.id === 'emergency-room');
    expect(er.claim.place).toEqual({ name: 'Baptist Health Lexington', address: '1740 Nicholasville Rd, Lexington, KY' });
    expect(er.claim.measure).toEqual({ value: 8, unit: 'drive_minutes' });
    expect(er.bucket).toBe('consider');
    expect(er.provenance.source).toBe('Google Places');
  });

  test('ER tone derives across drive-time tiers (AC-4)', () => {
    const tone = (h) => buildHealthContract({ hospital: h }, ASOF).findings.find((f) => f.id === 'emergency-room').tone;
    expect(tone(hospitalNear)).toBe('favorable'); // 8
    expect(tone(hospitalMid)).toBe('neutral');    // 16
    expect(tone(hospitalFar)).toBe('caution');    // 27
  });

  test('urgent care tone: favorable when closer than ER, else neutral (AC-5)', () => {
    const closer = buildHealthContract({ hospital: hospitalMid, urgentCare: urgentCareCloser }, ASOF);
    expect(closer.findings.find((f) => f.id === 'urgent-care').tone).toBe('favorable');
    const farther = buildHealthContract({ hospital: hospitalNear, urgentCare: urgentCareFarther }, ASOF);
    expect(farther.findings.find((f) => f.id === 'urgent-care').tone).toBe('neutral');
  });

  test('missing hospital -> emergency-room-missing with actionable fallback (AC-6, CONSTRAINT-015)', () => {
    const c = buildHealthContract({ urgentCare: urgentCareCloser }, ASOF);
    const miss = c.findings.find((f) => f.id === 'emergency-room-missing');
    expect(miss.bucket).toBe('check');
    expect(miss.tone).toBe('caution');
    expect(miss.fallbackAction).toMatchObject({ type: 'url', value: 'https://www.medicare.gov/care-compare/' });
  });

  test('missing urgent care -> actionable fallback (CONSTRAINT-015)', () => {
    const miss = buildHealthContract({ hospital: hospitalNear }, ASOF).findings.find((f) => f.id === 'urgent-care-missing');
    expect(miss.fallbackAction).toMatchObject({ type: 'url', value: 'https://www.solvhealth.com/' });
  });

  test('cross-state hospital -> tone caution + note in defaultCopy (AC-8, CONSTRAINT-006)', () => {
    const xs = { ...hospitalNear, crossStateWarning: true, crossStateNote: 'This hospital is in KY. No in-state hospital was found within the search radius.' };
    const er = buildHealthContract({ hospital: xs }, ASOF).findings.find((f) => f.id === 'emergency-room');
    expect(er.tone).toBe('caution');
    expect(er.defaultCopy).toContain('No in-state hospital');
  });

  test('primary-care tone derives across count tiers; count is a measure (AC-9)', () => {
    const tone = (n) => buildHealthContract({ healthcareDepth: { designation: null, primaryCareCount: n } }, ASOF).findings.find((f) => f.id === 'primary-care').tone;
    expect(tone(0)).toBe('caution');
    expect(tone(4)).toBe('caution');
    expect(tone(10)).toBe('neutral');
    expect(tone(30)).toBe('favorable');
    const pc = buildHealthContract({ healthcareDepth: { designation: null, primaryCareCount: 22 } }, ASOF).findings.find((f) => f.id === 'primary-care');
    expect(pc.claim.measure).toEqual({ value: 22, unit: 'physicians' });
  });

  test('primary-care count 0 carries an instruction fallback', () => {
    const pc = buildHealthContract({ healthcareDepth: { designation: null, primaryCareCount: 0 } }, ASOF).findings.find((f) => f.id === 'primary-care');
    expect(pc.fallbackAction).toMatchObject({ type: 'instruction' });
  });

  test('healthcareDepth present but count null -> primary-care-missing fallback (CONSTRAINT-015)', () => {
    const miss = buildHealthContract({ healthcareDepth: { designation: null, primaryCareCount: null } }, ASOF).findings.find((f) => f.id === 'primary-care-missing');
    expect(miss.fallbackAction).toMatchObject({ type: 'instruction' });
  });

  test('hospital-type emitted only when designation present', () => {
    const withDesig = buildHealthContract({ healthcareDepth: depthFull }, ASOF);
    expect(withDesig.findings.find((f) => f.id === 'hospital-type').provenance.source).toBe('CMS');
    const noDesig = buildHealthContract({ healthcareDepth: { designation: null, primaryCareCount: 5 } }, ASOF);
    expect(noDesig.findings.find((f) => f.id === 'hospital-type')).toBeUndefined();
  });

  test('no finding carries a numeric score/grade/rating (CONSTRAINT-001)', () => {
    for (const f of buildHealthContract(fullInput, ASOF).findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
  });

  test('the contract carries no color anywhere (CONSTRAINT-008)', () => {
    expect(JSON.stringify(buildHealthContract(fullInput, ASOF))).not.toMatch(/"color"/);
  });

  test('provenanceSummary dedupes Google Places + CMS sources', () => {
    const sources = buildHealthContract(fullInput, ASOF).provenanceSummary.map((p) => p.source);
    expect(sources).toContain('Google Places');
    expect(sources).toContain('CMS');
    expect(sources).toContain('CMS NPI Registry');
    expect(new Set(sources).size).toBe(sources.length);
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildHealthContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': fullInput,
    'harlan-ky-rural-far-er': { hospital: { name: 'Harlan ARH Hospital', address: '81 Ball Park Rd, Harlan, KY', location: { lat: 36.8, lng: -83.3 }, driveTimeMinutes: 24 }, urgentCare: null, healthcareDepth: { designation: { label: 'Critical Access Hospital', note: 'A smaller rural hospital (typically ≤25 beds).' }, primaryCareCount: 3 } },
    'jeffersonville-in-crossstate': { hospital: { name: 'UofL Hospital', address: '530 S Jackson St, Louisville, KY', location: { lat: 38.2, lng: -85.7 }, driveTimeMinutes: 14, crossStateWarning: true, crossStateNote: 'This hospital is in KY. No in-state hospital was found within the search radius.' }, urgentCare: { name: 'Norton Immediate Care', address: '1425 State St, New Albany, IN', location: { lat: 38.3, lng: -85.8 }, driveTimeMinutes: 9 }, healthcareDepth: { designation: { label: 'Acute Care Hospital', note: 'Equipped for most emergencies.' }, primaryCareCount: 18 } },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildHealthContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
