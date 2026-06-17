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

// FR-066 — OSM straight-line fallback rendering (Google down). Records carry
// distanceMiles + driveTimeMinutes:null + proximitySource:'osm-straightline'.
describe('buildInsightsCardHTML — FR-066 OSM straight-line fallback', () => {
  const osmGrocery = [{ name: 'OSM Kroger', address: null, location: {}, driveTimeMinutes: null, distanceMiles: 1.2, proximitySource: 'osm-straightline' }];
  const osmPharmacy = { name: 'OSM CVS', address: null, location: {}, driveTimeMinutes: null, distanceMiles: 0.8, proximitySource: 'osm-straightline' };

  test('renders straight-line distance, never "null min"', () => {
    const html = buildInsightsCardHTML(osmGrocery, osmPharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/~1\.2 mi/);
    expect(html).not.toMatch(/null min/);
  });

  test('shows the honest straight-line / OpenStreetMap caveat', () => {
    const html = buildInsightsCardHTML(osmGrocery, osmPharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/straight-line/i);
    expect(html).toMatch(/OpenStreetMap/);
  });

  test('glance bar shows grocery distance when no drive time', () => {
    const html = buildInsightsCardHTML(osmGrocery, osmPharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/Grocery: ~1\.2 mi/);
  });

  test('Google path still renders minutes unchanged', () => {
    const html = buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation);
    expect(html).toMatch(/Grocery: 6 min/);
    expect(html).not.toMatch(/straight-line/i);
  });
});

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

const { buildInsightsCardHTML: buildIC, buildLifeCalculatorHTML } = require('../../../src/modules/reachability/template');

const LIFECALC = {
  profile: { commuteDaysPerWeek: 3, commuteOneWayMiles: 15, groceryTripsPerWeek: 1, cityTripsPerMonth: 1, hasKidsInSchool: false },
  rates: {
    marginalCostPerMile: 0.2364, irsRatePerMile: 0.67, evKwhPerMile: 0.30, electricRatePerKwh: 0.16,
    gasPricePerGallon: 3.41, avgMpg: 25, maintenancePerMile: 0.10,
    tripDistances: { groceryRoundTripMiles: 12, cityRoundTripMiles: 60, schoolRoundTripMiles: 8, schoolDaysPerWeek: 5 },
    sources: { gas: 'EIA', irs: 'fallback' }, asOf: { gas: '2026-06-01', irs: null },
  },
  bounds: { commuteDaysPerWeek: [0,7], commuteOneWayMiles: [0,200], groceryTripsPerWeek: [0,7], cityTripsPerMonth: [0,8] },
};
const G = [{ name: 'Kroger', address: '1 St', driveTimeMinutes: 6 }];

describe('Life-at-Address calculator block', () => {
  test('renders inside the daily chapter when lifeCalc provided', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    expect(html).toContain('life-calc');
    expect(html).toContain('data-ch="daily"');
  });
  test('renders the computed default headline (marginal) + annual miles', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    expect(html).toMatch(/life-calc-cost-marginal/);
    expect(html).toMatch(/life-calc-annual-miles/);
  });
  test('embeds a JSON config script for the client', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    expect(html).toContain('id="life-calc-config"');
    expect(html).toContain('application/json');
  });
  test('omitting lifeCalc leaves the chapter unchanged (back-compat)', () => {
    const html = buildIC(G, null, null, null, null, null);
    expect(html).not.toContain('life-calc');
  });
  test('no scoring language in the chapter', () => {
    const html = buildIC(G, null, null, null, null, null, LIFECALC);
    expect(html.toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b|out of 10/);
  });
  test('buildLifeCalculatorHTML returns empty string without lifeCalc/rates', () => {
    expect(buildLifeCalculatorHTML(null)).toBe('');
    expect(buildLifeCalculatorHTML({ profile: {}, bounds: {} })).toBe(''); // no rates
  });
  test('calculator block itself has no inline styles (CONSTRAINT-008)', () => {
    // Scope to the calculator block — the surrounding chapter's icon SVG carries
    // pre-existing, project-tolerated --path-len custom-property styles.
    const block = buildLifeCalculatorHTML(LIFECALC);
    expect(block).not.toMatch(/style="/);
  });
  test('EV note reflects national rate when sources.electric is not local', () => {
    const block = buildLifeCalculatorHTML(LIFECALC); // sources.electric undefined
    expect(block).toMatch(/national-average electricity rate/);
  });
  test('EV note reflects the local rate when sources.electric is local (FR-032 seam)', () => {
    const local = { ...LIFECALC, rates: { ...LIFECALC.rates, electricRatePerKwh: 0.131, sources: { ...LIFECALC.rates.sources, electric: 'local' } } };
    const block = buildLifeCalculatorHTML(local);
    expect(block).toMatch(/this address's electricity rate/);
    expect(block).toContain('13¢/kWh'); // round(0.131*100)
  });
});
