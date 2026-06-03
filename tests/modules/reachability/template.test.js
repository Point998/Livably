'use strict';
const { buildInsightsCardHTML, buildAdditionalServicesCardHTML } = require('../../../src/modules/reachability/template');

const grocery = [{ name: 'Kroger', address: '100 Main St', driveTimeMinutes: 6 }];
const pharmacy = { name: 'CVS', address: '200 Main St', driveTimeMinutes: 4 };
const hospital = { name: 'Georgetown Hospital', address: '300 Hospital Dr', driveTimeMinutes: 12 };
const urgentCare = { name: 'AFC Urgent Care', address: '400 Care Ln', driveTimeMinutes: 8 };
const highwayRamp = { name: 'I-75 N', address: '500 Ramp Rd', driveTimeMinutes: 5 };
const gasStation = { name: "Casey's", address: '600 Gas Rd', driveTimeMinutes: 3 };

const baseLib  = { name: 'Scott County Public Library', address: '104 S Bradford Ln', location: {}, driveTimeMinutes: 4 };
const baseRec  = { name: 'Georgetown Recreation Center', address: '100 Rec Dr', location: {}, driveTimeMinutes: 6 };
const basePost = { name: 'Georgetown Main Post Office', address: '200 Main St', location: {}, driveTimeMinutes: 3 };

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

describe('buildAdditionalServicesCardHTML — civic infrastructure', () => {
  test('civic section rendered when library present', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, null, null);
    expect(html).toMatch(/civic-section/);
    expect(html).toMatch(/Scott County Public Library/);
  });

  test('all three civic items rendered', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, baseRec, basePost);
    expect(html).toMatch(/Scott County Public Library/);
    expect(html).toMatch(/Georgetown Recreation Center/);
    expect(html).toMatch(/Georgetown Main Post Office/);
  });

  test('civic section absent when all three null', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, null, null, null);
    expect(html).toBe('');
  });

  test('drive times rendered', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, null, null);
    expect(html).toMatch(/4 min/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, baseRec, basePost);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('existing school still renders alongside civic items', () => {
    const school = { name: 'Georgetown Middle School', address: '100 School Rd', driveTimeMinutes: 5 };
    const html = buildAdditionalServicesCardHTML(school, null, null, baseLib, null, null);
    expect(html).toMatch(/Georgetown Middle School/);
    expect(html).toMatch(/Scott County Public Library/);
  });
});
