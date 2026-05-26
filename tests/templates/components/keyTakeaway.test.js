'use strict';
const { renderKeyTakeaway } = require('../../../src/templates/components/keyTakeaway');

describe('renderKeyTakeaway', () => {
  test('returns a string', () => {
    expect(typeof renderKeyTakeaway({ icon: '🔑', text: 'Test takeaway.' })).toBe('string');
  });

  test('contains key-takeaway class', () => {
    const html = renderKeyTakeaway({ icon: '🔑', text: 'Test.' });
    expect(html).toContain('key-takeaway');
  });

  test('contains kt-icon and kt-body classes', () => {
    const html = renderKeyTakeaway({ icon: '🏠', text: 'Something important.' });
    expect(html).toContain('kt-icon');
    expect(html).toContain('kt-body');
  });

  test('renders the icon', () => {
    const html = renderKeyTakeaway({ icon: '⚠️', text: 'Watch out.' });
    expect(html).toContain('⚠️');
  });

  test('renders the text', () => {
    const html = renderKeyTakeaway({ icon: '🔑', text: 'This is the key insight.' });
    expect(html).toContain('This is the key insight.');
  });

  test('escapes HTML in text', () => {
    const html = renderKeyTakeaway({ icon: '🔑', text: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('no inline styles', () => {
    const html = renderKeyTakeaway({ icon: '🔑', text: 'No inline styles please.' });
    expect(html).not.toContain('style="');
  });

  test('handles null text gracefully', () => {
    expect(() => renderKeyTakeaway({ icon: '🔑', text: null })).not.toThrow();
  });

  test('handles missing icon gracefully', () => {
    expect(() => renderKeyTakeaway({ text: 'Just text, no icon.' })).not.toThrow();
  });
});
