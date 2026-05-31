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
