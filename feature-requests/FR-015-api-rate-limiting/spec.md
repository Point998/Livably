# FR-015 — API Rate Limiting & Error Handling

## What
Implement graceful handling of Google Maps API rate limits and quota exhaustion with user-friendly error messages and retry mechanisms.

## Problem
Currently:
- No protection against API quota exhaustion
- Generic errors when rate limited
- No queuing or retry logic
- Users can't tell if issue is temporary or permanent
- Rapid-fire requests can burn through daily quota

## Requirements

### Rate Limit Detection
- Detect HTTP 429 (Rate Limit) responses from Google Maps API
- Detect quota exhaustion errors
- Distinguish between temporary and permanent failures

### User-Facing Behavior
When rate limited:
- Show clear error message: "We're experiencing high demand. Please try again in [X] seconds."
- Display countdown timer
- Provide "Retry" button (enabled after countdown)
- Optionally: Queue request and auto-retry

### Request Throttling
- Limit concurrent API requests (max 5 at a time)
- Add delay between requests (50-100ms)
- Implement request queue with backoff

### Admin Monitoring
- Track API usage metrics
- Alert when approaching quota limits
- Dashboard showing: requests/day, quota remaining, errors

## Implementation Notes

### Rate Limit Middleware

**Request queue (`src/rateLimit.js`):**
```javascript
class RateLimiter {
  constructor(maxConcurrent = 5, delayMs = 50) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
    this.activeRequests = 0;
    this.queue = [];
  }
  
  async execute(fn) {
    // Wait if at capacity
    while (this.activeRequests >= this.maxConcurrent) {
      await this.delay(100);
    }
    
    this.activeRequests++;
    
    try {
      // Add delay between requests
      await this.delay(this.delayMs);
      
      const result = await fn();
      return result;
    } finally {
      this.activeRequests--;
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const rateLimiter = new RateLimiter(5, 50);

module.exports = rateLimiter;
```

### API Call Wrapper with Retry Logic

```javascript
const rateLimiter = require('./rateLimit');

async function makeGoogleMapsRequest(apiCall, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Execute through rate limiter
      const result = await rateLimiter.execute(apiCall);
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if rate limited
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || (attempt * 2);
        console.log(`[RATE LIMIT] Attempt ${attempt}/${maxRetries}, retrying after ${retryAfter}s`);
        
        if (attempt < maxRetries) {
          await delay(retryAfter * 1000);
          continue;
        }
      }
      
      // Check quota exceeded
      if (error.response?.data?.error_message?.includes('OVER_QUERY_LIMIT')) {
        throw new QuotaExceededError('Daily API quota exceeded. Please try again tomorrow.');
      }
      
      // Non-retryable error
      throw error;
    }
  }
  
  throw lastError;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

module.exports = { makeGoogleMapsRequest, QuotaExceededError, RateLimitError };
```

### Update API Functions

**Geocoding with rate limiting:**
```javascript
const { makeGoogleMapsRequest } = require('./rateLimit');

async function geocodeAddress(address) {
  const cacheKey = address.toLowerCase().trim();
  
  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;
  
  // Wrap API call with rate limiting
  const geocodeResponse = await makeGoogleMapsRequest(async () => {
    return await googleMapsClient.geocode({
      params: { address, key: googleMapsApiKey },
    });
  });
  
  const geoResults = geocodeResponse.data.results || [];
  if (!geoResults.length) {
    throw new Error('Unable to geocode the address.');
  }
  
  const location = geoResults[0].geometry.location;
  geocodeCache.set(cacheKey, location);
  
  return location;
}
```

### Error Handling in Express

```javascript
const { QuotaExceededError, RateLimitError } = require('./rateLimit');

app.get('/report', async (req, res) => {
  const address = req.query.address;
  
  try {
    const reportData = await generateFullReport(address);
    const html = renderReport(reportData);
    return res.send(html);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return res.status(503).send(renderError({
        title: 'Service Temporarily Unavailable',
        message: error.message,
        type: 'quota',
        retryable: false
      }));
    }
    
    if (error instanceof RateLimitError) {
      return res.status(429).send(renderError({
        title: 'Too Many Requests',
        message: `We're experiencing high demand. Please try again in ${error.retryAfter} seconds.`,
        type: 'rate_limit',
        retryable: true,
        retryAfter: error.retryAfter
      }));
    }
    
    // Generic error
    return res.status(500).send(renderError({
      title: 'Something Went Wrong',
      message: error.message || 'Unable to generate report. Please try again.',
      type: 'error',
      retryable: true
    }));
  }
});
```

### Error Page Template

```javascript
function renderError({ title, message, type, retryable, retryAfter }) {
  const retryScript = retryable ? `
    <script>
      let countdown = ${retryAfter || 30};
      const btn = document.getElementById('retryBtn');
      const countdownEl = document.getElementById('countdown');
      
      const interval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        
        if (countdown <= 0) {
          clearInterval(interval);
          btn.disabled = false;
          btn.textContent = 'Retry Now';
        }
      }, 1000);
      
      btn.addEventListener('click', () => {
        window.location.reload();
      });
    </script>
  ` : '';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | Livably</title>
      <link rel="stylesheet" href="/report.css">
    </head>
    <body class="error-page">
      <div class="error-container">
        <div class="error-icon">${getErrorIcon(type)}</div>
        <h1>${title}</h1>
        <p class="error-message">${message}</p>
        
        ${retryable ? `
          <button id="retryBtn" class="btn-primary" ${retryAfter ? 'disabled' : ''}>
            ${retryAfter ? `Retry in <span id="countdown">${retryAfter}</span>s` : 'Retry Now'}
          </button>
        ` : ''}
        
        <a href="/" class="btn-secondary">Try a Different Address</a>
      </div>
      
      ${retryScript}
    </body>
    </html>
  `;
}

function getErrorIcon(type) {
  const icons = {
    quota: '📊',
    rate_limit: '⏱️',
    error: '⚠️'
  };
  return icons[type] || '⚠️';
}
```

### API Usage Tracking

```javascript
// Track API usage
const usageLog = [];

function logApiCall(endpoint, success) {
  usageLog.push({
    endpoint,
    success,
    timestamp: Date.now()
  });
  
  // Keep last 24 hours
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  while (usageLog.length > 0 && usageLog[0].timestamp < oneDayAgo) {
    usageLog.shift();
  }
}

// Wrap API calls with logging
async function makeGoogleMapsRequest(apiCall, endpoint, maxRetries = 3) {
  try {
    const result = await rateLimiter.execute(apiCall);
    logApiCall(endpoint, true);
    return result;
  } catch (error) {
    logApiCall(endpoint, false);
    throw error;
  }
}

// Admin endpoint for usage stats
app.get('/admin/api-usage', (req, res) => {
  const stats = {
    last24h: usageLog.length,
    lastHour: usageLog.filter(l => l.timestamp > Date.now() - 3600000).length,
    byEndpoint: {},
    successRate: 0
  };
  
  usageLog.forEach(log => {
    if (!stats.byEndpoint[log.endpoint]) {
      stats.byEndpoint[log.endpoint] = { total: 0, success: 0 };
    }
    stats.byEndpoint[log.endpoint].total++;
    if (log.success) stats.byEndpoint[log.endpoint].success++;
  });
  
  const totalSuccess = usageLog.filter(l => l.success).length;
  stats.successRate = usageLog.length > 0 ? 
    ((totalSuccess / usageLog.length) * 100).toFixed(2) + '%' : 
    '0%';
  
  res.json(stats);
});
```

### CSS for Error Page

```css
.error-page {
  background: var(--cream);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.error-container {
  max-width: 500px;
  text-align: center;
  background: white;
  padding: 3rem 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-message {
  color: var(--text-secondary);
  margin: 1.5rem 0;
  line-height: 1.6;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

#countdown {
  font-weight: 700;
  color: var(--gold);
}
```

## Acceptance Criteria
- [ ] Rate limiting prevents >5 concurrent requests
- [ ] 50ms delay between requests
- [ ] HTTP 429 errors handled gracefully
- [ ] Quota exceeded shows clear message
- [ ] Retry button appears with countdown
- [ ] Auto-retry after countdown (optional)
- [ ] API usage tracked and logged
- [ ] `/admin/api-usage` shows stats
- [ ] Cache integration reduces API calls (FR-014)
- [ ] User never sees raw API error messages

## Optional Enhancements (Future)
- [ ] Request queuing with priority
- [ ] Exponential backoff for retries
- [ ] Circuit breaker (stop requests after N failures)
- [ ] Real-time API quota monitoring
- [ ] Email alerts when quota low
- [ ] Auto-scaling rate limits based on quota
- [ ] User-specific rate limits (prevent abuse)
- [ ] Graceful degradation (partial reports)

## Testing Scenarios
1. **Normal load** → All requests succeed
2. **High concurrent load** → Rate limiting activates
3. **Simulate 429 response** → Retry logic works
4. **Simulate quota exceeded** → Shows quota error
5. **Retry button** → Countdown works, retry succeeds
6. **Cache + rate limit** → Cached requests bypass rate limit
7. **Admin stats** → Shows accurate usage counts

## Monitoring & Alerts

**Alert thresholds:**
- Warning: >1000 requests/hour
- Critical: >5000 requests/day
- Quota: >80% of daily limit

**Metrics to track:**
- Requests per minute/hour/day
- Success rate
- Average response time
- Cache hit rate
- Rate limit hits
- Quota usage

## Dependencies
- No new NPM packages required (built-in)
- Optional: `express-rate-limit` for per-IP limiting

```bash
npm install express-rate-limit  # Optional
```

## Estimated Effort
**Medium** — 3-4 hours
- Rate limiter class
- Request wrapper with retry
- Error handling in routes
- Error page templates
- Usage tracking
- Admin endpoints
- Testing rate limit scenarios
