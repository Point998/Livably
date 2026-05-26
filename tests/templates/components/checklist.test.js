'use strict';
const { renderChecklist } = require('../../../src/templates/components/checklist');

describe('renderChecklist', () => {
  const items = [
    { icon: '🗺️', label: 'Verify flood zone', detail: 'Go to msc.fema.gov' },
    { icon: '📋', label: 'Request elevation certificate', detail: 'Ask the seller.' },
  ];

  test('returns a string', () => {
    expect(typeof renderChecklist({ heading: 'Things to Do', items })).toBe('string');
  });

  test('renders the heading', () => {
    const html = renderChecklist({ heading: '4 Things to Verify', items });
    expect(html).toContain('4 Things to Verify');
  });

  test('renders each item icon', () => {
    const html = renderChecklist({ heading: 'Steps', items });
    expect(html).toContain('🗺️');
    expect(html).toContain('📋');
  });

  test('renders each item label', () => {
    const html = renderChecklist({ heading: 'Steps', items });
    expect(html).toContain('Verify flood zone');
    expect(html).toContain('Request elevation certificate');
  });

  test('renders each item detail', () => {
    const html = renderChecklist({ heading: 'Steps', items });
    expect(html).toContain('Go to msc.fema.gov');
    expect(html).toContain('Ask the seller.');
  });

  test('escapes HTML in label and detail', () => {
    const xssItems = [{ icon: '⚠️', label: '<b>Label</b>', detail: '<script>bad</script>' }];
    const html = renderChecklist({ heading: 'Steps', items: xssItems });
    expect(html).not.toContain('<b>Label</b>');
    expect(html).not.toContain('<script>');
  });

  test('contains prem-safety-actions class', () => {
    const html = renderChecklist({ heading: 'Steps', items });
    expect(html).toContain('prem-safety-actions');
  });

  test('no inline styles', () => {
    const html = renderChecklist({ heading: 'Steps', items });
    expect(html).not.toContain('style="');
  });

  test('handles empty items array gracefully', () => {
    const html = renderChecklist({ heading: 'Steps', items: [] });
    expect(typeof html).toBe('string');
  });

  test('handles null items gracefully', () => {
    expect(() => renderChecklist({ heading: 'Steps', items: null })).not.toThrow();
  });
});
