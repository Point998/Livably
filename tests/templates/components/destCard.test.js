'use strict';
const { renderDestCard, renderDestSection } = require('../../../src/templates/components/destCard');

describe('renderDestCard', () => {
  const dest = {
    name: 'Kroger',
    address: '100 Main St, Georgetown, KY',
    driveTimeMinutes: 8,
  };

  test('returns a string', () => {
    expect(typeof renderDestCard(dest)).toBe('string');
  });

  test('renders the name', () => {
    expect(renderDestCard(dest)).toContain('Kroger');
  });

  test('renders the address', () => {
    expect(renderDestCard(dest)).toContain('100 Main St, Georgetown, KY');
  });

  test('renders formatted drive time', () => {
    const html = renderDestCard(dest);
    expect(html).toContain('8');
    expect(html).toContain('min');
  });

  test('contains drive-time class', () => {
    expect(renderDestCard(dest)).toContain('drive-time');
  });

  test('contains dest-name and dest-address classes', () => {
    const html = renderDestCard(dest);
    expect(html).toContain('dest-name');
    expect(html).toContain('dest-address');
  });

  test('escapes HTML in name and address', () => {
    const html = renderDestCard({ name: '<b>Store</b>', address: '1 St & Ave', driveTimeMinutes: 5 });
    expect(html).not.toContain('<b>Store</b>');
  });

  test('no inline styles', () => {
    expect(renderDestCard(dest)).not.toContain('style="');
  });

  test('renders optional note when provided', () => {
    const html = renderDestCard({ ...dest, note: 'Assigned school requires verification.' });
    expect(html).toContain('Assigned school requires verification.');
  });

  test('no note element when note is absent', () => {
    const html = renderDestCard(dest);
    expect(html).not.toContain('dest-note');
  });
});

describe('renderDestSection', () => {
  test('contains dest-section class', () => {
    const html = renderDestSection({
      label: 'Grocery Stores',
      dest: { name: 'Kroger', address: '100 Main St', driveTimeMinutes: 8 },
    });
    expect(html).toContain('dest-section');
  });

  test('renders the label', () => {
    const html = renderDestSection({ label: 'Pharmacy', dest: { name: 'CVS', address: '1 St', driveTimeMinutes: 5 } });
    expect(html).toContain('Pharmacy');
  });

  test('renders fallback with Google Maps link when dest is null', () => {
    const html = renderDestSection({ label: 'Hospital', dest: null });
    expect(html).toContain('google.com/maps');
    expect(html).toContain('Hospital');
  });

  test('no inline styles', () => {
    const html = renderDestSection({ label: 'Gas Station', dest: { name: 'Shell', address: '2 Rd', driveTimeMinutes: 3 } });
    expect(html).not.toContain('style="');
  });
});
