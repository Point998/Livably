'use strict';
const { buildTrafficCardHTML } = require('../../../src/templates/chapters/traffic');

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
