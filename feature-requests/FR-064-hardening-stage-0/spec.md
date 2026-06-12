# FR-064 — Hardening Stage 0

*Status: SPEC · Phase 2 of the 4-phase workflow · Created June 12, 2026*
*Source: NR-004 Architecture Hardening Review → roadmap **Hardening Track, Stage 0***

---

## Purpose

Take Livably from "prototype" to "safely deployable as a single instance" by closing the four near-zero-cost substrate gaps NR-004 identified. This is edge-hardening — **no product, data, chapter, or design changes**, and explicitly **no state-layer changes** (that is Stage 1).

**One-line framing:** config can't silently misboot, admin routes can't be poked anonymously, a script can't trivially run up the Google bill, and regressions can't land unnoticed.

## Scope boundary (what this FR is NOT)

These are deliberately deferred, not overlooked:

- 🔴 **State externalization** (`.cache/*.json`, `data/reports.json`, in-memory `usageLog`) → **Stage 1**. After FR-064, the app is still single-instance; a second instance behind a load balancer would still diverge. This is the real enterprise blocker and stays deferred until a B2B contract is in sight.
- 🟠 **JSON read-modify-write races** → falls out of the Stage 1 state swap.
- 🟡 **In-process Puppeteer PDF** (no timeout, ~300MB/req) → Stage 1/2.
- 🟡 **Observability layer + TypeScript** → Stage 2.
- 💰 **API spend ceiling / cost circuit-breaker** → **FR-065** (separate spec). The throttle in this FR slows abuse but does **not** cap total spend; a real budget guard builds on the existing `usageLog` and has its own UX decisions.

## Module placement

This is cross-cutting infrastructure, not a chapter module. It lives in the **server/shared layer**:
- `src/config.js` — boot-time configuration validation (new)
- `src/middleware/adminAuth.js` — admin route guard (new)
- `src/app.js` — wiring (helmet, limiters, config call, guard mount)
- `.github/workflows/ci.yml` — CI (new)
- `package.json`, `.env.example` — metadata/docs

No `src/modules/*` files are touched. No business/coherence rules change, so `validate.js` is untouched (CONSTRAINT-014 respected — this adds no cross-module coherence logic).

---

## Component 1 — CI workflow

**Goal:** the 1,384-test suite runs automatically on every push and PR instead of only on demand.

- **File:** `.github/workflows/ci.yml`
- **Triggers:** `push` and `pull_request`.
- **Matrix:** Node `20.x` and `22.x` on `ubuntu-latest`.
- **Steps:** checkout → `actions/setup-node` (with `npm` cache) → `npm ci` → `npm test`.
- **package.json:** add `"engines": { "node": ">=20" }`. (Local dev runs Node v26; `>=20` keeps both valid and CI proves the LTS floor. Matrix can grow to 24/26 later.)

**Acceptance:**
- A push with a deliberately failing test makes the workflow red.
- A green suite on Node 20 and 22 makes the workflow green.
- No secrets required (tests do not hit live APIs).

**Edge cases:**
- If any test currently depends on a network call or env var, CI will surface it — fix the test to be hermetic, do **not** add live keys to CI.

---

## Component 2 — Startup config validation

**Goal:** fail loud at boot on misconfiguration; never silently serve errors at request time.

- **File:** `src/config.js` (new). Exports a `validateConfig()` (run once at boot) and a frozen config object.
- **Required (hard-crash):** `GOOGLE_MAPS_API_KEY`. If missing/blank → print a clear single message and `process.exit(1)`.
- **Optional (warn, proceed):** `NOAA_CDO_API_KEY`, `NREL_API_KEY`, `EIA_API_KEY`, `CENSUS_API_KEY`, `AIRNOW_API_KEY`, `OPENCHARGEMAP_API_KEY`. Each missing key → one `WARN` line naming the chapter that will degrade. Matches graceful-degradation doctrine (CONSTRAINT-015).
- **Also surfaced:** `ADMIN_TOKEN` (optional — informs Component 3), `PORT` (optional).
- **Wiring:** called at the top of `src/app.js` before `app.listen`.

**Non-goal:** this does **not** refactor the ~8 scattered `process.env` reads in module `data.js` files. Those own their own per-request fallback logic and stay as-is. `config.js` is the boot gate, not a config-access rewrite.

**Also:** patch `.env.example` to document the two keys currently missing from it — `AIRNOW_API_KEY` (Sensory air quality) and `CENSUS_API_KEY` (Community/Growth).

**Acceptance:**
- Boot with `GOOGLE_MAPS_API_KEY` unset → process exits non-zero with a clear message; server does **not** start listening.
- Boot with all optional keys unset → server starts; one WARN per missing optional key printed.
- Boot fully configured → server starts; no warnings.

**Edge cases:**
- Key present but whitespace-only → treated as missing.
- `.env` absent entirely → required-key crash path fires (correct).

---

## Component 3 — Admin guard (loopback IP + token)

**Goal:** all four `/admin/*` routes share one guard; the three currently-unauthenticated ones (incl. the cache-wiping `POST /admin/clear-cache`) are closed.

- **File:** `src/middleware/adminAuth.js` (new) → `requireAdmin` middleware.
- **Mount:** `app.use('/admin', requireAdmin)` (covers `/admin/health`, `/admin/api-usage`, `/admin/clear-cache`, `/admin/cache-stats`). Removes the now-redundant inline IP check in `/admin/health`.
- **Allow rule:** request IP is loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) **OR** `ADMIN_TOKEN` is set and the request presents a matching `x-admin-token` header.
- **Token comparison:** `crypto.timingSafeEqual` (length-checked first to avoid throw). No timing side-channel.
- **Default posture:** if `ADMIN_TOKEN` is unset → loopback-only (preserves today's behavior, now uniformly across all four routes).
- **Reject:** `403 Forbidden`.

**Acceptance:**
- Loopback request → allowed on all four routes (token or not).
- Non-loopback request, `ADMIN_TOKEN` set, correct header → allowed.
- Non-loopback request, `ADMIN_TOKEN` set, wrong/absent header → 403.
- Non-loopback request, `ADMIN_TOKEN` unset → 403.

**Edge cases:**
- `ADMIN_TOKEN` set but empty string → treated as unset (loopback-only).
- Header present but wrong length → rejected without invoking `timingSafeEqual` on mismatched buffers.

---

## Component 4 — Helmet + inbound throttle

**Goal:** standard security headers + a per-IP abuse guard on the metered build path.

### 4a — helmet
- `helmet()` applied app-wide (before routes).
- **Tailored CSP** so the report still renders: `style-src` allows `'self'` + `fonts.googleapis.com`; `font-src` allows `'self'` + `fonts.gstatic.com`. Other directives at helmet defaults.

> ⚠️ **Primary risk.** Helmet's CSP will blank-page the report if any template emits an inline `<script>`. CONSTRAINT-008 bans inline *styles* but not scripts. **Implementation gate:** grep all `src/templates/**` and `src/modules/**/template.js` for inline `<script>`/event-handler attributes *before* enabling CSP. If found: externalize to `public/` or add a per-response CSP nonce. Verify a rendered report visually before completion. **Fallback** if it proves messy: ship helmet with `contentSecurityPolicy: false` in Stage 0 and file CSP hardening as a fast-follow — documented explicitly in summary.md, not silently.

### 4b — express-rate-limit (two limiters)
- **Global limiter:** ~100 requests / minute / IP, app-wide. Blanket DoS cap.
- **Metered limiter:** ~10 requests / minute / IP on `/report` and `/compare`, with `skip: (req) => req.query.fetch !== '1'` so only the *billed* build path counts (the loading-page render and redirects are free).
- **Limit-exceeded handler:** returns the existing `buildErrorHTML` rate-limit state (graceful, CONSTRAINT-015) — **not** bare `429` JSON — for the HTML routes.
- **`trust proxy`:** set to a single-instance-safe value with a `// Stage 1: revisit behind load balancer` comment (correct client IP keying behind a proxy is a Stage 1 concern).

**Acceptance:**
- Response headers include helmet defaults (e.g. `X-Content-Type-Options: nosniff`, `X-Frame-Options`/frameguard, CSP).
- A rendered report for at least one test address displays correctly with CSP active (fonts load, layout intact).
- >10 `fetch=1` report builds within a minute from one IP → 11th returns the graceful rate-limit page, not a built report.
- Loading-page renders (`fetch` absent) are **not** counted against the metered limit.
- >100 req/min/IP to any route → global limiter trips.

**Edge cases:**
- PDF route (`/report/pdf`) drives `/report` internally over localhost — confirm the metered limiter's loopback traffic does not throttle PDF generation (loopback exemption or sufficient headroom).

---

## Testing (CONSTRAINT-011)

Unit tests (new files under `tests/`):
- **config:** required-missing → throws/exits; optional-missing → warns + proceeds; fully-configured → clean.
- **adminAuth:** loopback allowed; valid token allowed; wrong/absent token on non-loopback → 403; `ADMIN_TOKEN` unset → loopback-only.
- **metered limiter skip predicate:** `fetch=1` counted, `fetch` absent skipped.

Manual verification:
- Full suite (`npm test`) green (1,384 + new tests).
- Smoke-test a rendered report with helmet/CSP active (CSP risk gate above).

**Packages added** (documented in summary.md per "Do Not"): `helmet`, `express-rate-limit` (deps). `supertest` (dev) **only if** route-level integration tests are wanted — default is to test the pure pieces and skip the dep.

**5-address rule (CONSTRAINT-011):** applies to location-search modules; FR-064 touches none. The relevant verification here is "report still renders under CSP," not per-address search correctness.

---

## Acceptance criteria (rollup — "done for now")

1. CI runs the full suite on every push/PR (Node 20 + 22); red on failure.
2. App hard-crashes at boot on missing `GOOGLE_MAPS_API_KEY`; warns (not crashes) on missing optional keys.
3. All four `/admin/*` routes reject anonymous non-loopback access; token unlocks deployed access.
4. No public endpoint can be turned into an unbounded Google bill via simple per-IP flooding; security headers present; report still renders.
5. Full test suite green, including new unit tests.
6. No changes to chapters, data, design, or the state layer.

## Out of scope (restated for the planner)

State externalization · PDF out-of-process · observability · TypeScript · spend circuit-breaker (FR-065).
