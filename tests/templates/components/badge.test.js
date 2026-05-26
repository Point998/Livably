'use strict';
const { renderBadge, renderInlineBadge, badgeClass } = require('../../../src/templates/components/badge');

describe('badgeClass', () => {
  test('green → badge-green', () => expect(badgeClass('green')).toBe('badge-green'));
  test('lightgreen → badge-lightgreen', () => expect(badgeClass('lightgreen')).toBe('badge-lightgreen'));
  test('gold → badge-gold', () => expect(badgeClass('gold')).toBe('badge-gold'));
  test('orange → badge-orange', () => expect(badgeClass('orange')).toBe('badge-orange'));
  test('red → badge-red', () => expect(badgeClass('red')).toBe('badge-red'));
  test('muted → badge-muted', () => expect(badgeClass('muted')).toBe('badge-muted'));
  test('unknown color → badge-muted fallback', () => expect(badgeClass('purple')).toBe('badge-muted'));
  test('undefined → badge-muted fallback', () => expect(badgeClass()).toBe('badge-muted'));
});

describe('renderBadge', () => {
  test('returns a string', () => {
    expect(typeof renderBadge({ label: 'Excellent', color: 'green' })).toBe('string');
  });

  test('contains prem-badge class', () => {
    const html = renderBadge({ label: 'Good', color: 'gold' });
    expect(html).toContain('prem-badge');
  });

  test('contains the correct color class', () => {
    const html = renderBadge({ label: 'Consider', color: 'orange' });
    expect(html).toContain('badge-orange');
  });

  test('renders the label', () => {
    const html = renderBadge({ label: 'Zone X · Minimal Risk', color: 'green' });
    expect(html).toContain('Zone X · Minimal Risk');
  });

  test('escapes HTML in label', () => {
    const html = renderBadge({ label: '<b>Zone AE</b>', color: 'red' });
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  test('no inline styles', () => {
    const html = renderBadge({ label: 'Good', color: 'green' });
    expect(html).not.toContain('style="');
  });

  test('falls back to muted for unknown color', () => {
    const html = renderBadge({ label: 'Unknown', color: 'purple' });
    expect(html).toContain('badge-muted');
  });
});

describe('renderInlineBadge', () => {
  test('contains prem-inline-badge class', () => {
    const html = renderInlineBadge({ label: 'Excellent', color: 'green' });
    expect(html).toContain('prem-inline-badge');
  });

  test('renders the label', () => {
    const html = renderInlineBadge({ label: 'Fair', color: 'gold' });
    expect(html).toContain('Fair');
  });

  test('no inline styles', () => {
    const html = renderInlineBadge({ label: 'Good', color: 'green' });
    expect(html).not.toContain('style="');
  });
});
