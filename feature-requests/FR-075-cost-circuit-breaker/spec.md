# FR-075 — Cost Circuit-Breaker: Specification

*Phase 2 (Specification). Discovery complete; design approved via brainstorming 2026-06-18.*
*Module: cross-cutting infrastructure — new `src/costBreaker.js`, wired at the `src/rateLimit.js` chokepoint.*
*Implements the NR-004 / FR-064 deferred item: "the throttle slows abuse but does not cap total spend."*

---

## 1. Problem

Every billed Google Maps call routes through one function — `makeGoogleMapsRequest(fn, endpoint)` in `src/rateLimit.js` (via the `Proxy` in `src/shared/google/client.js`). Today that path has:

- a **concurrency** limiter (max 5 in flight) — caps *parallelism*, not total volume;
- a per-IP **express-rate-limit** (FR-064) — caps *request rate per IP*, not cumulative spend;
- `usageLog` — a rolling-24h **record** of calls, but with **no ceiling**.

Nothing caps cumulative billed volume. A runaway retry loop, a buggy test harness, or distributed abuse can run Google API spend with no kill-switch. During the current phase (internal testing + limited live tests with real-estate agents) the goal is to **stay inside Google's monthly free tier** and never silently cross into paid usage.

### Google Maps Platform free tier (confirmed 2026-06-18, effective 2025-03-01)
The old flat "$200/month credit" was replaced with **per-SKU monthly free call allotments**, reset each **calendar month**, metered **independently per SKU**:
- **Essentials** tier: 10,000 free calls/SKU/month (Geocoding, Distance Matrix)
- **Pro** tier: 5,000 free calls/SKU/month (Places Nearby Search, Places Text Search)
- Below the allotment = **$0**; above = per-call paid.

Implication: while testing, real cost is **$0 until a specific SKU crosses its monthly free line**. The meaningful guard is therefore a **per-SKU call budget**, not a flat dollar figure.

---

## 2. Goal

Enforce a **tight, per-SKU, rolling-24h call budget** at the billed chokepoint, defaulted so that staying under the daily cap keeps each SKU under its monthly free allotment — plus a manual kill-switch for hands-on control during live tests. Keep all state in-memory on the same substrate as `usageLog` so it migrates into Stage-1 state externalization for free.

### Non-goals (explicitly deferred)
- **Exact calendar-month per-SKU budget** (e.g. trip at 9,000 of 10,000 *this month*) — needs durable month-to-date counters → **Hardening Stage 1**.
- **Multi-instance correctness** — budgets are per-process until state is externalized (Stage 1).
- **Persisting force-trip across restarts** — falls out of Stage 1.
- **Element-exact Distance Matrix accounting** — see §6 approximation note.
- No scoring/rating of any kind (CONSTRAINT-001 — N/A, infra).

---

## 3. SKU model

Derived from the production Google surface (`grep googleMapsClient.<method>` over `src/`). The `endpoint` label passed to `makeGoogleMapsRequest` is the client **method name** (`prop` in the Proxy).

| `endpoint` label(s)         | SKU bucket key  | Google SKU            | Tier       | Free/mo | ~$/call (est.) |
|-----------------------------|-----------------|-----------------------|------------|---------|----------------|
| `geocode`, `reverseGeocode` | `geocoding`     | Geocoding             | Essentials | 10,000  | ~$0.005        |
| `distancematrix`            | `distancematrix`| Distance Matrix       | Essentials | 10,000  | ~$0.005/elem   |
| `placesNearby`              | `places_nearby` | Places Nearby Search  | Pro        | 5,000   | ~$0.032        |
| `textSearch`                | `places_text`   | Places Text Search    | Pro        | 5,000   | ~$0.032        |

- Two endpoint labels (`geocode`, `reverseGeocode`) map to the **same** `geocoding` SKU bucket and share one budget.
- Any **unmapped** endpoint label (future-proofing) maps to a default bucket `other` with a conservative cap and is logged once so we notice an unbucketed SKU.
- Pricing/tier values are **estimates**, surfaced as "estimated," and live in a single table so a Google reprice is a one-file edit. They are env-overridable.
- **To confirm in Phase 3/4:** the `distancematrix` tier is treated here as Essentials (10k free → cap 200) pending verification against Google's current SKU list. If Distance Matrix is in fact a **Pro** SKU (5k free), set `freeMonthly = 5000` and `dailyCap = 100`. The AC7 guard test (§12) enforces `cap × 30 ≤ freeMonthly` against whatever the table declares, so the relationship stays correct either way — only the absolute number needs the check.

### Default caps (tight; `freeMonthly ÷ 30 × safetyMargin`, `safetyMargin = 0.6`)
| Bucket          | freeMonthly | ÷30  | × 0.6 | **Default dailyCap** |
|-----------------|-------------|------|-------|----------------------|
| `geocoding`     | 10,000      | 333  | 200   | **200**              |
| `distancematrix`| 10,000      | 333  | 200   | **200**              |
| `places_nearby` | 5,000       | 166  | 100   | **100**              |
| `places_text`   | 5,000       | 166  | 100   | **100**              |
| `other`         | —           | —    | —     | **50**               |

Rationale: 30 consecutive days at `dailyCap` ≤ `freeMonthly × 0.6` < free allotment — monthly free protection **without** durable monthly state. Caps are deliberately tight for the testing phase and are env-tunable (§7). A typical report makes ~5–15 billed calls across buckets, so these defaults still allow dozens of fresh reports/day while caching prolongs the rest.

---

## 4. Component: `src/costBreaker.js` (new, self-contained)

No app-layer imports → unit-testable in isolation with an injected clock. Pure module with internal state.

### State (in-memory)
- `windows: Map<bucketKey, number[]>` — per-bucket array of UTC timestamps of **successful billed calls** within the last 24h (rolling; pruned on access).
- `forced: boolean` — global force-trip (kill-switch) flag.
- `clock: () => number` — defaults to `Date.now`; injectable for tests.

### Public API
| Function | Behavior |
|---|---|
| `skuFor(endpoint)` | Maps an endpoint label → bucket key (table in §3); unknown → `'other'` (+ one-time log). |
| `check(endpoint)` | Throws `BudgetExceededError` if `forced` is true, **or** the bucket's rolling-24h count `>= dailyCap`. Returns nothing on success. Prunes the window first. |
| `record(endpoint)` | Pushes `clock()` into the bucket window. Called only after a **successful** billed call. |
| `forceTrip()` | Sets `forced = true`. |
| `reset()` | Sets `forced = false`. (Does not clear rolling windows — those self-expire; clearing them would falsely free monthly-derived budget.) |
| `status()` | Returns `{ forced, buckets: [{ key, used, cap, pct, tripped, estCostUsd }], totalEstCostUsd }` for the admin panel. |
| `_setClock(fn)` / `_clearAll()` | Test-only hooks (underscore-prefixed). |

### `BudgetExceededError`
New error class (co-located with `QuotaExceededError`/`RateLimitError` in `src/rateLimit.js`, or exported from `costBreaker.js` and re-exported by `rateLimit.js` — implementation choice in the plan):
```
class BudgetExceededError extends Error {
  name = 'BudgetExceededError';
  retryable = false;           // self-heals as the 24h window rolls; no client retry storm
  constructor(bucketKey) { super('Daily API budget reached for ' + bucketKey + '.'); this.bucket = bucketKey; }
}
```

---

## 5. Integration: `src/rateLimit.js` chokepoint

`makeGoogleMapsRequest(fn, endpoint, maxRetries)` gains exactly two touch-points:

1. **Before** the retry loop / `rateLimiter.execute`:
   ```
   costBreaker.check(endpoint);   // throws BudgetExceededError → not billed
   ```
2. **After** a successful call (the existing `logApiCall(endpoint, true)` success branch):
   ```
   costBreaker.record(endpoint);
   ```
   Record on **success only** — matches what Google bills (a 200 with `ZERO_RESULTS` is billed and *is* a success at the HTTP layer, so it correctly counts; a thrown error is generally not billed and does not count).

No call sites change (the Proxy already passes `endpoint`). Cache hits never reach this function, so **cached reports/cells are never blocked**.

A soft **warn at ≥80%** of a bucket's cap is logged (once per crossing, via the existing `logger`) so approaching limits are visible before the hard trip.

---

## 6. Distance Matrix element approximation (honest-provenance note)

Distance Matrix bills per **element** (origins × destinations), but `usageLog`/`costBreaker` count **calls**. A single `distancematrix` call can be several billed elements, so:
- The **budget** (call count) under-counts Distance Matrix usage relative to true element spend.
- Mitigation: the `distancematrix` default cap is already conservative, and the **estimated-$** for that bucket multiplies by an `avgElementsPerCall` factor (default `5`, env-tunable) so the dollar readout is honest about the element nature.
- This approximation is documented in-code at the SKU table and surfaced in the admin panel label ("Distance Matrix est. assumes ~5 elements/call"). True element-exact accounting is out of scope for v1.

---

## 7. Configuration: `src/config.js` + `src/utils/constants.js`

- **`src/utils/constants.js`** — `GOOGLE_SKU_BUDGETS`: the §3 table (`{ tier, freeMonthly, pricePerCall, dailyCap }` per bucket) + `avgElementsPerCall`, `safetyMargin`, `warnThreshold` (0.8).
- **`src/config.js`** — at boot (reusing FR-064's validation pattern):
  - `COST_BREAKER_ENABLED` (default `true`) — master switch; when `false`, `check()` is a no-op (escape hatch).
  - Optional per-bucket overrides `COST_BREAKER_CAP_<BUCKET>` (e.g. `COST_BREAKER_CAP_PLACES_NEARBY=50`) — parsed as integers ≥ 0; invalid → boot warning, falls back to default. Caps of `0` mean "block this bucket entirely."
  - Validation: any provided override that is non-numeric or negative is a **warn** (not fatal) → uses default; the breaker must never crash the boot path.

---

## 8. Admin (behind FR-064 `requireAdmin`)

- **`GET /admin/health`** — existing page gains a **Cost Breaker** panel rendering `costBreaker.status()`: per-bucket `used / cap` + `pct` bar state, tripped flag, estimated-$ per bucket and total, and the global force-trip state.
- **`POST /admin/cost-breaker/trip`** — calls `forceTrip()`; returns `{ forced: true }`.
- **`POST /admin/cost-breaker/reset`** — calls `reset()`; returns `{ forced: false }`.

Both mutation routes sit under the existing `app.use('/admin', requireAdmin)` guard (no new auth). Template work lives in `src/templates/pages/adminPage.js` (CONSTRAINT-008/009 — no logic in templates, no HTML in logic).

---

## 9. Error surfacing (reuses existing graceful path)

`BudgetExceededError` is added to `classifyError` (in `src/services/reportBuilder.js`) → returns a type that renders through the **existing** "we're at capacity, try again later" error page (same machinery as `QuotaExceededError`). No new template. Message: capacity-style, no internal budget detail leaked to end users. Because the window is rolling-24h, normal recovery is automatic — no user-facing retry countdown needed (non-retryable error, soft "try later").

---

## 10. Inputs / Outputs

**Inputs:** `endpoint` label (string) at the chokepoint; env config at boot; admin POSTs.
**Outputs:** either the call proceeds (and is recorded on success), or `BudgetExceededError` is thrown before billing; `status()` snapshot for admin; structured log lines on warn/trip.

---

## 11. Edge cases

| # | Case | Expected |
|---|------|----------|
| E1 | Bucket at exactly `cap` | Next `check()` throws (count `>= cap`). The `cap`-th call was allowed; the `cap+1`-th is refused. |
| E2 | Window rolls (calls age past 24h) | Pruned on `check`/`status`; budget frees gradually; tripped bucket self-clears. |
| E3 | Per-SKU isolation | `places_nearby` tripped must **not** block `geocoding` or `distancematrix`. |
| E4 | Force-trip active | **All** buckets refuse, regardless of counts, until `reset()`. |
| E5 | `reset()` after force-trip | `forced=false`; buckets resume at their actual rolling counts (not zeroed). |
| E6 | Cache hit | Never reaches the chokepoint → never blocked, never recorded. |
| E7 | Failed call (throws / 429 / quota) | **Not** recorded (not billed) — does not consume budget. |
| E8 | `COST_BREAKER_ENABLED=false` | `check()` is a no-op; `record()` may still track for observability or also no-op (plan decides; default: still record so the panel shows usage). |
| E9 | Unknown endpoint label | Maps to `other` bucket; logged once. |
| E10 | Cap override `0` | Bucket blocks on the first call (count `0 >= 0`). |
| E11 | Concurrent calls near the cap | Acceptable minor overshoot (check→execute→record is not atomic); the conservative cap absorbs it. Documented; not a correctness bug at this tier. |
| E12 | Restart | All counters + force-trip reset (in-memory). Documented single-instance caveat. |

---

## 12. Acceptance criteria

- [ ] AC1 — A billed call to a bucket at/over its daily cap throws `BudgetExceededError` **before** the Google call is made (verified: `fn` not invoked).
- [ ] AC2 — Tripping one bucket does not affect other buckets (E3).
- [ ] AC3 — Rolling expiry frees budget (E2): with an injected clock advanced >24h, a previously-tripped bucket allows calls again.
- [ ] AC4 — `forceTrip()` refuses all buckets; `reset()` restores per-bucket behavior (E4/E5).
- [ ] AC5 — Failed calls do not consume budget (E7); successful calls (incl. ZERO_RESULTS 200) do.
- [ ] AC6 — `geocode` and `reverseGeocode` share one `geocoding` budget.
- [ ] AC7 — Default caps satisfy `dailyCap × 30 ≤ freeMonthly` for every bucket.
- [ ] AC8 — `BudgetExceededError` renders the graceful capacity page, not a stack trace / 500.
- [ ] AC9 — `/admin/health` shows the cost-breaker panel; `POST /admin/cost-breaker/trip` then `/reset` flip `forced` (loopback-auth verified).
- [ ] AC10 — `COST_BREAKER_ENABLED=false` disables enforcement; boot does not crash on a malformed cap override (warns, uses default).
- [ ] AC11 — Full Jest suite green; new `costBreaker` unit tests pass.
- [ ] AC12 — A report still renders end-to-end with the breaker in-path (smoke check; CONSTRAINT-011 5-address note below).

---

## 13. Test plan (CONSTRAINT-011)

New `tests/costBreaker.test.js` with an injected clock (deterministic, no real time):
1. under-cap allows; `record` increments
2. at-cap `check` throws `BudgetExceededError`
3. rolling expiry (advance clock >24h) frees budget
4. per-SKU isolation (E3)
5. `geocode`+`reverseGeocode` share the `geocoding` bucket
6. force-trip blocks all buckets; reset restores
7. reset does not zero rolling windows (E5)
8. failed call not recorded (caller-side: verify `record` only on success branch)
9. unknown endpoint → `other` bucket
10. cap override `0` blocks first call
11. estimated-$ math (incl. Distance Matrix `avgElementsPerCall` factor)
12. `status()` shape + `pct`/`tripped` flags
13. `skuFor` mapping table
14. default caps satisfy `cap × 30 ≤ freeMonthly` (AC7 guard test)

Plus a thin integration assertion that `makeGoogleMapsRequest` calls `check` before `fn` and `record` after success (mock `fn`).

**5-address rule:** FR-075 touches no location-search logic, so the rule applies only as a coherence smoke test — a report renders with the breaker in-path (manual, keyless where possible; Jeffersonville IN included as the standing regression address). No per-address branching exists in this feature.

---

## 14. Constraint check

- **CONSTRAINT-001** (no scoring): N/A — infra; no quality rating produced.
- **CONSTRAINT-008/009** (no inline styles; no logic in templates / no HTML in logic): admin panel HTML lives in `adminPage.js`; `costBreaker.js` emits data only.
- **CONSTRAINT-011** (tests): unit suite above; Jeffersonville smoke.
- **CONSTRAINT-014** (coherence in one place): the breaker is a single cross-cutting module at the single chokepoint — not re-implemented per module.
- **CONSTRAINT-015** (graceful degradation): tripped breaker → graceful capacity page + cached content still serves; admin sees a named, actionable status (which bucket, how to raise the cap). 

---

## 15. Files touched

| File | Change |
|------|--------|
| `src/costBreaker.js` | **new** — budget engine + `BudgetExceededError` |
| `src/rateLimit.js` | wire `check` (before) + `record` (after success); export/re-export the error |
| `src/utils/constants.js` | `GOOGLE_SKU_BUDGETS` table + tuning constants |
| `src/config.js` | `COST_BREAKER_ENABLED` + per-bucket cap overrides, validated at boot |
| `src/services/reportBuilder.js` | classify `BudgetExceededError` → graceful capacity page |
| `src/app.js` | two admin POST routes under existing guard; pass `costBreaker.status()` to health page |
| `src/templates/pages/adminPage.js` | Cost Breaker panel |
| `tests/costBreaker.test.js` | **new** — unit suite |
| `.env.example` | document `COST_BREAKER_ENABLED` + override vars |
