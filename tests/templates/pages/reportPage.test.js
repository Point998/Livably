'use strict';

const {
  buildGrocerySection,
  buildDestSection,
  buildSchoolSection,
  buildReportHTML,
} = require('../../../src/templates/pages/reportPage');

describe('buildGrocerySection', () => {
  test('returns fallback with Google Maps link when stores is null', () => {
    const html = buildGrocerySection(null);
    expect(html).toContain('google.com/maps/search/grocery');
  });

  test('renders store name and drive time when stores provided', () => {
    const stores = [{ name: 'Kroger', address: '100 Main', driveTimeMinutes: 8 }];
    const html = buildGrocerySection(stores);
    expect(html).toContain('Kroger');
    expect(html).toContain('8 min');
  });
});

describe('buildDestSection', () => {
  test('returns fallback with search link when result is null', () => {
    const html = buildDestSection('Pharmacy', null);
    expect(html).toContain('google.com/maps/search/');
    expect(html).toContain('Pharmacy');
  });

  test('renders name and drive time when result provided', () => {
    const result = { name: 'CVS', address: '200 Oak', driveTimeMinutes: 5 };
    const html = buildDestSection('Pharmacy', result);
    expect(html).toContain('CVS');
    expect(html).toContain('5 min');
  });
});

describe('buildSchoolSection', () => {
  test('returns district contact fallback when school is null', () => {
    const html = buildSchoolSection(null);
    expect(html).toContain('school district');
  });

  test('renders school name and drive time', () => {
    const school = { name: 'Lincoln Elementary', address: '300 Elm', driveTimeMinutes: 7, note: null };
    const html = buildSchoolSection(school);
    expect(html).toContain('Lincoln Elementary');
  });
});

describe('buildReportHTML', () => {
  const minData = {
    grocery: null, pharmacy: null, hospital: null, urgentCare: null,
    highwayRamp: null, school: null, gasStation: null, park: null,
    coffeeShop: null, elementarySchool: null, customDestinations: [],
    trafficData: [], origin: { lat: 38.3, lng: -84.4 }, reportId: null, chapters: null,
  };

  test('returns a complete HTML document', () => {
    const html = buildReportHTML('100 Main St, Louisville, KY', minData);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('contains no inline style attributes (CONSTRAINT-008)', () => {
    const html = buildReportHTML('100 Main St, Louisville, KY', minData);
    expect(html).not.toMatch(/style="/);
  });

  test('escapes address to prevent XSS', () => {
    const html = buildReportHTML('<script>alert(1)</script>', minData);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('buildReportHTML — reach chapter depth system (FR-045)', () => {
  const minimalArgs = {
    grocery: [{ name: 'Kroger', address: '100 Main', driveTimeMinutes: 6 }],
    pharmacy: { name: 'CVS', address: '200 Main', driveTimeMinutes: 4 },
    hospital: { name: 'Georgetown Hospital', address: '300 Hospital', driveTimeMinutes: 12 },
    urgentCare: null,
    highwayRamp: { name: 'I-75 N', address: '500 Ramp', driveTimeMinutes: 5, note: null },
    school: null,
    gasStation: null,
    park: null,
    coffeeShop: null,
    elementarySchool: null,
    customDestinations: [],
    trafficData: [],
    origin: { lat: 38.2, lng: -84.5 },
    reportId: null,
    chapters: null,
  };

  test('reach section has data-depth="overview"', () => {
    const html = buildReportHTML('123 Main St, Georgetown, KY 40324', minimalArgs);
    expect(html).toMatch(/data-ch="reach"[^>]*data-depth="overview"|data-depth="overview"[^>]*data-ch="reach"/);
  });

  test('reach section has depth-l1 glance bar with grocery and ER', () => {
    const html = buildReportHTML('123 Main St, Georgetown, KY 40324', minimalArgs);
    expect(html).toMatch(/data-ch="reach"/);
    expect(html).toMatch(/Grocery: 6 min/);
    expect(html).toMatch(/ER: 12 min/);
  });

  test('reach section has depth selector', () => {
    const html = buildReportHTML('123 Main St, Georgetown, KY 40324', minimalArgs);
    expect(html).toMatch(/data-ch-key="reach"/);
  });
});
