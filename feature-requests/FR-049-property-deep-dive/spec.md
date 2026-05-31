# FR-049 Spec — Property Intelligence Deep Dive (L3/L4)

**Status:** Specced
**Module:** `src/modules/property/`

---

## Problem

The Property Intelligence chapter renders construction era, soil drainage, and broadband availability at L2. The depth slider is wired but `fullHTML` is null — nothing renders at L3 (Deep Read) or L4 (Research). This is the same gap that FR-046 closed for Community.

Significant data is already being fetched and discarded after L2: upload speeds for all broadband providers, the raw soil map unit name and hydric rating, and housing unit counts that could be broken into decade cohorts. One small data expansion (ACS housing age band variables) completes the picture.

---

## Inputs

**Already fetched in `getPropertyIntelligence`:**
- `propIntel.broadband.providers[]` — name, tech, download, upload for up to 5 providers
- `propIntel.soil.muname` — USDA soil map unit name
- `propIntel.soil.drainagecl` — raw drainage class string
- `propIntel.soil.hydricrating` — raw hydric rating ("yes" / "no")
- `propIntel.soil.isHydric` — boolean
- `propIntel.era.medianYearBuilt` — median year built (Census ACS)
- `propIntel.era.newConstructionPct` — % built 2010+
- `propIntel.era.context.era` — era label
- `propIntel.era.context.cautions` — array of risk strings

**New data required (one fetch expansion):**
- ACS `B25034_004E` through `B25034_011E` — housing units by decade (2000s, 1990s, 1980s, 1970s, 1960s, 1950s, 1940s, pre-1940)
- These join the existing `B25034_001E`, `_002E`, `_003E` already in `varsBatch` in `getPropertyIntelligence`

---

## Outputs

**L3 — Deep Read (3 tabs):**

### Tab 1: Internet Providers
Full provider breakdown for remote workers and heavy users. Shows all providers with download AND upload speeds, technology type. Upload speed is the key differentiator for remote workers — currently invisible at L2.

Content: Provider cards with down/up speeds, tech badge, fiber callout if present. Remote work note if upload >100 Mbps available.

### Tab 2: Soil & Foundation
Structured soil detail beyond the L2 narrative. Shows soil map unit name, drainage class, hydric status with implications for foundation stability, landscaping, and flood risk.

Content: Soil unit card, drainage classification bar/badge, hydric indicator with plain-English implication.

### Tab 3: Building Age Distribution
Decade-by-decade breakdown of housing construction in the Census tract. Gives buyers context on neighborhood age mix beyond just the median year.

Content: Bar chart (prem-age-row pattern) showing % of housing units per decade band. Era risk callouts (pre-1978 lead paint, pre-1990 asbestos, etc.) linked to specific decade bars.

**L4 — Research:**
- Full provider table: all providers, all speeds, technology type
- USDA soil reference data: map unit name, drainage class definition, hydric classification
- Census housing age raw counts table
- County assessor + building department links (constructed from locationInfo.county + state)

---

## New Logic Function

**`buildHousingAgeBands(get)`** in `src/modules/property/logic.js`

Transform raw ACS housing unit counts into decade-band objects, parallel to `groupIncomeBrackets` in community:

```js
// Input: ACS getter function
// Output: { totalUnits, bands: [{ label, count, pct }], medianYearBuilt }
// Bands: 2010+, 2000s, 1990s, 1980s, 1970s, 1960s, 1950s, Pre-1950
```

Returns null if total is 0 or missing. Handles suppressed cells (negative values → 0).

---

## Files Changed

| File | Change |
|---|---|
| `src/modules/property/data.js` | Add decade ACS vars (B25034_004E–_011E) to existing batch. Expand return object with `housingAgeBands`. |
| `src/modules/property/logic.js` | Add `buildHousingAgeBands(get)`. |
| `src/modules/property/template.js` | Add `buildBroadbandTab()`, `buildSoilTab()`, `buildHousingAgeTab()`, `buildPropertyDeepDiveHTML()`, `buildPropertyResearchHTML()`. Update `buildPropertyIntelligenceHTML()` to wire `fullHTML`. |
| `tests/modules/property/logic.test.js` | New file (or extend existing): tests for `buildHousingAgeBands`. |
| `tests/modules/property/template.test.js` | Add L3/L4 describe blocks. |

---

## ACS Variable Map for Housing Age Bands

| Variable | Period |
|---|---|
| B25034_001E | Total housing units |
| B25034_002E | Built 2020 or later |
| B25034_003E | Built 2010 to 2019 |
| B25034_004E | Built 2000 to 2009 |
| B25034_005E | Built 1990 to 1999 |
| B25034_006E | Built 1980 to 1989 |
| B25034_007E | Built 1970 to 1979 |
| B25034_008E | Built 1960 to 1969 |
| B25034_009E | Built 1950 to 1959 |
| B25034_010E | Built 1940 to 1949 |
| B25034_011E | Built 1939 or earlier |

Display bands (group 2020+2010s together; keep others separate):
- `2010+`: B25034_002E + B25034_003E
- `2000s`: B25034_004E
- `1990s`: B25034_005E
- `1980s`: B25034_006E
- `1970s`: B25034_007E
- `1960s`: B25034_008E
- `Pre-1960`: B25034_009E + B25034_010E + B25034_011E

---

## Acceptance Criteria

1. `depth-l3` renders with 3 tabs: Internet Providers, Soil & Foundation, Building Age
2. Each tab has substantive content from real data (no empty panels)
3. `depth-l4` renders provider table, soil reference, housing age raw counts, assessor links
4. Upload speeds visible in Internet Providers tab
5. Hydric rating visible in Soil & Foundation tab
6. Building Age bars show decade distribution
7. No inline styles (CONSTRAINT-008)
8. No API calls in template.js (CONSTRAINT-009)
9. `buildHousingAgeBands` tested in logic.test.js
10. All 5 test addresses pass — Harlan KY (rural, possible data suppression)
11. All existing tests continue to pass

---

## Out of Scope

- Fetching additional USDA soil data (component name, permeability) — separate FR
- Parcel-level data (not available via current APIs)
- HOA / deed restriction data
