'use strict';

// FR-079 — community contract builder. The headline tests are the Fair Housing invariants
// (CONSTRAINT-002): demographic facts, never characterization.

const { buildCommunityContract } = require('../../../src/modules/community/contract');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

const full = {
  totalPop: 4200,
  medianAge: 38,
  age: { under18: 22, age18to34: 25, age35to64: 38, age65plus: 15, primaryGroup: 'Established households' },
  income: { median: 72000, level: { label: 'Above national median', color: 'gold' } },
  education: { bachelor: 32, graduate: 14, collegePct: 46, level: { label: 'Above US avg', color: 'lightgreen' } },
  community: {
    ownershipRate: 68, avgHHSize: 2.6, medianTenureYears: 9,
    type: { label: 'Mixed residential community', icon: '🏘️' },
    densityType: { label: 'Suburban', icon: '🏘️' },
  },
};
const noIncome = { ...full, income: { median: null, level: { label: 'Data unavailable', color: 'muted' } } };

describe('buildCommunityContract', () => {
  test('returns null on null input', () => {
    expect(buildCommunityContract(null, ASOF)).toBeNull();
  });

  test('produces a schema-valid community contract', () => {
    const c = buildCommunityContract(full, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    expect(c.chapterId).toBe('community');
  });

  // ── Fair Housing invariants (the reason community is the first rollout) ──────
  test('ADR-1: EVERY finding is tone neutral (no value judgment on demographics)', () => {
    const c = buildCommunityContract(full, ASOF);
    expect(c.findings.length).toBeGreaterThan(0);
    for (const f of c.findings) expect(f.tone).toBe('neutral');
  });

  test('ADR-1: no demographic finding lands in the consider/caution framing', () => {
    const c = buildCommunityContract(full, ASOF);
    // demographics are "cool"/context; only a missing-data fallback may be "check"
    for (const f of c.findings) {
      if (f.id !== 'income-missing') expect(f.bucket).toBe('cool');
    }
  });

  test('ADR-2: income compares to the NATIONAL median only', () => {
    const c = buildCommunityContract(full, ASOF);
    const income = c.findings.find((f) => f.id === 'household-income');
    expect(income.claim.comparison.basis).toBe('national_median');
    expect(income.claim.comparison.region).toBeNull();
    expect(income.claim.comparison.direction).toBe('above');
  });

  test('ADR-3: missing income yields a data.census.gov fallbackAction', () => {
    const c = buildCommunityContract(noIncome, ASOF);
    const miss = c.findings.find((f) => f.id === 'income-missing');
    expect(miss.fallbackAction).toMatchObject({ type: 'url', value: 'https://data.census.gov' });
  });

  test('carries no color/score anywhere; provenance is Census ACS', () => {
    const c = buildCommunityContract(full, ASOF);
    expect(JSON.stringify(c)).not.toMatch(/"color"/);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f.provenance.source).toBe('Census ACS');
    }
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildCommunityContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': full,
    'rural-no-income': noIncome,
    'jeffersonville-in': { ...full, community: { ...full.community, densityType: { label: 'Urban', icon: '🏙️' } } },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`community contract snapshot — ${name}`, () => {
      expect(buildCommunityContract(input, ASOF)).toMatchSnapshot();
    });
  }
});
