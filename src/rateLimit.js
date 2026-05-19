class RateLimiter {
  constructor(maxConcurrent = 5, delayMs = 50) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
    this.activeRequests = 0;
  }

  async execute(fn) {
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.activeRequests++;
    try {
      if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      return await fn();
    } finally {
      this.activeRequests--;
    }
  }
}

class QuotaExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuotaExceededError';
    this.retryable = false;
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = 'RateLimitError';
    this.retryable = true;
    this.retryAfter = retryAfter;
  }
}

const rateLimiter = new RateLimiter(5, 50);

// Rolling 24-hour log of API calls (in-memory, resets on server restart)
const usageLog = [];

function logApiCall(endpoint, success) {
  usageLog.push({ endpoint, success, timestamp: Date.now() });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  while (usageLog.length && usageLog[0].timestamp < cutoff) usageLog.shift();
}

function getUsageStats() {
  const now = Date.now();
  const last24h = usageLog.length;
  const lastHour = usageLog.filter((l) => l.timestamp > now - 3_600_000).length;
  const byEndpoint = {};
  usageLog.forEach((l) => {
    if (!byEndpoint[l.endpoint]) byEndpoint[l.endpoint] = { total: 0, success: 0 };
    byEndpoint[l.endpoint].total++;
    if (l.success) byEndpoint[l.endpoint].success++;
  });
  const totalSuccess = usageLog.filter((l) => l.success).length;
  return {
    last24h,
    lastHour,
    byEndpoint,
    successRate: last24h > 0 ? ((totalSuccess / last24h) * 100).toFixed(2) + '%' : '0%',
  };
}

async function makeGoogleMapsRequest(fn, endpoint = 'unknown', maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await rateLimiter.execute(fn);
      logApiCall(endpoint, true);
      return result;
    } catch (error) {
      lastError = error;
      logApiCall(endpoint, false);

      // Quota exhausted (Google returns 200 with OVER_QUERY_LIMIT in the body, or an error object)
      const errMsg = (error.response?.data?.error_message || error.message || '').toLowerCase();
      if (errMsg.includes('over_query_limit') || errMsg.includes('quota')) {
        throw new QuotaExceededError('Daily API quota exceeded. Please try again tomorrow.');
      }

      // Rate limited (HTTP 429)
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers?.['retry-after'] || String(attempt * 2), 10);
        console.warn(`[RATE LIMIT] Attempt ${attempt}/${maxRetries}, retrying after ${retryAfter}s`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        throw new RateLimitError('We\'re experiencing high demand right now.', retryAfter);
      }

      // For all other errors, don't retry — throw immediately
      throw error;
    }
  }
  throw lastError;
}

module.exports = { makeGoogleMapsRequest, QuotaExceededError, RateLimitError, getUsageStats };
