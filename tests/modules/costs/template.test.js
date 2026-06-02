'use strict';
const { buildPropertyDataHTML } = require('../../../src/modules/costs/template');

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

describe('buildPropertyDataHTML — L3 deep dive', () => {
  test('depth-l3 wrapper present', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/depth-l3/);
  });

  test('costs-deep-dive container rendered', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/costs-deep-dive/);
  });

  test('Long-Term View tab rendered', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/Long-Term View/);
  });

  test('30 Years stat label present', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/30 Years/);
  });

  test('5 Years stat label present', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/5 Years/);
  });

  test('Verify Before Closing tab rendered', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/Verify Before Closing/);
  });

  test('county assessor guidance present', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/assessor/i);
  });

  test('insurance quotes guidance present', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/insurance quotes/i);
  });

  test('utility bills guidance present', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/utility bills/i);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});

describe('buildPropertyDataHTML — L4 research', () => {
  test('depth-l4 wrapper present', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/depth-l4/);
  });

  test('extended carrying cost table rendered', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/climate-data-table/);
  });

  test('$200k price point in table', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/\$200,000/);
  });

  test('$500k price point in table', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/\$500,000/);
  });

  test('$350k price point in table', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/\$350,000/);
  });

  test('KY tax correctly calculated at $300k ($215/mo)', () => {
    // taxMo = round(300000 * 0.0086 / 12) = round(215) = 215
    const html = buildPropertyDataHTML(basePropertyData);
    expect(html).toMatch(/\$215/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildPropertyDataHTML(basePropertyData);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
