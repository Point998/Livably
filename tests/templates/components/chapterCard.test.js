'use strict';
const { renderChapterCard } = require('../../../src/templates/components/chapterCard');

describe('renderChapterCard', () => {
  const base = () => renderChapterCard('test', '01', null, 'Test', 'Test Title', null, '<p>left</p>', null, null, null);

  test('renders with required args', () => {
    const html = base();
    expect(html).toMatch(/data-ch="test"/);
    expect(html).toMatch(/Test Title/);
  });

  test('has data-depth="overview" by default', () => {
    const html = base();
    expect(html).toMatch(/data-depth="overview"/);
  });

  test('renders depth selector dropdown', () => {
    const html = base();
    expect(html).toMatch(/chapter-depth-control/);
    expect(html).toMatch(/data-depth="glance"/);
  });

  test('glanceHTML is rendered in depth-l1 div when provided', () => {
    const html = renderChapterCard('test', '01', null, 'T', 'T', null, '<p>left</p>', null, null, null, '<span class="glance-test">X</span>');
    expect(html).toMatch(/depth-l1/);
    expect(html).toMatch(/glance-test/);
  });

  test('glanceHTML is absent when not provided', () => {
    const html = base();
    expect(html).not.toMatch(/depth-l1/);
  });

  test('chapter-body has depth-l2 class', () => {
    const html = base();
    expect(html).toMatch(/class="chapter-body depth-l2"/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = base();
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
