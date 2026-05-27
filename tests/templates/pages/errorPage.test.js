'use strict';

const { buildErrorHTML, buildLoadingHTML } = require('../../../src/templates/pages/errorPage');

describe('buildErrorHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildErrorHTML('SERVER_ERROR', 'Something went wrong', 'Please try again.', null, null);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('escapes the error title to prevent XSS', () => {
    const html = buildErrorHTML('SERVER_ERROR', '<b>Bad</b>', 'msg', null, null);
    expect(html).not.toContain('<b>Bad</b>');
  });

  test('includes Try again link when address is provided', () => {
    const html = buildErrorHTML('ADDRESS_NOT_FOUND', 'Not found', 'msg', '100 Main St', null);
    expect(html).toContain('Try again');
  });

  test('includes countdown button when retryAfter is provided', () => {
    const html = buildErrorHTML('RATE_LIMIT', 'High demand', 'msg', null, 30);
    expect(html).toContain('retryBtn');
    expect(html).toContain('30');
  });

  test('includes appropriate error icon for error type', () => {
    const html = buildErrorHTML('ADDRESS_NOT_FOUND', 'Not found', 'msg', null, null);
    expect(html).toContain('📍');
  });

  test('includes error type in meta tag for client detection', () => {
    const html = buildErrorHTML('RATE_LIMIT', 'High demand', 'msg', null, 30);
    expect(html).toContain('livably-error');
    expect(html).toContain('RATE_LIMIT');
  });
});

describe('buildLoadingHTML', () => {
  test('returns a complete HTML document', () => {
    const html = buildLoadingHTML('100 Main St, Louisville, KY');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  test('includes the address in the page', () => {
    const html = buildLoadingHTML('100 Main St, Louisville, KY');
    expect(html).toContain('100 Main St, Louisville, KY');
  });

  test('includes loading messages and progress bar script', () => {
    const html = buildLoadingHTML('100 Main St, Louisville, KY');
    expect(html).toContain('Finding your address');
    expect(html).toContain('loading-progress');
  });
});
