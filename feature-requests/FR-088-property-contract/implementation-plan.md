# FR-088 — Implementation Plan

Tests alongside (CONSTRAINT-011). Pure mapping layer — no API calls, no new deps. First non-located chapter.

## Task 1 — `src/modules/property/contract.js` (new)
1. `require('../../contract/schema')` → `safeBuild`.
2. `toneFromDrainageColor(color)`: green|lightgreen→favorable, orange|red→caution, else neutral.
   (Mirrors utilities' `toneFromBandColor`. The color is consumed to derive tone, never emitted.)
3. `buildPropertyContract(propIntel, opts = {})`:
   - `if (!propIntel) return null;`
   - `asOf = opts.asOf || YYYY-MM`. `const census = {source:'Census ACS', asOf, modeled:false};`
     `const usda = {source:'USDA Soil Data Access', asOf, modeled:false};`
   - `findings = []`; `push(finding, copy?)` sets defaultCopy.
   - **construction-era** when `Number.isFinite(era?.medianYearBuilt)`: measure `{value, unit:'year_built'}`,
     consider, neutral, census; defaultCopy = `era.context?.era`.
   - **era-health-risks** when `era?.context?.cautions?.length`: check, caution, census, no measure,
     fallbackAction `{type:'instruction', label:'Get an inspection', value: <era-appropriate testing note>}`,
     defaultCopy = cautions.join(' ').
   - **soil**: if `soil?.drainageCategory` → `soil-drainage` (check; no measure; tone =
     toneFromDrainageColor; defaultCopy = `${label} — ${implication}`; if `soil.isHydric` → tone caution +
     append hydric note; usda). Else → `soil-missing` (check, neutral, usda, fallbackAction url=soilwebUrl).
   - **new-construction** when `Number.isFinite(era?.newConstructionPct)`: cool, neutral, census,
     measure `{value, unit:'percent'}`, defaultCopy = share-built-since-2010 framing.
   - provenanceSummary dedupe by `source|asOf`.
   - `safeBuild('property', () => ({ schemaVersion:'1.0', chapterId:'property', findings, degraded:!!opts.degraded, provenanceSummary }))`.
4. `module.exports = { buildPropertyContract }`.

**Tests:** `tests/modules/property/contract.test.js` (new) — AC-1..AC-9. Fixtures: full propIntel
(era + soil w/ drainageCategory), an isHydric soil (→caution), a poorly-drained soil (color red→caution),
a well-drained (green→favorable), modern era (no cautions → era-health-risks omitted), missing soil
(→soil-missing + soilwebUrl), absent propIntel (→null). Snapshots: Georgetown, Harlan (older + poor), Jeffersonville.

## Task 2 — wire into `reportBuilder.js`
1. Import `buildPropertyContract`.
2. In `contract.chapters` add:
   ```
   property: chapters?.propIntel
     ? buildPropertyContract(chapters.propIntel, { degraded: degradation.total > 0 })
     : null,
   ```

## Task 3 — verify
- `npx jest tests/modules/property` then full `npx jest`. Green incl. 5 addresses.
- Review snapshots; confirm no `color`/`drainagecl`/`muname`/`context` keys leak; tone derivations correct.

## Risks / unknowns
- Property already has `tests/modules/property/` (data/logic/template tests) — add contract.test.js there.
- Drainage tone: confirm the color set in `getDrainageCategory` (green, lightgreen, gold, orange, red, muted)
  maps cleanly; `muted` (unknown drainagecl) → neutral.
- Don't leak `era.context` (object) — only read `.era` (string) and `.cautions` (array) into copy/fallback.
