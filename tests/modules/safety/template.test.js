'use strict';
const { buildCrimeHTML } = require('../../../src/modules/safety/template');

const baseEmergency = {
  police: {
    name: 'Georgetown Police Department',
    address: '100 Main St, Georgetown, KY',
    distanceMiles: '1.8',
    response: { estimate: 6, category: { label: 'Good', color: 'green' } },
  },
  fire: {
    name: 'Georgetown Fire Station 1',
    address: '200 Fire Way, Georgetown, KY',
    distanceMiles: '2.1',
    response: { estimate: 7, category: { label: 'Good', color: 'green' } },
  },
};

const slowEmergency = {
  police: {
    name: 'Rural County Sheriff',
    address: '1 County Rd',
    distanceMiles: '8.4',
    driveTimeMinutes: 18,
    response: { estimate: 18, category: { label: 'Extended', color: 'red' } },
  },
  fire: {
    name: 'Volunteer Fire Station 12',
    address: '2 Fire Rd',
    distanceMiles: '7.1',
    driveTimeMinutes: 15,
    response: { estimate: 15, category: { label: 'Extended', color: 'red' } },
  },
};

describe('buildCrimeHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance shows fire response estimate and badge', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Fire:.*~7 min/);
    expect(html).toMatch(/badge-green/);
  });

  test('glance shows police response estimate', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Police:.*~6 min/);
  });

  test('glance omitted when no emergency data', () => {
    const html = buildCrimeHTML(null, { police: null, fire: null });
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildCrimeHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/depth-l3/);
  });

  test('safety-deep-dive container rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/safety-deep-dive/);
  });

  test('Crime Research tab rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Crime Research/);
  });

  test('CrimeMapping link rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/crimemapping\.com/);
  });

  test('SpotCrime link rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/spotcrime\.com/);
  });

  test('city name used in crime research when available', () => {
    const html = buildCrimeHTML({ city: 'Georgetown', county: 'Scott County' }, baseEmergency);
    expect(html).toMatch(/Georgetown/);
  });

  test('Home Safety Prep tab rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Home Safety Prep/);
  });

  test('smoke detector content present', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/smoke detector/i);
  });

  test('urgent framing when fire response > 10 min', () => {
    const html = buildCrimeHTML(null, slowEmergency);
    expect(html).toMatch(/15 min/);
  });

  test('L3 present when no crime object', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/depth-l3/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildCrimeHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/depth-l4/);
  });

  test('station data table rendered', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/climate-data-table/);
  });

  test('police station name in table', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Georgetown Police Department/);
  });

  test('fire station name in table', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/Georgetown Fire Station 1/);
  });

  test('response estimate shown in table', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/~6 min/);
    expect(html).toMatch(/~7 min/);
  });

  test('drive time shown when available', () => {
    const html = buildCrimeHTML(null, slowEmergency);
    expect(html).toMatch(/18 min drive/);
    expect(html).toMatch(/15 min drive/);
  });

  test('dash shown when drive time missing', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    expect(html).toMatch(/—/);
  });

  test('L4 absent when no emergency', () => {
    const html = buildCrimeHTML(null, null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildCrimeHTML(null, baseEmergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
