'use strict';
const { renderFooter } = require('../../../src/templates/components/footer');

describe('renderFooter', () => {
  test('returns a string', () => {
    expect(typeof renderFooter({ source: 'FEMA NFHL', date: 'May 2026' })).toBe('string');
  });

  test('renders the source', () => {
    const html = renderFooter({ source: 'FEMA NFHL', date: 'May 2026' });
    expect(html).toContain('FEMA NFHL');
  });

  test('renders the date', () => {
    const html = renderFooter({ source: 'FEMA NFHL', date: 'May 2026' });
    expect(html).toContain('May 2026');
  });

  test('contains prem-disclaimer class', () => {
    const html = renderFooter({ source: 'USDA', date: 'May 2026' });
    expect(html).toContain('prem-disclaimer');
  });

  test('escapes HTML in source', () => {
    const html = renderFooter({ source: '<b>Bad</b>', date: 'May 2026' });
    expect(html).not.toContain('<b>Bad</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  test('no inline styles', () => {
    const html = renderFooter({ source: 'Census ACS', date: 'May 2026' });
    expect(html).not.toContain('style="');
  });

  test('handles missing date gracefully', () => {
    expect(() => renderFooter({ source: 'USDA' })).not.toThrow();
  });

  test('handles missing source gracefully', () => {
    expect(() => renderFooter({ date: 'May 2026' })).not.toThrow();
  });

  test('handles empty object gracefully', () => {
    expect(() => renderFooter({})).not.toThrow();
  });
});
