# FR-033 — Life-at-Address Calculator · Summary

*Shipped on branch `FR-033-life-at-address` (off `main`, independent of FR-032). Built with the 4-phase workflow via subagent-driven TDD with per-task review.*

## What shipped
An interactive driving-cost calculator at the end of the **Daily Life** chapter: adjust commute days + distance, grocery trips, monthly city trips, and a kids-in-school toggle → live weekly/annual miles and three cost figures.

- **Engine + swappable skin** (the design principle, for UI flexibility later): a pure, tested `computeDrivingProfile(inputs, rates)` is the source of truth; the server renders a default profile (works with JS off); an isolated `public/calculator.js` mirrors the formula for live sliders and is **parity-tested** against the engine (drift → test failure).
- **Headline = marginal cost** (fuel ÷ MPG + maintenance); **IRS full rate = secondary**; **EV-equivalent = the comparison**. Live example (default profile, June 2026 rates): 6,025 mi/yr → **$1,640** marginal / **$4,218** IRS-full / **$289** EV.

## Dynamic rates (nothing hardcoded in the logic)
`src/shared/rates.js#getDrivingRates()` — one shared, file-cached source ("one report refreshes for everyone"):
- **Gas price:** live **EIA** API (optional `EIA_API_KEY`), 14-day cache, dated fallback.
- **IRS mileage rate:** best-effort fetch/parse of the IRS page, 180-day cache, dated fallback, `as of` labeled.
- **MPG / maintenance / EV kWh-per-mi / national electric rate:** centralized dated modeling assumptions (no API exists).
- Derived `marginalCostPerMile`. Each value carries `source` + `asOf` provenance; failed fetches use the dated fallback and are **not** cached (no poison).

## Architecture / resilience notes
- **Cache TTL fix (caught in review):** the `ratesCache` namespace TTL must be the *longest* per-rate TTL (180d), else `Cache.get` evicts the long-lived IRS entry before `cachedFresh()`'s per-rate check applies. Regression test locks it.
- Rates fetch in `reportBuilder` is non-blocking + guarded; calculator omitted gracefully on total failure; meaningful with JS disabled.
- Parsers hardened with response fixtures (`tests/shared/fixtures/`) — and, unlike FR-032's NREL, **validated live** (see below).
- Branches off `main`, self-contained: national-avg electric rate now, with a one-line seam (`RATE_FALLBACKS.electricRatePerKwh`) to adopt FR-032's per-address local rate once that merges.

## New dependencies / config
- `EIA_API_KEY` added to `.env.example` (optional; dated fallback if unset). No new npm packages.
- New constants: `RATE_FALLBACKS, TRIP_DISTANCE_DEFAULTS, DEFAULT_PROFILE, PROFILE_BOUNDS, RATES_GAS_TTL_DAYS, RATES_IRS_TTL_DAYS`. New cache namespace: `ratesCache`.

## Tests
- **Full suite: 1263 passed / 68 suites** (was 1232 / 65 on `main` → +31 tests, +3 suites: reachability logic, rates, calculator-parity).
- Engine: clampNum + computeDrivingProfile (formulas, conversions, clamping, exact output keys).
- Rates: EIA + IRS parsers vs fixtures (incl. "no data" / no-match / ≤0 / empty), getDrivingRates (live source, fallback, cache-hit, no-poison, **per-rate TTL regression**).
- Template: default render, JSON config embed (`<`-escaped), back-compat null path, no-inline-styles (scoped to the block), no-scoring, null guard.
- Client: **parity** vs engine across an input matrix; require-without-DOM.

## Verification status
- ✅ **Verified live here** (EIA + IRS are reachable from this environment, unlike NREL):
  - `fetchGasPrice` against the real EIA v2 API → `$4.305/gal`, as-of `2026-06-01` — schema assumption confirmed.
  - `fetchIrsMileageRate` live scrape → `$0.70/mi` (2026 rate), source `IRS` (not fallback) — parser confirmed.
  - End-to-end: live rates → engine → rendered Daily Life chapter with the calculator block, config script, and sensible figures ($1,640 / $4,218 / $289).
- ⏳ **Remaining (needs a browser):** the *interactive* slider behavior (live recompute) and a full 5-address visual pass. The data/engine/render/parity paths are all verified; this is the in-browser interactivity + visual check, deferred to a manual run (`npm start`).

## Follow-ups
- Browser interactivity + visual pass; finalize calculator styling in the frontend phase.
- Once FR-032 merges, wire its per-address electric rate into the EV-equivalent via the `electricRatePerKwh` seam.
