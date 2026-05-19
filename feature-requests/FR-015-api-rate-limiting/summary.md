# FR-015 — API Rate Limiting & Error Handling: Summary

## What was built

A transparent rate-limiting and error-handling layer around all Google Maps API calls. Every method call on `googleMapsClient` now passes through a concurrency limiter (max 5 simultaneous, 50ms inter-call delay) and a retry wrapper that handles 429 responses with exponential backoff. Quota and rate-limit errors surface as user-friendly error pages with a live countdown timer and an auto-enabled Retry button. All API calls are logged to a rolling 24-hour in-memory window.

## Changes

**`src/rateLimit.js`** (new file)
- `RateLimiter` class — `execute(fn)` queues calls when 5 are already active; adds 50ms delay before each call.
- `QuotaExceededError` (non-retryable) — thrown when the API returns `OVER_QUERY_LIMIT`.
- `RateLimitError` (retryable, carries `retryAfter` seconds) — thrown after all retry attempts exhaust on a 429 response.
- `makeGoogleMapsRequest(fn, endpoint, maxRetries=3)` — runs `fn` through the limiter, retries on 429 with a `retryAfter`-second wait between attempts, classifies and re-throws other errors.
- `usageLog` + `logApiCall()` + `getUsageStats()` — rolling 24-hour in-memory log with per-endpoint success/failure counts and overall success rate.

**`src/app.js`**
- `googleMapsClient` is now a Proxy that intercepts every method call and routes it through `makeGoogleMapsRequest`. Zero changes to individual call sites.
- `classifyError` updated to recognize `QuotaExceededError` and `RateLimitError` instances, returning `retryAfter` for the latter.
- `buildErrorHTML` enhanced: accepts optional `retryAfter` param; when set, renders a disabled `<button>` with a JS countdown that enables it and changes its label to "Retry Now" when the timer expires.
- `ERROR_ICONS` map added — each error type gets a distinct emoji (📍 not found, ⏱️ rate limit, 📊 quota, ⚠️ server error).
- `GET /admin/api-usage` — returns `getUsageStats()` JSON.

**`public/report.css`** — added `:disabled` state for `.btn-primary` / `.btn-retry` (dimmed, not-allowed cursor); white `#countdown` span inside the gold button.

## Deviations from spec

- No per-IP express-rate-limit middleware — not needed for a dev prototype; the Google Maps API concurrency limit is the binding constraint.
- Usage log is in-memory (resets on restart) rather than persisted — sufficient for local monitoring; production would write to a store.
