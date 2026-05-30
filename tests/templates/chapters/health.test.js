'use strict';
const { buildHealthSafetyChapterHTML } = require('../../../src/templates/chapters/health');

const hospital = { name: 'Georgetown Community Hospital', driveTimeMinutes: 12, address: '100 Hospital Dr' };
const emergency = {
  fire:   { name: 'Georgetown Fire Station 1', distanceMiles: '1.2', address: '10 Fire St',   response: { estimate: 5,  category: { label: 'Excellent', color: 'green'  } } },
  police: { name: 'Georgetown Police Dept',    distanceMiles: '0.8', address: '20 Police Ave', response: { estimate: 4,  category: { label: 'Excellent', color: 'green'  } } },
};

describe('buildHealthSafetyChapterHTML — FR-045 depth system', () => {
  test('section has data-depth="overview"', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('renders depth-l1 glance bar', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance bar shows ER drive time', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/12/);
    expect(html).toMatch(/min/i);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/class="chapter-body depth-l2"/);
  });

  test('depth selector rendered', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    expect(html).toMatch(/chapter-depth-control/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
