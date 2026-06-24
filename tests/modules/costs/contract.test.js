'use strict';

// FR-093 — costs contract builder (rollout #14). Last numbered chapter.
// Component costs as factual measures — never a composite affordability score (CONSTRAINT-001).

const { buildCostsContract } = require('../../../src/modules/costs/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const ky = { taxRate: 0.83, insuranceYear: 1680, utilitiesMo: 190, homesteadNote: 'Kentucky offers a homestead exemption ($46,350 off assessed value) for homeowners 65+ or permanently disabled.', state: 'KY', county: 'Scott' };
const mt = { taxRate: 0.74, insuranceYear: 1550, utilitiesMo: 165, homesteadNote: null, state: 'MT', county: 'Gallatin' };
const nj = { taxRate: 2.13, insuranceYear: 1440, utilitiesMo: 210, homesteadNote: null, state: 'NJ', county: 'Mercer' };
const near = { taxRate: 1.0, insuranceYear: 1400, utilitiesMo: 185, homesteadNote: null, state: 'XX', county: '' };

const findById = (c, id) => c.findings.find((f) => f.id === id);

describe('buildCostsContract', () => {
  test('absent propertyData -> null (AC-9)', () => {
    expect(buildCostsContract(null, ASOF)).toBeNull();
    expect(buildCostsContract(undefined, ASOF)).toBeNull();
  });

  test('full input: schema-valid, chapterId/version (AC-2)', () => {
    const c = buildCostsContract(ky, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('costs');
    expect(c.schemaVersion).toBe('1.0');
  });

  test('property-tax-rate: percent measure + national_average comparison, below->cool/favorable (AC-3)', () => {
    const t = findById(buildCostsContract(ky, ASOF), 'property-tax-rate');
    expect(t.claim.measure).toEqual({ value: 0.83, unit: 'percent_effective' });
    expect(t.claim.comparison).toEqual({
      basis: 'national_average', referenceValue: 1.0, direction: 'below', deltaPct: -17, region: 'KY',
    });
    expect(t.bucket).toBe('cool');
    expect(t.tone).toBe('favorable');
    expect(t.provenance).toMatchObject({ source: 'Lincoln Institute', modeled: true });
    expect(t.fallbackAction.type).toBe('instruction');
  });

  test('tax bands: near->consider/neutral, above->check/caution (AC-3)', () => {
    const n = findById(buildCostsContract(near, ASOF), 'property-tax-rate');
    expect(n.bucket).toBe('consider');
    expect(n.tone).toBe('neutral');
    expect(n.claim.comparison.direction).toBe('near');

    const a = findById(buildCostsContract(nj, ASOF), 'property-tax-rate');
    expect(a.bucket).toBe('check');
    expect(a.tone).toBe('caution');
    expect(a.claim.comparison.direction).toBe('above');
  });

  test('insurance/utilities/carrying estimates: usd_per_month measures, all modeled, each with a fallback (AC-4, AC-5)', () => {
    const c = buildCostsContract(ky, ASOF);
    const ins = findById(c, 'insurance-estimate');
    const util = findById(c, 'utilities-estimate');
    const carry = findById(c, 'carrying-cost-estimate');

    expect(ins.claim.measure).toEqual({ value: 140, unit: 'usd_per_month' });
    expect(util.claim.measure).toEqual({ value: 190, unit: 'usd_per_month' });
    expect(carry.claim.measure).toEqual({ value: 538, unit: 'usd_per_month_at_300k_ref' });
    expect(carry.claim.comparison).toBeNull();

    for (const f of [ins, util, carry]) {
      expect(f.bucket).toBe('consider');
      expect(f.tone).toBe('neutral');
      expect(f.provenance.modeled).toBe(true);
      expect(f.fallbackAction.type).toBe('instruction');
    }
    // the four state-average estimates are all honest-provenance modeled:true
    expect(findById(c, 'property-tax-rate').provenance.modeled).toBe(true);
  });

  test('carrying total = tax + insurance + utilities (component sum, not a score)', () => {
    const c = buildCostsContract(ky, ASOF);
    const tax = Math.round((300000 * 0.83 / 100) / 12);
    const carry = findById(c, 'carrying-cost-estimate');
    expect(carry.claim.measure.value).toBe(tax + 140 + 190);
  });

  test('homestead-exemption emitted only when homesteadNote present (AC-6)', () => {
    const withHs = findById(buildCostsContract(ky, ASOF), 'homestead-exemption');
    expect(withHs.bucket).toBe('cool');
    expect(withHs.tone).toBe('favorable');
    expect(withHs.claim.measure).toBeNull();
    expect(withHs.provenance.modeled).toBe(false);
    expect(withHs.defaultCopy).toMatch(/homestead/i);
    // no note -> no finding
    expect(findById(buildCostsContract(mt, ASOF), 'homestead-exemption')).toBeUndefined();
  });

  test('no score/grade/rating/affordability anywhere (AC-7, CONSTRAINT-001)', () => {
    const c = buildCostsContract(ky, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
    const json = JSON.stringify(c).toLowerCase();
    // word-boundary match — `grade` must not flag the legitimate `degraded` schema field.
    for (const banned of [/\bscore\b/, /\bgrade\b/, /\baffordab/, /\brating\b/]) {
      expect(json).not.toMatch(banned);
    }
  });

  test('only comparison basis is national_average; no income/economic-character (AC-8, CONSTRAINT-002)', () => {
    const c = buildCostsContract(ky, ASOF);
    const bases = c.findings.map((f) => f.claim.comparison?.basis).filter(Boolean);
    expect(bases).toEqual(['national_average']);
    const json = JSON.stringify(c).toLowerCase();
    for (const banned of ['income', 'wealth', 'affluent', 'poverty', 'class']) {
      expect(json).not.toContain(banned);
    }
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildCostsContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky': ky,
    'bozeman-mt': mt,
    'jeffersonville-in': { taxRate: 0.83, insuranceYear: 1280, utilitiesMo: 195, homesteadNote: null, state: 'IN', county: 'Clark' },
    'synthetic-nj-high-tax': nj,
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildCostsContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
