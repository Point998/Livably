'use strict';

const { buildCompareFormHTML, buildCompareLoadingHTML, buildCompareResultsHTML } = require('../../../src/templates/pages/comparePage');

describe('buildCompareFormHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildCompareFormHTML();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('contains the compare form', () => {
    const html = buildCompareFormHTML();
    expect(html).toContain('compareForm');
  });
});

describe('buildCompareLoadingHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildCompareLoadingHTML('100 Main|200 Oak');
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });

  test('includes the addresses param', () => {
    const html = buildCompareLoadingHTML('100 Main|200 Oak');
    expect(html).toContain('100 Main|200 Oak');
  });
});

describe('buildCompareResultsHTML', () => {
  const reports = [
    {
      address: '100 Main St, Louisville, KY',
      services: { grocery: null, pharmacy: null, hospital: null, urgentCare: null, highwayRamp: null, gasStation: null },
    },
    {
      address: '200 Oak Ave, Louisville, KY',
      services: { grocery: null, pharmacy: null, hospital: null, urgentCare: null, highwayRamp: null, gasStation: null },
    },
  ];

  test('returns a complete HTML document', () => {
    const html = buildCompareResultsHTML(reports);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('renders address streets for each report', () => {
    const html = buildCompareResultsHTML(reports);
    expect(html).toContain('100 Main St');
    expect(html).toContain('200 Oak Ave');
  });

  test('renders error state for failed report', () => {
    const failedReports = [
      { address: '100 Main St, Louisville, KY', error: 'Not found', services: {} },
      { address: '200 Oak Ave, Louisville, KY', services: { grocery: null, pharmacy: null, hospital: null, urgentCare: null, highwayRamp: null, gasStation: null } },
    ];
    const html = buildCompareResultsHTML(failedReports);
    expect(html).toContain('Address not found');
  });
});
