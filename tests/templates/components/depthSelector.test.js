'use strict';
const { renderDepthSelector } = require('../../../src/templates/components/depthSelector');

describe('renderDepthSelector', () => {
  test('renders all 4 depth options', () => {
    const html = renderDepthSelector('climate');
    expect(html).toMatch(/data-depth="glance"/);
    expect(html).toMatch(/data-depth="overview"/);
    expect(html).toMatch(/data-depth="deepread"/);
    expect(html).toMatch(/data-depth="research"/);
  });

  test('overview is selected by default', () => {
    const html = renderDepthSelector('climate');
    expect(html).toMatch(/chapter-depth-option--selected[^>]*>Overview/);
  });

  test('custom default depth is reflected as selected', () => {
    const html = renderDepthSelector('garden', 'deepread');
    expect(html).toMatch(/chapter-depth-option--selected[^>]*>Deep Read/);
  });

  test('includes chKey as data-ch-key attribute', () => {
    const html = renderDepthSelector('garden');
    expect(html).toMatch(/data-ch-key="garden"/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = renderDepthSelector('climate');
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('escapes chKey to prevent XSS', () => {
    const html = renderDepthSelector('"><script>alert(1)</script>');
    expect(html).not.toMatch(/<script>/);
  });
});
