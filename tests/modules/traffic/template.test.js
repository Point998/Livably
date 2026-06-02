'use strict';
const { buildTrafficCardHTML } = require('../../../src/modules/traffic/template');

const trafficData = [
  {
    name: 'Kroger',
    location: { lat: 38.2, lng: -84.5 },
    traffic: {
      variations: [
        { label: 'Mon–Fri 8am', minutes: 8,  percentAboveBase: 0,  display: 'Mon–Fri 8am' },
        { label: 'Mon–Fri 5pm', minutes: 12, percentAboveBase: 50, display: 'Mon–Fri 5pm' },
        { label: 'Sat 10am',    minutes: 9,  percentAboveBase: 12, display: 'Sat 10am'    },
      ],
      stats: { min: 8, max: 12, avg: 9.67, range: 4 },
    },
  },
];

const lowVariationData = [
  {
    name: 'Corner Store',
    location: { lat: 38.2, lng: -84.5 },
    traffic: {
      variations: [
        { label: 'Mon–Fri 8am', minutes: 5, percentAboveBase: 0, display: 'Mon–Fri 8am' },
        { label: 'Mon–Fri 5pm', minutes: 6, percentAboveBase: 8, display: 'Mon–Fri 5pm' },
        { label: 'Sat 10am',    minutes: 5, percentAboveBase: 2, display: 'Sat 10am'    },
      ],
      stats: { min: 5, max: 6, avg: 5.33, range: 1 },
    },
  },
];

const highVariationData = [
  {
    name: 'Downtown Office',
    location: { lat: 38.2, lng: -84.5 },
    traffic: {
      variations: [
        { label: 'Mon–Fri 7am', minutes: 18, percentAboveBase: 0,  display: 'Mon–Fri 7am' },
        { label: 'Mon–Fri 8am', minutes: 28, percentAboveBase: 55, display: 'Mon–Fri 8am' },
        { label: 'Mon–Fri 5pm', minutes: 32, percentAboveBase: 78, display: 'Mon–Fri 5pm' },
        { label: 'Sat 10am',    minutes: 20, percentAboveBase: 11, display: 'Sat 10am'    },
      ],
      stats: { min: 18, max: 32, avg: 24.5, range: 14 },
    },
  },
];

describe('buildTrafficCardHTML — FR-045 depth system', () => {
  test('section has data-depth="overview"', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('renders depth-l1 glance bar', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l2/);
  });

  test('depth selector rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/chapter-depth-control/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildTrafficCardHTML(trafficData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildTrafficCardHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l3/);
  });

  test('traffic-deep-dive container rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/traffic-deep-dive/);
  });

  test('low-variation narrative rendered when maxPct < 10', () => {
    const html = buildTrafficCardHTML(lowVariationData);
    expect(html).toMatch(/minimal/i);
  });

  test('high-variation narrative rendered when maxPct >= 20', () => {
    const html = buildTrafficCardHTML(highVariationData);
    expect(html).toMatch(/78%/);
  });

  test('best and worst windows shown when range > 0', () => {
    const html = buildTrafficCardHTML(highVariationData);
    expect(html).toMatch(/Best window/);
    expect(html).toMatch(/Worst window/);
    expect(html).toMatch(/Mon–Fri 7am/);
    expect(html).toMatch(/Mon–Fri 5pm/);
  });

  test('annual time cost shown when range >= 5', () => {
    const html = buildTrafficCardHTML(highVariationData);
    expect(html).toMatch(/hours per year/);
  });

  test('annual time cost absent when range < 5', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).not.toMatch(/hours per year/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildTrafficCardHTML(highVariationData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildTrafficCardHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/depth-l4/);
  });

  test('research table rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/climate-data-table/);
  });

  test('destination name appears as section label', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/Kroger/);
  });

  test('time slot rows rendered', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/Mon–Fri 8am/);
    expect(html).toMatch(/12 min/);
  });

  test('percentage above baseline shown for non-zero slots', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/\+50%/);
  });

  test('baseline label shown for 0% slots', () => {
    const html = buildTrafficCardHTML(trafficData);
    expect(html).toMatch(/baseline/);
  });

  test('multiple destinations produce multiple section labels', () => {
    const multiData = [...trafficData, ...highVariationData];
    const html = buildTrafficCardHTML(multiData);
    expect(html).toMatch(/Kroger/);
    expect(html).toMatch(/Downtown Office/);
  });

  test('L4 absent when trafficData is empty', () => {
    const html = buildTrafficCardHTML([]);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildTrafficCardHTML(trafficData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
