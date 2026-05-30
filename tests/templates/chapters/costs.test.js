'use strict';
const { buildPropertyDataHTML } = require('../../../src/templates/chapters/costs');

const basePropertyData = {
  state: 'KY',
  taxRate: 0.86,
  insuranceYear: 1800,
  utilitiesMo: 180,
  homesteadNote: 'Kentucky offers a homestead exemption for homeowners age 65+.',
};

describe('buildPropertyDataHTML — FR-045 glance bar', () => {
  test('renders chapter-glance in depth-l1', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance shows carrying cost total at $300k', () => {
    // taxMo = round(300000 * 0.0086 / 12) = round(215) = 215
    // insMo = round(1800 / 12) = 150
    // total = 215 + 150 + 180 = 545
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/\$545\/mo carrying costs at \$300k/);
  });

  test('glance mentions "before mortgage"', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/before mortgage/);
  });

  test('returns empty string when property data is null', () => {
    const html = buildPropertyDataHTML(null);
    expect(html).toBe('');
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
