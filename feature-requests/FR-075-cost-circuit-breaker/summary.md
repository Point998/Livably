# FR-075 — Cost Circuit-Breaker: Summary

*Phase 4 complete · 2026-06-18 · branch `FR-075-cost-circuit-breaker`*
*Implements the NR-004 / FR-064 deferred item: "the throttle slows abuse but does not cap total spend."*
*Built via subagent-driven development — 6 tasks, each TDD with a two-stage (spec + quality) review; one whole-branch final review.*

---

## What shipped

A per-SKU rolling-24h **call budget** on Google Maps API spend, enforced at the single billed chokepoint, plus a manual admin kill-switch. Closes the last cost-resilience gap left after FR-064: nothing previously capped *cumulative* billed volume (the per-IP throttle caps rate, the concurrency limiter caps parallelism — neither caps total spend).

1. **Budget engine** (`src/costBreaker.js`, new) — self-contained, in-memory, injectable clock. Per-SKU rolling-24h windows of *successful billed calls*; `check()` throws `BudgetExceededError` when a bucket is at/over its daily cap or a global force-trip is active; `record()` counts billed successes only; `forceTrip()`/`reset()` kill-switch; `status()` snapshot for the admin panel; `skuFor()` maps endpoint→bucket (unknown→`other`, logged once).
2. **Chokepoint wiring** (`src/rateLimit.js`) — `check(endpoint)` as the first line of `makeGoogleMapsRequest` (before the retry loop, outside the try/catch → not retried, not billed) and `record(endpoint)` after the existing success-path `logApiCall`. `BudgetExceededError` re-exported (same object identity). Cache hits bypass this function, so cached reports/cells are never blocked.
3. **SKU budgets** (`src/utils/constants.js`) — `GOOGLE_SKU_BUDGETS`: geocoding & distancematrix (Essentials, 10k free/mo → cap 200/day), places_nearby & places_text (Pro, 5k free/mo → cap 100/day), other (50/day). Caps derived as `freeMonthly ÷ 30 × 0.6` so 30 days at cap stays under the monthly free allotment — monthly free-tier protection without durable monthly state. Estimated-$ multiplies `distancematrix` by `avgElementsPerCall` (5), since Distance Matrix bills per element.
4. **Boot config** (`src/config.js`) — `COST_BREAKER_ENABLED` (default on) + optional per-bucket `COST_BREAKER_CAP_<BUCKET>` overrides, validated at boot (non-negative integers; malformed → warn + default, never fatal). Consumed by `costBreaker.configure(config.costBreaker)` in `app.js`.
5. **Graceful error** (`src/services/reportBuilder.js`) — `BudgetExceededError` classified to the **existing** `QUOTA_EXCEEDED` capacity page ("Service at capacity / data-fetch limit / try again later"). No new template.
6. **Admin** (`src/app.js`, `src/templates/pages/adminPage.js`) — `POST /admin/cost-breaker/trip` and `/reset` (under the existing FR-064 `requireAdmin` guard), and a Cost Breaker panel on `/admin/health` (per-SKU used/cap/%, tripped state, estimated-$, total).

## Why this design (settled in brainstorming, see spec)

- **Per-SKU call budget, not flat dollars** — Google's free tier (confirmed 2026-06-18: per-SKU, monthly, $0 under the allotment) means real cost is $0 until a specific SKU crosses its free line, so a per-SKU *call* budget is the meaningful "stay free" guard. Estimated-$ is shown for observability / once paid.
- **Rolling-24h enforcement** — catches a runaway loop in hours, rides the existing `usageLog` substrate, and (via the ÷30 default) bounds monthly usage under free without durable month-to-date state.
- **Hard stop, per-SKU** — refuses only the exhausted SKU's new billed calls; cached reports keep serving.
- **Kill-switch + reset** — hands-on control for live agent-testing sessions; everything in-memory (Stage-1-aligned).

## Tests

- **+22 tests** (1,627 → 1,649, 87 suites, all green): costBreaker engine (13 — incl. AC7 `cap×30 ≤ freeMonthly` invariant, rolling expiry, per-SKU isolation, force-trip/reset, cap=0, enabled=false, estimated-$), chokepoint integration (3 — check-before-fn, record-on-success-only, error identity), config validation (5 new + 6 pre-existing), error classification (1). Two final-review regression guards (`retryable===false`, exact capacity message) were added as assertions inside existing tests (no new cases).
- **Live smoke (controller, zero-cost via force-trip):** admin guard 200 on loopback; force-trip → `{forced:true}` and a report under trip returned the **graceful capacity page** with **`byEndpoint:{}` / `last24h:0` — i.e. zero billed calls** (the breaker refused them before spending); reset → `{forced:false}`; `/admin/health` Cost Breaker panel renders all 4 SKU buckets (200). Config validation ran clean at boot.

## 5-address rule (CONSTRAINT-011)

FR-075 touches no location-search logic and has **no per-address branching**, so the rule applies only as a coherence smoke (spec §13). The breaker's own new code paths were verified live via the force-trip path (above). A full live report **render** could not be exercised here: the `GOOGLE_MAPS_API_KEY` is IP-restricted and returns **403** from this dev machine (pre-existing environmental constraint — the same reason prior sessions used keyless verification; the 403 is handled by the existing graceful `SERVER_ERROR` path). The full 5-address render smoke is deferred to a network where the Google key resolves.

## New packages

None.

## Explicitly deferred (documented in spec)

- **Exact calendar-month per-SKU budget** (trip at 9,000/10,000 *this month*) — needs durable month-to-date counters → **Hardening Stage 1**.
- **Multi-instance correctness** — per-process budgets until state is externalized (Stage 1).
- **Persisting force-trip across restarts** → falls out of Stage 1.
- **Element-exact Distance Matrix accounting** — budget counts calls; estimated-$ approximates elements via `avgElementsPerCall`, surfaced honestly in the panel.

## Known minor follow-ups (final-review triage: all defer-safe)

Force-trip `.bucket` is a synthetic display string; `countFor` uses `arr.shift()` (O(n²), negligible at cap ≤ 200); no case-insensitive `FALSE` / negative-cap config test; admin empty-buckets fallback copy is imprecise (buckets never empty in practice). None affect correctness.
