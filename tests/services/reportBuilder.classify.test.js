'use strict';
const { classifyError } = require('../../src/services/reportBuilder');
const { BudgetExceededError } = require('../../src/rateLimit');

test('BudgetExceededError classifies as a graceful capacity page', () => {
  const out = classifyError(new BudgetExceededError('places_nearby'));
  expect(out.type).toBe('QUOTA_EXCEEDED');
  expect(out.retryAfter).toBeNull();
  expect(out.title).toMatch(/capacity/i);
  expect(out.message).toBe("We've reached today's data-fetch limit. Please try again later.");
});
