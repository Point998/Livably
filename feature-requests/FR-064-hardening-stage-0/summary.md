# FR-064 — Hardening Stage 0: Summary

*Phase 4 complete · June 12, 2026 · branch `FR-064-hardening-stage-0`*
*Implements NR-004 "Hardening Track, Stage 0". Built via subagent-driven development (9 tasks, two-stage spec+quality review each).*

---

## What shipped

The four near-zero-cost substrate gaps from NR-004, closing every 🟠 finding except the state layer:

1. **CI workflow** (`.github/workflows/ci.yml`) — runs the full Jest suite on every push to `main` and every PR, across Node **20.x + 22.x**. Added `"engines": { "node": ">=20" }`. The 1,406-test suite now runs automatically instead of on-demand.
2. **Startup config validation** (`src/config.js`) — boot hard-crashes (`process.exit(1)`, clear `[config] FATAL:` message) if `GOOGLE_MAPS_API_KEY` is missing/blank; warns one line per missing optional key (naming the chapter that degrades). Wired at the top of `app.js` before the server is created.
3. **Admin auth** (`src/middleware/adminAuth.js`) — one `requireAdmin` guard mounted on `app.use('/admin', …)` covering all four routes (incl. the previously-unauthenticated cache-wiping `POST /admin/clear-cache`). Allows loopback OR a timing-safe `x-admin-token` match against `ADMIN_TOKEN`. Unset token → loopback-only (preserves prior behavior, now uniform).
4. **Helmet + inbound throttle** — `helmet()` with a tailored CSP (Google Fonts + unpkg, `img-src 'self' data:`); `express-rate-limit` with a loose global guard (100/min/IP on dynamic routes) + a tight metered guard (10/min/IP on the billed `/report` + `/compare` `fetch=1` path, loopback-exempt). Tripping the metered limit returns the existing graceful `RATE_LIMIT` page (loading page auto-retries after 30s) — not a bare 429.

## New packages

- `helmet@8.2.0` (dep)
- `express-rate-limit@8.5.2` (dep)
- No new dev deps — `supertest` was deliberately skipped; the testable logic (config validation, token compare, skip predicate) is pure and unit-tested directly.

## Tests

- **+22 tests** (1,384 → **1,406**, 76 suites, all green): config validation (6), adminAuth (12), rate-limiter skip predicate (4).
- Manual/runtime verification:
  - **CSP render (the one risk gate):** live browser smoke test of a real Georgetown KY report — Fraunces + DM Sans fonts loaded, 13 lucide SVG icons rendered from unpkg, 2 stylesheets, 11 chapters, **zero CSP violations / zero failed requests**.
  - **Boot crash path:** confirmed `exit 1` + `[config] FATAL:` on blank `GOOGLE_MAPS_API_KEY`.
  - **Admin guard:** loopback `curl` → 200 on all four routes.
  - **Throttle scoping:** `/report` carries `RateLimit-Limit` headers; `/report.css` (static) does not — static excluded from the budget.

## The CSP compromise (documented loudly, per spec)

The report/compare/error/loading templates emit inline `<script>` blocks **and** the loading page dynamically re-executes scripts (`reExecScripts`). A nonce/hash CSP would break rendering, so Stage 0 uses **`script-src 'unsafe-inline'` deliberately**. This is a functional, real CSP (it still locks down `object-src 'none'`, `frame-ancestors`, `base-uri`, `img-src`, `connect-src`, etc.) but is **not** XSS-hardened on scripts. Externalizing inline scripts to enable a strict `script-src` is a future hardening pass (Stage 2 territory). Documented in `app.js` at the directive.

## Code-review fixes applied during build

Two-stage review caught and fixed, per task: CI double-run + `fail-fast` (Task 1); `config.port` returned as string (Task 2); admin length-guard comment + socket-fallback test (Task 4); `img-src` over-broad `https:` tightened to `self data:` after verifying zero external image origins (Task 6); **global limiter moved after `express.static`** so cheap CSS/JS/font requests don't consume the per-IP budget and cause false 429s on normal page loads (Task 7).

## Explicitly deferred (NOT in this FR)

- 🔴 **State externalization** (`.cache`, `data/reports.json`, in-memory `usageLog`) → **Stage 1**. After FR-064 the app is still single-instance; a second instance behind a load balancer would still diverge. This is the real enterprise blocker, deferred until a B2B contract is in sight.
- 🟠 JSON read-modify-write races → falls out of the Stage 1 state swap.
- 🟡 In-process Puppeteer PDF (no timeout) → Stage 1/2.
- 🟡 Observability + TypeScript → Stage 2.
- 💰 **API spend ceiling / cost circuit-breaker → FR-065.** The throttle slows abuse but does not cap total spend; a real budget guard builds on `usageLog` and has its own UX decisions.

Stage 1 deferrals are documented in-code at their seams: `// app.set('trust proxy', 1)` in `app.js`, and the MemoryStore / IP-keying note in `rateLimiters.js`.

## 5-address rule (CONSTRAINT-011)

The rule targets location-search modules; FR-064 touches none. The relevant verification was "report still renders under CSP" + boot/guard/throttle behavior — all confirmed above.
