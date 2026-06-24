# FR-093 — Implementation Plan

Tests alongside (CONSTRAINT-011). Pure mapping + arithmetic — no API calls, no new deps. Last numbered chapter.
Layer order: constant → logic (+tests) → contract (+tests) → wiring → 5-address snapshots. `template.js` untouched.

## Task 1 — `src/utils/constants.js` (1 line + export)
1. Add near `STATE_TAX_RATES`: `const NATIONAL_AVG_PROPERTY_TAX_RATE = 1.0; // Lincoln Institute ~1.0% national effective; equals the getPropertyData ?? 1.00 default.`
2. Add `NATIONAL_AVG_PROPERTY_TAX_RATE` to `module.exports`.

## Task 2 — `src/modules/costs/logic.js` (new, pure)
No HTML, no API, no require of template/data (CONSTRAINT-009).
1. `require` `NATIONAL_AVG_PROPERTY_TAX_RATE` from `../../utils/constants`.
2. `const REFERENCE_PRICE = 300000;`
3. `computeCosts(propertyData)`:
   - `if (!propertyData) return null;`
   - `const { taxRate, insuranceYear, utilitiesMo, state } = propertyData;`
   - monthly: `tax = round(REFERENCE_PRICE * taxRate/100 / 12)`, `insurance = round(insuranceYear/12)`,
     `utilities = round(utilitiesMo)`, `total = tax + insurance + utilities`.
   - `taxComparison`: `deltaPct = round((taxRate - NAT)/NAT * 100)`;
     `direction = taxRate <= NAT*0.9 ? 'below' : taxRate >= NAT*1.1 ? 'above' : 'near'`.
   - return `{ taxRate, state, referencePrice: REFERENCE_PRICE, monthly:{tax,insurance,utilities,total},
     taxComparison:{ direction, deltaPct, referenceValue: NAT } }`.
4. `module.exports = { computeCosts, REFERENCE_PRICE }`.

**Tests:** `tests/modules/costs/logic.test.js` (new) — AC-1, AC-10 bands.
Fixtures: KY (0.83→below), synthetic near (~1.0→near, deltaPct 0), NJ (2.13→above); assert monthly math
(e.g. KY total) and purity (no html/`<`, returns plain object); `null` in → `null` out.

## Task 3 — `src/modules/costs/contract.js` (new)
1. `require('../../contract/schema')` → `safeBuild`; `require('./logic')` → `computeCosts`.
2. `buildCostsContract(propertyData, opts = {})`:
   - `if (!propertyData) return null;`
   - `const c = computeCosts(propertyData); if (!c) return null;`
   - `asOf = opts.asOf || new Date().toISOString().slice(0,7)`.
   - `findings = []`; `push(finding, copy?)` sets defaultCopy (mirrors other contracts).
   - **property-tax-rate**: bucket `below→cool | near→consider | above→check`;
     tone `below→favorable | near→neutral | above→caution`; measure `{value: c.taxRate, unit:'percent_effective'}`;
     comparison `{basis:'national_average', referenceValue: c.taxComparison.referenceValue,
     direction: c.taxComparison.direction, deltaPct: c.taxComparison.deltaPct, region: c.state || null}`;
     provenance `{source:'Lincoln Institute', asOf, modeled:true}`;
     fallbackAction `{type:'instruction', label:'Look up the actual parcel tax bill', value: <assessor note>}`.
   - **insurance-estimate**: consider/neutral; measure `{value: c.monthly.insurance, unit:'usd_per_month'}`;
     provenance `{source:'NAIC', asOf, modeled:true}`; fallbackAction `{type:'instruction', label:'Get at least 3 quotes', value: …}`.
   - **utilities-estimate**: consider/neutral; measure `{value: c.monthly.utilities, unit:'usd_per_month'}`;
     provenance `{source:'EIA', asOf, modeled:true}`; fallbackAction `{type:'instruction', label:'Request 12 months of utility bills', value: …}`.
   - **carrying-cost-estimate**: consider/neutral; measure `{value: c.monthly.total, unit:'usd_per_month_at_300k_ref'}`;
     comparison `null`; provenance `{source:'Livably estimate (state averages)', asOf, modeled:true}`;
     fallbackAction `{type:'instruction', label:'Add your mortgage and a maintenance reserve', value: …}`.
   - **homestead-exemption** only when `propertyData.homesteadNote`: cool/favorable; measure `null`;
     provenance `{source:'State homestead statute', asOf, modeled:false}`; fallbackAction `null`;
     defaultCopy = `propertyData.homesteadNote`.
   - provenanceSummary dedupe by `source|asOf` (same pattern as property/walkability).
   - `safeBuild('costs', () => ({ schemaVersion:'1.0', chapterId:'costs', findings, degraded:!!opts.degraded, provenanceSummary }))`.
3. `// shortcut:` comment per spec (template still computes carrying costs inline; not refactored here).
4. `module.exports = { buildCostsContract }`.

**Tests:** `tests/modules/costs/contract.test.js` (new) — AC-2..AC-9.
Fixtures: full KY propertyData (below + homestead), MT (below, no homestead), synthetic near, synthetic NJ
above (no homestead), `null` (→null). Assertions: schema-valid + chapterId/version; tax measure+comparison
(basis national_average); 4 estimates all `modeled:true` each with a fallbackAction; homestead present/absent
toggles the finding; **no `score`/`grade`/`rating`/`affordability` token anywhere** (serialize → JSON.stringify
regex); only comparison basis is `national_average`; no income/economic-character string.

## Task 4 — wire into `services/reportBuilder.js`
1. Import `buildCostsContract` (alongside the other contract imports, ~L25–26 area).
2. In `contract.chapters` add:
   ```
   costs: chapters?.propertyData
     ? buildCostsContract(chapters.propertyData, { degraded: degradation.total > 0 })
     : null,
   ```

## Task 5 — verify
- `npx jest tests/modules/costs` then full `npx jest`. Green incl. all 5 addresses.
- Confirm `costs/template.js` is byte-unchanged (`git diff --stat` shows only logic/contract/constants/reportBuilder/tests).
- Spot-check serialized snapshots: Jeffersonville IN, Georgetown/Harlan/Louisville KY, Bozeman MT; KY/TX show homestead.

## Risks / unknowns
- **No existing `tests/modules/costs/` dir** — create it (costs only had template.js, no prior tests). Confirm path matches jest config glob.
- **No test address is above national avg** — the `above→caution→check` branch is covered by a synthetic NJ unit fixture only (AC-10), not a live address run. Acceptable: the band logic is pure and unit-tested.
- **`carrying-cost-estimate` provenance** uses a composite `'Livably estimate (state averages)'` source string — intentional (it's a derived sum, not a single upstream source); it will appear as its own row in provenanceSummary. Confirm that reads acceptably.
- **Rounding parity** — logic uses the same `Math.round(price*rate/100/12)` form the template uses, so contract numbers match the rendered report; don't introduce a different rounding order.
- **`degradation` object shape** — confirm `degradation.total` is the field reportBuilder already uses for the other contracts (it is, per existing wiring) before relying on it.
