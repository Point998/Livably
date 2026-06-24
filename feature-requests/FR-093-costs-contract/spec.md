# FR-093 — Costs chapter → headless report contract (rollout #14)

**Status:** Spec · **Module:** `src/modules/costs/{logic,contract}.js` + wiring in `services/reportBuilder.js`
**Origin:** contract rollout (FR-078); the last *numbered* chapter. **Schema:** no change (1.0)
**Design call (Nathan, 2026-06-24):** Option 1 — extract a pure `costs/logic.js`; the SSR `template.js` is **untouched** (matches rollouts #1–13). The chapter's carrying-cost math is currently duplicated inline ~4× in `template.js`; that pre-existing duplication is **not** refactored here (logged as a `// shortcut:` follow-up, not expanded into this FR).

## Problem / goal

Migrate the **costs** chapter ("Property Costs & Market", chapter 14) to the contract. Costs is the highest-risk chapter for Livably's *informed-not-judged* feel — money invites judgment — and the most likely to be mistaken for precise, address-specific figures when it is actually built on **state-level averages**. The contract must surface the **component costs as factual measures**, never a composite affordability score, and must carry honest provenance (`modeled:true`) plus a CONSTRAINT-015 "get your real number" action on every estimate. Added additively as `contract.chapters.costs`. **14 of 14** numbered chapters after this (climate remains a separate, still-uncontracted chapter — out of scope here).

## Approach

1. **Logic-layer (new `costs/logic.js`):** a pure `computeCosts(propertyData)` returning the structured numbers the contract serializes — tax rate + national comparison, monthly carrying components at the $300k reference, and the component-sum total. No HTML, no API (CONSTRAINT-009). The `STATE_*` lookups already happened upstream in `getPropertyData`; logic only does arithmetic on its inputs.
2. **Contract (new `costs/contract.js`):** `buildCostsContract(propertyData, opts)` calls `computeCosts` and emits factual component findings. No composite/affordability score (CONSTRAINT-001). Tax-rate comparison uses `basis:'national_average'` only (CONSTRAINT-002-safe — it compares a *tax rate*, never the area's wealth/economic class).
3. **Constant:** add `NATIONAL_AVG_PROPERTY_TAX_RATE = 1.0` (Lincoln Institute ≈1.0% national effective; equals the existing `?? 1.00` default) to `constants.js` as the named `comparison.referenceValue`.
4. **Wiring:** add `chapters.propertyData ? buildCostsContract(chapters.propertyData, { degraded: degradation.total > 0 }) : …` into `services/reportBuilder.js` alongside the other contracts.
5. **Template (`costs/template.js`): unchanged.**

## Inputs

`buildCostsContract(propertyData, opts)` where `propertyData` (or `null`) is the output of `getPropertyData` (`property/data.js`):
```
{ taxRate, insuranceYear, utilitiesMo, homesteadNote, state, county, densityLabel }
```
- `taxRate` — effective % (state average; Lincoln Institute 2024). `insuranceYear` — $/yr at the $300k baseline (NAIC 2024). `utilitiesMo` — $/mo (EIA/BLS). `homesteadNote` — string or `null` (most states `null`).
- `opts = { asOf?, degraded? }`. Returns `null` when `propertyData` is absent.

`REFERENCE_PRICE = 300000` (the established convention across the SSR template — keep it; bake it into the unit token so the FE never mistakes the figure for an address-specific quote).

## Findings produced

Display order = list order. All cost estimates are state-average → `modeled:true`, and each carries a CONSTRAINT-015 `fallbackAction` pointing to the real number.

1. **`property-tax-rate`** — the one finding using `comparison`.
   - bucket: `below`→`cool`, `near`→`consider`, `above`→`check`. tone: `below`→`favorable`, `near`→`neutral`, `above`→`caution`.
   - claim.subject: `'Effective property tax rate (state average)'`, measure `{ value: taxRate, unit: 'percent_effective' }`.
   - comparison: `{ basis: 'national_average', referenceValue: 1.0, direction, deltaPct, region: state }`.
   - provenance: `{ source: 'Lincoln Institute', asOf, modeled: true }`.
   - fallbackAction: `{ type: 'instruction', label: 'Look up the actual parcel tax bill', value: 'Search "[county] assessor" or "[county] property tax records" for the exact assessed value and tax history for this specific parcel — often free online.' }`.

2. **`insurance-estimate`** — bucket `consider`, tone `neutral`.
   - claim.subject: `'Estimated homeowners insurance (state average)'`, measure `{ value: insMo, unit: 'usd_per_month' }` (= `round(insuranceYear/12)`).
   - provenance: `{ source: 'NAIC', asOf, modeled: true }`.
   - fallbackAction: `{ type: 'instruction', label: 'Get at least 3 quotes', value: 'Rates for the same home vary 30–50% by age, construction, roof, and proximity to fire stations. Get 3 quotes before closing.' }`.

3. **`utilities-estimate`** — bucket `consider`, tone `neutral`.
   - claim.subject: `'Estimated monthly utilities (state average)'`, measure `{ value: utilMo, unit: 'usd_per_month' }`.
   - provenance: `{ source: 'EIA', asOf, modeled: true }`.
   - fallbackAction: `{ type: 'instruction', label: 'Request 12 months of utility bills', value: "Ask the seller's agent for the last 12 months of electric, gas, and water — seasonal swings matter, especially in older homes." }`.

4. **`carrying-cost-estimate`** — the **component sum** (CONSTRAINT-001-safe: a sum of line items, explicitly a budgeting input — NOT a score/grade/verdict). bucket `consider`, tone `neutral`.
   - claim.subject: `'Estimated monthly carrying cost at $300k reference price (excludes mortgage)'`, measure `{ value: totalMo, unit: 'usd_per_month_at_300k_ref' }` (= `taxMo + insMo + utilMo`, where `taxMo = round(300000 * taxRate/100/12)`).
   - comparison: `null`. provenance: `{ source: 'Livably estimate (state averages)', asOf, modeled: true }`.
   - fallbackAction: `{ type: 'instruction', label: 'Add your mortgage and a maintenance reserve', value: 'This is taxes + insurance + utilities only. Add your mortgage payment and a maintenance reserve (≈1%/yr, higher for older homes) for the true monthly cost.' }`.

5. **`homestead-exemption`** — emitted **only when** `homesteadNote` is present. bucket `cool`, tone `favorable`. claim.subject `'Homestead exemption available'`, measure `null`, `defaultCopy = homesteadNote`. provenance: `{ source: 'State homestead statute', asOf, modeled: false }`. fallbackAction `null`.

**Comparison bands:** `deltaPct = round((taxRate − 1.0) / 1.0 * 100)`. `direction`: `below` if `taxRate ≤ 0.9`, `above` if `taxRate ≥ 1.1`, else `near`.

## Edge cases & constraints

- **CONSTRAINT-001 (no scoring):** no affordability score, chapter grade, or "good deal / overpriced" verdict. The carrying total is a transparent component sum; `.strict()` rejects any stray `score`/`grade`/`rating`. A test asserts no `score`/`grade`/`rating`/`affordability` token in the serialized contract.
- **CONSTRAINT-002 (Fair Housing):** the **only** comparison is tax-rate vs `national_average`; the chapter emits **no income finding** and never characterizes the area's wealth or economic class. A test asserts `basis` is `national_average` and no demographic/economic-character string leaks.
- **CONSTRAINT-015 (graceful degradation):** every modeled estimate carries an actionable `fallbackAction` (assessor lookup, 3 quotes, 12 months of bills, mortgage math).
- **Honest provenance:** all four estimates `modeled:true` (state averages, not parcel-specific); homestead `modeled:false` (documented statute). Reference-price anchor baked into the carrying-total unit token so the FE can't render it as an address-specific quote.
- **Home value:** deliberately **not** emitted (no measure, no finding) — Census lags 3–5 yrs; the SSR template's Zillow/Redfin/CMA redirect stays in the template. Explicit non-goal.
- **Defaulted inputs:** if `state` is unknown upstream, `getPropertyData` already applies defaults (`taxRate 1.00`, `insuranceYear 1400`, `utilitiesMo 185`) → tax `direction:'near'`, `deltaPct:0`. Contract handles defaulted values normally.
- **`propertyData` absent → `null`** (chapter omitted, never a crash — `safeBuild`).

## Acceptance criteria

- **AC-1 (logic):** `computeCosts(propertyData)` is pure (no HTML, no API, no `require` of template/data) and returns `{ taxRate, state, monthly:{tax,insurance,utilities,total}, referencePrice, taxComparison:{direction,deltaPct,referenceValue} }`.
- **AC-2:** full input → schema-valid, `chapterId:'costs'`, `schemaVersion:'1.0'`.
- **AC-3:** `property-tax-rate` emits `{value: taxRate, unit:'percent_effective'}` + `comparison{basis:'national_average', referenceValue:1.0, direction, deltaPct, region:state}`, with bucket/tone per the band table.
- **AC-4:** `insurance-estimate`, `utilities-estimate`, `carrying-cost-estimate` emit `usd_per_month*` measures; carrying total = `tax+insurance+utilities` at $300k and uses unit `usd_per_month_at_300k_ref`.
- **AC-5:** each of the four estimates carries a `fallbackAction` (CONSTRAINT-015); all four are `modeled:true`.
- **AC-6:** `homesteadNote` present → `homestead-exemption` (cool/favorable, `defaultCopy=note`, `modeled:false`); absent → no such finding.
- **AC-7 (CONSTRAINT-001):** no `score`/`grade`/`rating`/`affordability` anywhere in the serialized contract; carrying total is the only summed value and is bucket `consider`/tone `neutral`.
- **AC-8 (CONSTRAINT-002):** only comparison basis is `national_average`; no income finding; no economic-character string.
- **AC-9:** `propertyData` absent → `null`.
- **AC-10 (bands):** below case (KY 0.83 → `below`/`cool`/`favorable`), near case (synthetic ~1.0 → `near`/`consider`/`neutral`), above case (synthetic high-tax fixture, e.g. NJ 2.13 → `above`/`check`/`caution`). **No test address is above national avg**, so the above-branch needs a synthetic unit fixture.
- **AC-11:** per-address snapshots incl. **Jeffersonville IN** (regression), KY (Georgetown/Harlan/Louisville), Bozeman MT; KY/TX exercise the homestead finding.
- **AC-12:** wired additively into `reportBuilder` as `chapters.costs`; full suite green incl. all 5 addresses; `template.js` byte-unchanged.

## Notes

- `defaultCopy` is transitional (FR-078 AC-9) — FE owns voice later.
- `// shortcut:` to log in `costs/contract.js`/`logic.js` and harvest to SHORTCUTS-equivalent: *"costs/template.js still computes carrying costs inline in ~4 places; logic.js is the new single source for the contract but the template was intentionally not refactored onto it (surgical scope, matches rollouts #1–13). Revisit when the SSR template is next touched for an unrelated reason."*
