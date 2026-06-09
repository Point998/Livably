# FR-033 — Life-at-Address Calculator

## Problem
The Daily Reachability chapter tells a buyer how far things are, but not what that *costs them per year* given how they actually drive. There's no way to see "if I commute 3 days/week to a job 24 miles away, plus errands, this address costs me ~$X/year to drive — and ~$Y on an EV." FR-033 adds an interactive calculator at the end of that chapter.

## Design principle — "engine + swappable skin"
Decouple **computation** (durable, fully tested) from **presentation** (provisional, restyle-able in the frontend phase). The math lives in a pure tested server function and a centralized dynamic-rates module; the UI is a thin, isolated, swappable layer. This is what lets us change the interaction model freely later without touching the logic.

## Scope (v1)
- **In:** a driving-cost calculator — commute (user-set distance + days), grocery trips, monthly city trips, optional school runs → weekly/annual miles, headline **marginal cost**, secondary **IRS-rate** cost, **EV-equivalent** cost. Dynamic rates (gas price live; IRS best-effort; modeling assumptions centralized). Hybrid UI: server-rendered default profile + live sliders.
- **Out (v1):** auto-detected "nearest employment center" (commute distance is user-set); multi-destination commutes; per-address local electric rate (national-avg now; FR-032 seam for later); charger list (already in FR-032 Utilities chapter — link, don't duplicate).

---

## Component 1 — Dynamic rates · `src/shared/rates.js` (+ `ratesCache`)

`getDrivingRates()` → one shared, file-cached source of truth. No rate literals appear in `reachability/logic.js`.

Returns:
```
{
  gasPricePerGallon,     // live EIA, fallback dated
  irsRatePerMile,        // best-effort fetch, fallback dated
  avgMpg,                // dated assumption
  maintenancePerMile,    // dated assumption
  evKwhPerMile,          // dated assumption
  electricRatePerKwh,    // national-avg dated assumption (FR-032 seam)
  marginalCostPerMile,   // derived: gasPricePerGallon / avgMpg + maintenancePerMile
  sources: { gas: 'EIA'|'fallback', irs: 'fetch'|'fallback', ... },
  asOf: { gas: <ISO date>, irs: <ISO date> },
}
```

### Fetchers (in `rates.js`, fetch-only)
- `fetchGasPrice()` — **EIA API** (`api.eia.gov/v2/petroleum/pri/gnd/data/`, weekly regular retail, national series), `process.env.EIA_API_KEY` (fallback `DEMO_KEY`/null → dated fallback). `AbortSignal.timeout(12000)`. Returns `{ value, asOf }` or `null`.
- `fetchIrsMileageRate()` — best-effort GET + parse of the IRS standard-mileage-rate source; if non-ok / unparseable → `null`. Returns `{ value, asOf }` or `null`.

### Caching (the "one report refreshes for everyone" model)
- New `ratesCache` namespace in `src/cache.js`. Single global key per rate group (national — not per-address/cell).
- `RATES_GAS_TTL_DAYS = 14`, `RATES_IRS_TTL_DAYS = 180`.
- On hit → return cached; on miss → fetch, fall back to dated default on failure, `set` only successful fetches under their TTL (a fetch failure uses the fallback but does **not** poison the cache for the full TTL — same guard pattern as FR-032's total-miss).

### Resilience + hardening
- Each live fetch has a **dated fallback constant** (`RATE_FALLBACKS` in `src/utils/constants.js`), labeled `asOf` so the report can show provenance.
- **Parsers hardened with response fixtures up front** (`tests/shared/fixtures/`), per the NREL lesson — first live contact is low-risk; a parse miss degrades to the dated fallback.

---

## Component 2 — Computation engine · `src/modules/reachability/logic.js`

`computeDrivingProfile(inputs, rates)` — pure, no IO, no HTML, fully tested.

- `inputs`: `{ commuteDaysPerWeek (0–7), commuteOneWayMiles (≥0), groceryTripsPerWeek (0–7), cityTripsPerMonth (0–8), hasKidsInSchool (bool) }`
- per-trip distances for grocery/city/school come from `rates`-adjacent **modeling defaults** in constants (`TRIP_DISTANCE_DEFAULTS`: grocery RT, city RT, school RT, school days/wk) — centralized, dated, documented. (Commute distance is the user-set dominant term.)
- Computes:
  ```
  weeklyMilesByType = {
    commute: commuteDaysPerWeek * commuteOneWayMiles * 2,
    grocery: groceryTripsPerWeek * groceryRoundTripMiles,
    city:    (cityTripsPerMonth * cityRoundTripMiles) / 4.33,
    school:  hasKidsInSchool ? schoolDaysPerWeek * schoolRoundTripMiles : 0,
  }
  weeklyMilesTotal = sum
  annualMiles = round(weeklyMilesTotal * 52)
  costMarginal = round(annualMiles * rates.marginalCostPerMile)   // headline
  costIrs      = round(annualMiles * rates.irsRatePerMile)        // secondary
  costEv       = round(annualMiles * rates.evKwhPerMile * rates.electricRatePerKwh)
  ```
- Returns `{ weeklyMilesByType, weeklyMilesTotal, annualMiles, costMarginal, costIrs, costEv }`.
- Input clamping: out-of-range inputs are clamped to documented bounds (defensive; the client mirror clamps identically).
- **No scoring** (CONSTRAINT-001) — figures only, no good/bad labels.

`DEFAULT_PROFILE` (also in logic/constants): the Office-Commuter default the server renders (e.g., `{ commuteDaysPerWeek: 3, commuteOneWayMiles: 15, groceryTripsPerWeek: 1, cityTripsPerMonth: 1, hasKidsInSchool: false }`).

---

## Component 3 — Template · `src/modules/reachability/template.js`

`buildLifeCalculatorHTML(profile, rates, config)` → an HTML block rendered **inside the Daily Life `<section>`**, appended after the insight sections and before the depth selector. `buildInsightsCardHTML` gains a trailing `lifeCalc` arg (`{ profile, rates, config } | null`) and inlines `buildLifeCalculatorHTML(lifeCalc)` when present; passing `null` leaves the chapter unchanged (keeps existing tests/back-compat).

- Renders the **default computed profile** (headline marginal cost, IRS secondary, EV-equivalent, annual miles, weekly breakdown) so it's meaningful with JS disabled.
- Renders the input controls (sliders/toggle) with semantic classes — provisional styling.
- Embeds the rates + defaults + bounds as a **JSON config** in a `data-` attribute or a typed `<script type="application/json">` block for the client layer to read.
- Sources/`asOf` footnote (EIA gas price as-of date; IRS rate as-of date; modeling-assumption note). Semantic classes only — **no inline styles** (CONSTRAINT-008).

## Component 4 — Client mirror · `public/calculator.js`

- Isolated vanilla-JS file (loaded by the report page alongside `ui.js`).
- Reads the embedded JSON config; on slider/preset `input` events, runs a **faithful mirror** of `computeDrivingProfile`'s arithmetic and updates the output spans. Clamps identically; degrades silently if the config block is absent.
- **Parity-testable, not just asserted:** the mirror's pure formula is written in a tiny UMD-style wrapper (`if (typeof module !== 'undefined' && module.exports) module.exports = { computeProfileClient };` plus a browser global) so a Jest test can `require` it and assert it produces **identical output to `computeDrivingProfile`** across a matrix of inputs. If the two drift, the parity test fails. The **server engine remains the canonical source of truth**; the mirror exists only for live interactivity.

## Component 5 — Constants · `src/utils/constants.js`
- `RATE_FALLBACKS` — `{ gasPricePerGallon, irsRatePerMile, avgMpg, maintenancePerMile, evKwhPerMile, electricRatePerKwh }`, each dated/sourced.
- `TRIP_DISTANCE_DEFAULTS` — `{ groceryRoundTripMiles, cityRoundTripMiles, schoolRoundTripMiles, schoolDaysPerWeek }`.
- `RATES_GAS_TTL_DAYS`, `RATES_IRS_TTL_DAYS`.
- `DEFAULT_PROFILE`.

## Wiring
- `src/services/reportBuilder.js`: `await getDrivingRates()` once per report (cached) alongside the existing fetches; build `lifeCalc = { profile: DEFAULT_PROFILE, rates, config }` (config = rates + defaults + input bounds for the client) and thread it through `buildReportHTML(address, { …, lifeCalc })`.
- `src/templates/pages/reportPage.js:174`: pass `lifeCalc` as the trailing arg to `buildInsightsCardHTML(...)`; add the `public/calculator.js` script tag alongside the existing `ui.js` include.
- `src/modules/reachability/template.js`: `buildInsightsCardHTML` accepts the trailing `lifeCalc`; renders `buildLifeCalculatorHTML(lifeCalc)` inside the section before the depth selector.
- `.env.example`: add `EIA_API_KEY`.

## Inputs
- Per-report: `getDrivingRates()` result (rates + provenance). No address-specific fetch needed for v1 (commute distance is user-set; trip distances are modeled defaults).

## Constraints
- CONSTRAINT-001: no scores/grades — dollar + mileage figures only.
- CONSTRAINT-008/009: no inline styles; canonical math in tested logic, not template/data; client mirror isolated + documented.
- CONSTRAINT-011: engine + rates parsers fully tested (fixtures); Georgetown profile regression; all 5 addresses render the calculator without error.
- CONSTRAINT-015: every live rate has a dated fallback; calculator meaningful with JS off; failed fetch doesn't poison the cache for the full TTL.

## Acceptance Criteria
- [ ] `getDrivingRates()` returns live gas price when EIA reachable, dated fallback when not, with `asOf`/`source` provenance; cached per TTL; a failed fetch is not cached for the full TTL.
- [ ] `computeDrivingProfile` is pure + tested; the Georgetown default profile reproduces ~the roadmap example (≈6,800 mi/yr; marginal headline + IRS secondary + EV-equivalent).
- [ ] Server renders the default profile (meaningful with JS disabled) at the end of the Daily Life chapter.
- [ ] `public/calculator.js`'s pure formula is `require`-able and a **parity test** asserts it matches `computeDrivingProfile` across an input matrix (catches drift).
- [ ] Headline = marginal cost; IRS = secondary; EV-equivalent shown; sources/`asOf` footnote present.
- [ ] No scoring, no inline styles; rates centralized (no literals in logic).
- [ ] `EIA_API_KEY` documented in `.env.example`; chapter/calculator degrade gracefully without it.
- [ ] Rate-parser fixtures committed; all 5 test addresses render the calculator without error.
