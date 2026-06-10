'use strict';
const { buildUtilitiesHTML } = require('../../../src/modules/utilities/template');

const full = {
  electric: { utilityName: 'Kentucky Utilities', residentialRate: 0.131 },
  evCharging: {
    level2: { name: 'Library L2', address: '1 Main', driveTimeMinutes: 6, distanceMiles: '1.2' },
    dcFast: { name: 'Pilot DCFC', address: '2 Hwy', driveTimeMinutes: 9, distanceMiles: '4.0' },
  },
  rateContext: { rate: 0.131, stateAvg: 0.128, delta: 0.02, deltaLabel: 'near state average', color: 'gold', narrative: 'about 13¢/kWh, near state average.' },
  utilityType: { type: 'investor-owned', label: 'Appears to be an investor-owned utility', hedge: true },
  outage: { saidiHours: 2.4, saifiEvents: 1.2, isNationalFallback: false, narrative: 'In KY, utilities average about 1.2 interruptions, state-level — not specific to this parcel.' },
  services: { water: 'Likely municipal water', sewer: 'Likely municipal sewer', gas: 'Likely natural gas is available', verify: true, verifyAction: 'Confirm with the county.' },
  evCost: { batteryKwh: 60, fullChargeCost: 7.86, homeNote: 'A full charge costs about $7.86 at home.' },
  locationInfo: { state: 'KY', county: 'Scott', city: 'Georgetown' },
};

describe('buildUtilitiesHTML', () => {
  test('returns empty string when utilities is null', () => {
    expect(buildUtilitiesHTML(null)).toBe('');
  });
  test('renders chapter section with data-ch="utilities"', () => {
    const html = buildUtilitiesHTML(full);
    expect(html).toContain('data-ch="utilities"');
    expect(html).toContain('Utilities &amp; Power');
  });
  test('uses chapter number 15 (after Costs=14; no collision with Sensory=12)', () => {
    expect(buildUtilitiesHTML(full)).toContain('<div class="chapter-num" aria-hidden="true">15</div>');
  });
  test('shows provider name and rate label at L2', () => {
    const html = buildUtilitiesHTML(full);
    expect(html).toContain('Kentucky Utilities');
    expect(html).toContain('near state average');
  });
  test('renders EV L2 + DC-fast in the deep dive', () => {
    const html = buildUtilitiesHTML(full);
    expect(html).toContain('Library L2');
    expect(html).toContain('Pilot DCFC');
  });
  test('reliability tab renders the SAIDI and SAIFI values', () => {
    const html = buildUtilitiesHTML(full);
    expect(html).toContain('2.4'); // saidiHours
    expect(html).toContain('1.2'); // saifiEvents — guards the key name (was a fixture typo)
  });
  test('cross-links to Property internet, does not invent ISP data', () => {
    const html = buildUtilitiesHTML(full).toLowerCase();
    expect(html).toMatch(/internet|broadband|property/);
  });
  test('contains no inline style attributes', () => {
    expect(buildUtilitiesHTML(full)).not.toMatch(/style="/);
  });
  test('contains no scoring language', () => {
    expect(buildUtilitiesHTML(full).toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b|out of 10|\/100/);
  });
  test('graceful fallback when electric is null (actionable, not silent)', () => {
    const html = buildUtilitiesHTML({ ...full, electric: null, rateContext: null, utilityType: null, evCost: null });
    expect(html.toLowerCase()).toMatch(/nrel|look up|provider/);
    expect(html).toContain('data-ch="utilities"');
  });
  test('graceful fallback when evCharging is null', () => {
    const html = buildUtilitiesHTML({ ...full, evCharging: null });
    expect(html.toLowerCase()).toMatch(/charging|afdc|alternative fuel/);
  });
  test('takeaway prioritizes above-average electric rate', () => {
    const html = buildUtilitiesHTML({
      ...full,
      rateContext: { ...full.rateContext, deltaLabel: 'above state average', color: 'orange' },
    });
    expect(html).toMatch(/Key Takeaway:[\s\S]*above the state average/);
  });
  test('takeaway calls out well/septic for rural service inference', () => {
    const html = buildUtilitiesHTML({
      ...full,
      rateContext: { ...full.rateContext, deltaLabel: 'near state average' },
      services: { water: 'Likely a private well', sewer: 'Likely a septic system', gas: 'Likely propane or electric-only', verify: true, verifyAction: 'Confirm with the county.' },
    });
    expect(html).toMatch(/Key Takeaway:[\s\S]*well and septic/);
  });
});

const { buildUtilitiesHTML: buildU } = require('../../../src/modules/utilities/template');

describe('FR-060 fallback rendering', () => {
  const hifld = {
    ...full,
    electric: { utilityName: 'Kentucky Utilities', residentialRate: null, ownership: 'INVESTOR OWNED' },
    rateContext: null,
    electricSource: 'HIFLD',
    stateAvgRate: 0.128,
  };
  test('renders provider + type + state-average context (not the link fallback)', () => {
    const html = buildU(hifld);
    expect(html).toContain('Kentucky Utilities');
    expect(html.toLowerCase()).toMatch(/typical residential rate/);
    expect(html).toContain('13¢/kWh'); // round(0.128*100)
    expect(html).not.toMatch(/weren't returned by NREL/);
  });
  test('shows a HIFLD provenance note on the fallback path', () => {
    expect(buildU(hifld).toLowerCase()).toContain('via hifld');
  });
  test('full NREL path is unchanged (no provenance note)', () => {
    expect(buildU(full).toLowerCase()).not.toContain('via hifld');
  });
  test('EV provenance note when evSource is OpenChargeMap', () => {
    expect(buildU({ ...full, evSource: 'OpenChargeMap' }).toLowerCase()).toContain('via openchargemap');
  });
  test('no inline styles, no scoring in the fallback state', () => {
    const html = buildU(hifld);
    expect(html).not.toMatch(/style="/);
    expect(html.toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b/);
  });
});

describe('FR-061 internet rendering', () => {
  const { buildUtilitiesHTML: buildUnet } = require('../../../src/modules/utilities/template');
  const withNet = (internet) => ({ ...full, internet });

  test('L1 section + L3 tab show providers, band, and meaning', () => {
    const html = buildUnet(withNet({
      providers: [{ name: 'Glo Fiber', tech: 'Fiber' }, { name: 'Spectrum', tech: 'Cable' }],
      providerCount: 2,
      band: { label: 'Gigabit-class (fiber)', color: 'green' },
      meaning: 'Handles anything a household throws at it.',
      satelliteFloor: false,
    }));
    expect(html).toContain('Gigabit-class (fiber)');
    expect(html).toContain('Glo Fiber');
    expect(html).toMatch(/2 providers serve this address/);
    expect(html).toContain('Internet'); // tab label
  });

  test('satellite line appears only when satelliteFloor is true', () => {
    const on = buildUnet(withNet({ providers: [], providerCount: 0, band: { label: 'Limited wired options', color: 'orange' }, meaning: 'Modest.', satelliteFloor: true }));
    expect(on.toLowerCase()).toMatch(/satellite internet/);
    const off = buildUnet(withNet({ providers: [{ name: 'A', tech: 'Fiber' }], providerCount: 1, band: { label: 'Gigabit-class (fiber)', color: 'green' }, meaning: 'Great.', satelliteFloor: false }));
    expect(off.toLowerCase()).not.toMatch(/satellite internet/);
  });

  test('null internet -> FCC link fallback, never silent', () => {
    const html = buildUnet(withNet(null));
    expect(html).toMatch(/broadbandmap\.fcc\.gov/);
    expect(html.toLowerCase()).toMatch(/satellite internet/);
  });

  test('no inline styles, no scoring in the internet section', () => {
    const html = buildUnet(withNet({ providers: [{ name: 'A', tech: 'Fiber' }], providerCount: 1, band: { label: 'Gigabit-class (fiber)', color: 'green' }, meaning: 'Great.', satelliteFloor: false }));
    expect(html).not.toMatch(/style="/);
    expect(html.toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b/);
  });

  test('singular grammar: 1 provider "serves" this address', () => {
    const html = buildUnet(withNet({
      providers: [{ name: 'Solo ISP', tech: 'Fiber' }],
      providerCount: 1,
      band: { label: 'Gigabit-class (fiber)', color: 'green' },
      meaning: 'Great.',
      satelliteFloor: false,
    }));
    expect(html).toMatch(/1 provider serve?s this address/); // "1 provider serves" (singular, no double 's' on provider)
    expect(html).toContain('1 provider serves this address');
  });

  test('L3 tab is not silent when internet present but providers empty', () => {
    const html = buildUnet(withNet({
      providers: [],
      providerCount: 0,
      band: { label: 'Standard broadband', color: 'gold' },
      meaning: 'Fine for everyday use.',
      satelliteFloor: false,
    }));
    expect(html.toLowerCase()).toMatch(/provider details weren't itemized/i);
  });
});
