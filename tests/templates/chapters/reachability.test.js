'use strict';
const { buildInsightsCardHTML } = require('../../../src/templates/chapters/reachability');

const grocery = [{ name: 'Kroger', address: '100 Main St', driveTimeMinutes: 6 }];
const pharmacy = { name: 'CVS', address: '200 Main St', driveTimeMinutes: 4 };
const hospital = { name: 'Georgetown Hospital', address: '300 Hospital Dr', driveTimeMinutes: 12 };
const urgentCare = { name: 'AFC Urgent Care', address: '400 Care Ln', driveTimeMinutes: 8 };
const highwayRamp = { name: 'I-75 N', address: '500 Ramp Rd', driveTimeMinutes: 5 };
const gasStation = { name: "Casey's", address: '600 Gas Rd', driveTimeMinutes: 3 };

describe('buildInsightsCardHTML — FR-045 depth system', () => {
  test('section has data-depth="overview"', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('renders depth-l1 glance bar', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/chapter-glance/);
  });

  test('glance bar shows grocery drive time', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/Grocery: 6 min/);
  });

  test('glance bar shows ER drive time', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/ER: 12 min/);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/class="chapter-body depth-l2"/);
  });

  test('depth selector rendered', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/chapter-depth-control/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html.match(/style="(?!--)[^"]+"/g)).toBeNull();
  });
});
