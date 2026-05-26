'use strict';
const { renderBucket, renderBuckets } = require('../../../src/templates/components/buckets');

describe('renderBucket', () => {
  test('returns a string', () => {
    expect(typeof renderBucket({ type: 'check', text: 'Verify the flood zone.' })).toBe('string');
  });

  test('contains bucket class', () => {
    const html = renderBucket({ type: 'check', text: 'Some check item.' });
    expect(html).toContain('bucket');
  });

  test('check type → bucket--check class', () => {
    const html = renderBucket({ type: 'check', text: 'Check this.' });
    expect(html).toContain('bucket--check');
  });

  test('consider type → bucket--consider class', () => {
    const html = renderBucket({ type: 'consider', text: 'Consider this.' });
    expect(html).toContain('bucket--consider');
  });

  test('cool type → bucket--cool class', () => {
    const html = renderBucket({ type: 'cool', text: 'Cool fact.' });
    expect(html).toContain('bucket--cool');
  });

  test('renders the correct label for check', () => {
    const html = renderBucket({ type: 'check', text: 'Something.' });
    expect(html).toContain('Things to Check');
  });

  test('renders the correct label for consider', () => {
    const html = renderBucket({ type: 'consider', text: 'Something.' });
    expect(html).toContain('Things to Consider');
  });

  test('renders the correct label for cool', () => {
    const html = renderBucket({ type: 'cool', text: 'Something.' });
    expect(html).toContain('Cool Things to Know');
  });

  test('renders the text', () => {
    const html = renderBucket({ type: 'check', text: 'Verify at msc.fema.gov' });
    expect(html).toContain('Verify at msc.fema.gov');
  });

  test('escapes HTML in text', () => {
    const html = renderBucket({ type: 'check', text: '<script>xss</script>' });
    expect(html).not.toContain('<script>');
  });

  test('no inline styles', () => {
    const html = renderBucket({ type: 'cool', text: 'Native oaks thrive here.' });
    expect(html).not.toContain('style="');
  });

  test('contains bucket-label class', () => {
    const html = renderBucket({ type: 'check', text: 'Text.' });
    expect(html).toContain('bucket-label');
  });
});

describe('renderBuckets', () => {
  test('renders multiple buckets', () => {
    const html = renderBuckets([
      { type: 'check', text: 'Check A.' },
      { type: 'consider', text: 'Consider B.' },
      { type: 'cool', text: 'Cool C.' },
    ]);
    expect(html).toContain('bucket--check');
    expect(html).toContain('bucket--consider');
    expect(html).toContain('bucket--cool');
  });

  test('returns empty string for empty array', () => {
    expect(renderBuckets([])).toBe('');
  });

  test('handles null gracefully', () => {
    expect(() => renderBuckets(null)).not.toThrow();
  });
});
