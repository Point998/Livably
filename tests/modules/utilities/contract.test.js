'use strict';

// FR-078 — utilities contract builder + reference renderer.

const { buildUtilitiesContract } = require('../../../src/modules/utilities/contract');
const { renderUtilitiesFromContract } = require('../../../src/modules/utilities/contractRenderer');
const { ChapterContractSchema } = require('../../../src/contract/schema');

const ASOF = { asOf: '2026-06', degraded: false };

// Representative assembleUtilities(...) outputs.
const fullNREL = {
  electric: { utilityName: 'Kentucky Utilities Co', residentialRate: 0.131, ownership: 'investor-owned', source: 'NREL' },
  rateContext: { rate: 0.131, stateAvg: 0.115, delta: 0.139, deltaLabel: 'above state average', color: 'orange', narrative: 'The residential rate here is about 13¢/kWh, above the state average.' },
  utilityType: { label: 'Investor-owned utility' },
  evCharging: { level2: {}, dcFast: {}, source: 'NREL' },
  evCost: { homeNote: 'A full charge costs about $5.' },
  evSource: 'NREL',
  internet: { band: { label: 'Gigabit-class (fiber)', color: 'green' }, meaning: 'Handles anything a household throws at it.', providers: [], providerCount: 0 },
  electricSource: 'NREL', stateAvgRate: 0.115, locationInfo: { state: 'KY' },
};
const belowAvg = {
  ...fullNREL,
  rateContext: { rate: 0.10, stateAvg: 0.12, delta: -0.167, deltaLabel: 'below state average', color: 'green', narrative: 'Below average.' },
};
const hifld = {
  electric: { utilityName: 'Duke Energy', residentialRate: null, ownership: 'investor-owned', source: 'HIFLD' },
  rateContext: null, utilityType: { label: 'Investor-owned utility' },
  evCharging: null, internet: null, electricSource: 'HIFLD', stateAvgRate: 0.12, locationInfo: { state: 'IN' },
};
const allMissing = { electric: null, rateContext: null, evCharging: null, internet: null, electricSource: null, locationInfo: { state: 'KY' } };

describe('buildUtilitiesContract', () => {
  test('returns null on null input', () => {
    expect(buildUtilitiesContract(null, ASOF)).toBeNull();
  });

  test('full NREL: schema-valid, electric-rate carries measure + comparison, tone caution', () => {
    const c = buildUtilitiesContract(fullNREL, ASOF);
    expect(ChapterContractSchema.safeParse(c).success).toBe(true);
    const rate = c.findings.find((f) => f.id === 'electric-rate');
    expect(rate.tone).toBe('caution');
    expect(rate.bucket).toBe('consider');
    expect(rate.claim.measure).toEqual({ value: 13, unit: 'cents_per_kwh' });
    expect(rate.claim.comparison).toMatchObject({ basis: 'state_average', direction: 'above', region: 'KY' });
    expect(rate.provenance.source).toBe('NREL');
  });

  test('below-average rate derives tone favorable', () => {
    const c = buildUtilitiesContract(belowAvg, ASOF);
    expect(c.findings.find((f) => f.id === 'electric-rate').tone).toBe('favorable');
  });

  test('HIFLD: provider finding (no rate), provenance HIFLD', () => {
    const c = buildUtilitiesContract(hifld, ASOF);
    const prov = c.findings.find((f) => f.id === 'electric-provider');
    expect(prov.claim.measure).toBeNull();
    expect(prov.provenance.source).toBe('HIFLD');
  });

  test('all missing: electric + internet findings carry actionable fallbackAction (CONSTRAINT-015)', () => {
    const c = buildUtilitiesContract(allMissing, ASOF);
    const elec = c.findings.find((f) => f.id === 'electric-missing');
    const net = c.findings.find((f) => f.id === 'internet-missing');
    expect(elec.fallbackAction).toMatchObject({ type: 'url', value: 'https://apps.openei.org/USURDB/' });
    expect(net.fallbackAction).toMatchObject({ type: 'url', value: 'https://broadbandmap.fcc.gov/' });
  });

  test('no finding carries a numeric score/grade/rating (CONSTRAINT-001)', () => {
    const c = buildUtilitiesContract(fullNREL, ASOF);
    for (const f of c.findings) {
      expect(f).not.toHaveProperty('score');
      expect(f).not.toHaveProperty('grade');
      expect(f).not.toHaveProperty('rating');
    }
  });

  test('the contract carries no color anywhere (tone is semantic, not visual)', () => {
    const json = JSON.stringify(buildUtilitiesContract(fullNREL, ASOF));
    expect(json).not.toMatch(/"color"/);
  });
});

// Per-address snapshots (deterministic asOf). CONSTRAINT-011: Jeffersonville IN included.
describe('buildUtilitiesContract — per-address snapshots', () => {
  const cases = {
    'georgetown-ky-full': fullNREL,
    'harlan-ky-missing': allMissing,
    'jeffersonville-in-hifld': { ...hifld, locationInfo: { state: 'IN' } },
  };
  for (const [name, input] of Object.entries(cases)) {
    test(`contract snapshot — ${name}`, () => {
      expect(buildUtilitiesContract(input, ASOF)).toMatchSnapshot();
    });
  }
});

describe('renderUtilitiesFromContract (sufficiency proof)', () => {
  test('surfaces the key facts from the contract', () => {
    const html = renderUtilitiesFromContract(buildUtilitiesContract(fullNREL, ASOF));
    expect(html).toContain('Residential electric rate');
    expect(html).toContain('13 cents_per_kwh');
    expect(html).toContain('rc-tone-caution');
    expect(html).toContain('rc-bucket-consider');
    expect(html).toContain('NREL · 2026-06');
  });

  test('renders the actionable fallback link when data is missing', () => {
    const html = renderUtilitiesFromContract(buildUtilitiesContract(allMissing, ASOF));
    expect(html).toContain('https://apps.openei.org/USURDB/');
    expect(html).toContain('rc-fallback');
  });

  test('introduces no inline styles (CONSTRAINT-008)', () => {
    const html = renderUtilitiesFromContract(buildUtilitiesContract(fullNREL, ASOF));
    expect(html.match(/style="(?!--)[^"]+"/g)).toBeNull();
  });

  test('empty/null contract renders empty string', () => {
    expect(renderUtilitiesFromContract(null)).toBe('');
  });
});
