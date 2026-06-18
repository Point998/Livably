# FR-074 — Census ACS vintage resilience — Summary

*Phase 4 complete. **Final A1 slice** (3rd non-Google single). Hardens the app's
most widely-shared external source — `src/shared/census.js` (6 modules + the
rural-mode cascade).*

## What shipped

Two lone Census endpoints, both previously silent single points of failure, are now
resilient + observable — and the ACS data is no longer pinned to a stale year:

1. **`fetchCensusACS` — newest-first ACS5 *vintage* fallback.** Was hard-coded to
   `2022`; now tries `CENSUS_ACS_VINTAGES = [2024, 2023, 2022]` newest-first via
   `sourceChain` (label `census-acs`). **Live-verified: all 5 addresses now resolve
   to vintage 2024** — the newest available — a concrete ~2-year currency win over
   the old hard-coded 2022.
2. **`getCensusFIPS` — light hardening.** One transient retry + a `sourceChain`
   wrap (label `census-fips`) so the upstream cascade for *everything* is no longer
   a silent `try/catch → null`.

Both record degradation in the **FR-068 ledger** (was the worst instance of the
NR-004 swallow class, for the most-shared source). **No keyless fallback** —
confirmed not viable (Census now returns a "Missing Key" page).

## Why vintage-fallback is the right shape

A discovery probe found that, as of June 2026, the **2024 ACS5 has shipped** while
the code served **2022** — stale, and brittle if the endpoint were retired. The
fallback axis here is **vintages of the same source** (no third-party mirror
needed): it makes the data *more current* (auto-uses newest) **and** *resilient*
(survives a missing/retired vintage).

## Key correctness detail — permanent vs transient

`fetchAcsVintage` distinguishes a **404** (vintage not released → added to
`knownAbsentVintages`, skipped on future calls) from a **5xx/timeout** (transient →
falls to the next-newest vintage for *this* call, but the newest is retried next
call — self-heals). This prevents a transient blip on 2024 from permanently
sticking the process to a staler 2023, which a naive "cache the resolved vintage"
would do.

## Contract preserved

`fetchCensusACS` still returns `{ get, headers, values }` (+ an **additive
`vintage`**) or `null`; `getCensusFIPS` still returns `{ state, county, tract }` or
`null`; `fipsCache` + no-key→null behavior intact. So all 6 consumers
(Property, Growth, Sensory, Community + `reportBuilder` rural-mode) and the existing
`census.test.js` are untouched. Surfacing the `vintage` year in chapter disclaimers
is deferred (a separate UI pass).

## Changes

- **`src/utils/constants.js`** — `CENSUS_ACS_VINTAGES = [2024, 2023, 2022]`.
- **`src/shared/census.js`** — `fetchCensusACS` vintage `sourceChain` +
  `fetchAcsVintage` (404→absent / 5xx→transient / <2 rows→miss) +
  `knownAbsentVintages`; `getCensusFIPS` retry + `sourceChain`; `chainLog` adapter.

## Tests (CONSTRAINT-011)

- `tests/shared/census.test.js` — existing 5 preserved; +6: newest-vintage win
  (no older calls), 404→fallback **+ subsequent skip** (call-count), 5xx→fallback
  **+ next-call retry** (self-heal), all-fail → null + `census-acs` `exhausted`
  ledger event, FIPS retry-then-ok, FIPS total-failure → null + `census-fips`
  ledger event. (Ledger helpers `require`'d *after* `jest.resetModules()` to share
  census's AsyncLocalStorage instance.)
- **Full suite: 1,627 passed / 84 suites green** (1,621 + 6 new).

## Live verification — all 5 addresses (real `CENSUS_API_KEY` from `.env`)

| Address | FIPS | ACS vintage | median yr built |
|---|---|---|---|
| Georgetown KY | 21/209/040209 | **2024** | 1957 |
| Harlan KY | 21/095/970900 | **2024** | 1978 |
| Louisville KY | 21/111/004900 | **2024** | 1951 |
| Bozeman MT | 30/031/000800 | **2024** | 1938 |
| Jeffersonville IN | 18/019/050200 (IN-side) | **2024** | 1957 |

Newest-first fallback resolves to 2024 everywhere — the data is now current, where
it was two vintages stale before.

## Workflow note

Full 4-phase workflow (discovery + live probes → spec → plan → implementation). No
phases skipped. No new npm packages.

## Track A1 — complete

This is the **last A1 slice**. The cost-resilience / single-point-of-failure track
is done across both shapes: Google-Places-backed (FR-066/067/069/070/071 → OSM
fallbacks) and non-Google singles (FR-072 soil, FR-073 elevation, FR-074 Census) —
all now retry/fallback + `sourceChain`-observable (FR-065/068) with honest floors.
