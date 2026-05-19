# FR-015 — API Rate Limiting & Error Handling: Implementation Plan

## Approach

`src/rateLimit.js` handles the rate limiter, retry logic, custom error classes, and usage tracking. All Google Maps API calls are transparently rate-limited by proxy-wrapping `googleMapsClient` at creation time — one change covers every method call in the file without touching individual call sites.

## Files changed

- `src/rateLimit.js` (new) — `RateLimiter`, `QuotaExceededError`, `RateLimitError`, `makeGoogleMapsRequest`, `getUsageStats`
- `src/app.js` — require rateLimit module; proxy-wrap `googleMapsClient`; update `classifyError` for new error types; enhance `buildErrorHTML` with countdown timer; add `/admin/api-usage` route
- `public/report.css` — disabled button state + countdown span color

## Key decisions

- **Proxy pattern** — instead of wrapping each of the ~20 `googleMapsClient.xxx()` call sites individually, a `Proxy` on the client instance intercepts every method call and routes it through `makeGoogleMapsRequest`. One change, complete coverage.
- **50ms inter-call delay + max 5 concurrent** — implemented in `RateLimiter.execute`. Requests queue up naturally when all 5 slots are occupied. The 50ms delay is added even on cache misses (before the actual API call).
- **Retry only on 429** — non-429 errors (network, bad address, etc.) are thrown immediately without retry to avoid wasted latency. Quota exhaustion is also non-retryable.
- **In-memory usage log** — rolling 24-hour window, trimmed on each write. Resets on server restart (acceptable for a dev prototype; production would use persistent storage).
- **Countdown timer UI** — `buildErrorHTML` now accepts an optional `retryAfter` seconds value; when set, injects a disabled retry button with a live JS countdown that enables the button and switches its label to "Retry Now" when time expires.
