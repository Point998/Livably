# FR-046 — Community & Demographics: L3/L4 Deep Dive

## Status
🔵 **IN SPEC** — Phase 2

## What
Add L3 (Deep Read) and L4 (Research) depth content to the Community & Demographics chapter using the depth slider system from FR-045. Currently the chapter renders only L1 (glance bar) and L2 (overview cards + narratives). This FR adds two additional depths backed by newly fetched Census ACS variables.

## Why
The community chapter is one of the highest-interest chapters for buyers — they want to understand who lives here and what daily life looks and feels like. L2 gives summary stats; L3 gives the distribution and structure behind those stats; L4 gives researchers the raw numbers. This follows the same L3/L4 pattern already shipped in Climate (FR-043) and Garden (FR-042).

## Module
`src/modules/community/` + `src/templates/chapters/community.js`

---

## Inputs

All inputs come from `getDemographics()` in `src/modules/community/data.js`, which fetches Census ACS 5-year estimates for the census tract. The `fips` object (state + county + tract codes) is passed in from the route.

### Currently fetched variables (L2 already uses these)
| Variable | Description |
|---|---|
| B01001_* | Age by sex (full detail) |
| B01002_001E | Median age |
| B19013_001E | Median household income |
| B25003_001/002E | Housing tenure (owner/renter) |
| B25010_001E | Average household size |
| B15003_001/017/022-025E | Education attainment |
| B25039_001E | Median year householder moved in |

### New variables needed for L3/L4

**Income distribution** (B19001 series — household income brackets):
| Variable | Bracket |
|---|---|
| B19001_001E | Total households |
| B19001_002E | Less than $10,000 |
| B19001_003E | $10,000–$14,999 |
| B19001_004E | $15,000–$19,999 |
| B19001_005E | $20,000–$24,999 |
| B19001_006E | $25,000–$29,999 |
| B19001_007E | $30,000–$34,999 |
| B19001_008E | $35,000–$39,999 |
| B19001_009E | $40,000–$44,999 |
| B19001_010E | $45,000–$49,999 |
| B19001_011E | $50,000–$59,999 |
| B19001_012E | $60,000–$74,999 |
| B19001_013E | $75,000–$99,999 |
| B19001_014E | $100,000–$124,999 |
| B19001_015E | $125,000–$149,999 |
| B19001_016E | $150,000–$199,999 |
| B19001_017E | $200,000 or more |

**Education full ladder** (additions to existing B15003 fetch):
| Variable | Description |
|---|---|
| B15003_002E–016E | Less than HS (14 sub-categories — sum to one bucket) |
| B15003_018E | GED or equivalent |
| B15003_019E | Some college, less than 1 year |
| B15003_020E | Some college, 1+ year, no degree |
| B15003_021E | Associate's degree |

**Household composition** (B11001 series):
| Variable | Description |
|---|---|
| B11001_001E | Total households |
| B11001_002E | Family households |
| B11001_003E | Married-couple family |
| B11001_005E | Other family — male householder, no spouse |
| B11001_006E | Other family — female householder, no spouse |
| B11001_007E | Nonfamily households |
| B11001_008E | Householder living alone |

**Commute mode** (B08006 series):
| Variable | Description |
|---|---|
| B08006_001E | Total workers 16+ |
| B08006_002E | Drove alone |
| B08006_003E | Carpooled |
| B08006_008E | Public transit |
| B08006_014E | Bicycle |
| B08006_015E | Walked |
| B08006_016E | Other means |
| B08006_017E | Worked from home |

**Note:** All new variables must be added to `varsBatch1` or `varsBatch2` (or a new `varsBatch3`) in `getDemographics()`. Census ACS API limit is 50 variables per request — the current batches use ~35 slots combined, leaving ~15 slots. The new variables total ~35+, so a third batch will be required.

---

## Output Shape

`getDemographics()` currently returns:
```js
{
  totalPop, medianAge,
  age: { under18, age18to34, age35to64, age65plus, primaryGroup },
  income: { median, level },
  education: { bachelor, graduate, collegePct, level },
  community: { ownershipRate, avgHHSize, medianTenureYears, type, densityType },
}
```

After this FR, it must also return:
```js
{
  // ...existing fields...
  incomeDistribution: {
    totalHouseholds: number,
    brackets: [
      { label: 'Under $25k',      pct: number, count: number },
      { label: '$25k–$50k',       pct: number, count: number },
      { label: '$50k–$75k',       pct: number, count: number },
      { label: '$75k–$100k',      pct: number, count: number },
      { label: '$100k+',          pct: number, count: number },
    ],
  } | null,
  educationLadder: {
    totalAdults: number,
    steps: [
      { label: 'Less than high school', pct: number },
      { label: 'High school / GED',     pct: number },
      { label: 'Some college / Associate\'s', pct: number },
      { label: 'Bachelor\'s degree',    pct: number },
      { label: 'Graduate degree',       pct: number },
    ],
  } | null,
  householdComposition: {
    totalHouseholds: number,
    familyPct: number,
    marriedCouplePct: number,
    singleParentPct: number,
    nonfamilyPct: number,
    livingAlonePct: number,
  } | null,
  commuteMode: {
    totalWorkers: number,
    droveAlonePct: number,
    carpoolPct: number,
    transitPct: number,
    bicyclePct: number,
    walkedPct: number,
    wfhPct: number,
    otherPct: number,
  } | null,
  tractFips: {
    state: string,
    county: string,
    tract: string,
    censusExplorerUrl: string,  // pre-built URL to Census Data Explorer for this tract
  } | null,
}
```

All new top-level keys return `null` if data is unavailable (ACS returns -666666666 for suppressed cells — treat as null).

---

## L3 — Deep Read: 4 tabs

Rendered as `<div class="depth-l3">` inside `fullHTML` param of `renderChapterCard`.

Uses the same tab pattern as Climate's deep dive (`climate-tab`, `climate-tab-panel`, etc.) — **reuse those CSS classes**. Do not introduce new tab component CSS.

### Tab 1: Income Distribution
- Horizontal bar chart of 5 income brackets (same `.prem-age-row` + `.prem-age-fill` pattern as L2 age bars)
- Median household income repeated for anchoring
- One sentence comparing each bracket to national distribution (national reference: ~22% under $25k, ~23% $25–50k, ~18% $50–75k, ~14% $75–100k, ~23% $100k+)
- Source: ACS B19001, 5-year estimates
- Fair Housing note: frame as distribution data only — no "low-income area" or "wealthy neighborhood" characterizations. Compare brackets to national averages, not to each other as value judgments.

### Tab 2: Education Ladder
- Full 5-rung ladder as horizontal bars (same `.prem-age-row` pattern)
- National benchmarks inline: US avg ~12% less than HS, ~27% HS grad, ~20% some college, ~20% bachelor's, ~13% graduate
- No editorial framing on education level — present as distribution
- Source: ACS B15003

### Tab 3: Household Composition
- Family vs. nonfamily split (bar or stat tiles)
- Breakdown: married couple %, single parent %, living alone %
- Short narrative: "X% of households here are families. Of those, Y% are married couples." — factual only
- Source: ACS B11001
- Fair Housing: describe household structure only, not implications about family values or community character

### Tab 4: How People Get to Work
- Mode share bars: drove alone, carpool, transit, walked, bike, WFH
- This is genuinely useful buyer info — a 40% WFH rate means different parking/traffic patterns than a 90% drive-alone rate
- If transit > 10%: note it signals transit infrastructure is viable here
- If WFH > 25%: note neighborhood daytime activity patterns may differ from drive-to-work areas
- Source: ACS B08006

---

## L4 — Research

Rendered as `<div class="depth-l4">` inside `fullHTML`.

Two data tables:

**Table 1: Income Distribution (raw counts)**
Columns: Bracket | Households | % of Tract
All 5 grouped brackets + "Data suppressed" row if any cells were -666666666.

**Table 2: Full Education Breakdown**
Columns: Attainment Level | % of Adults 25+
All 5 ladder rungs.

**Census Tract Link**
```
This data is for Census Tract [tract], [county] County, [state].
View full ACS data: [link to data.census.gov for this tract]
```
URL pattern: `https://data.census.gov/table?g=1400000US{state2digit}{county3digit}{tract6digit}`

---

## Edge Cases

| Case | Behavior |
|---|---|
| ACS suppressed cell (-666666666) | Treat as 0 for that bracket; note "Some data suppressed" in disclaimer |
| `fips` is null | `getDemographics()` already returns null; L3/L4 functions receive null and return `''` |
| All new variables missing | L3 tabs render with "Data unavailable for this census tract" — still show tab headers |
| Rural tract with small population | ACS often suppresses small-count cells; same suppression handling above covers it |
| Zero total workers (B08006_001E = 0) | Skip commute tab entirely — render only 3 tabs |
| incomeDistribution.totalHouseholds = 0 | Skip income tab |

---

## Fair Housing Compliance (CONSTRAINT-002)

All L3 content must pass this checklist:
- [ ] No language implying the area is "wealthy," "poor," "working class," or any economic class descriptor
- [ ] Income data compares brackets to national averages only — never characterizes the tract
- [ ] Household composition describes structure (families, singles, etc.) — never implies desirability
- [ ] Education data presented as distribution — no "highly educated area" badge or equivalent in L3/L4 (those badges exist at L2 and are not repeated)
- [ ] Commute mode data is factual infrastructure data — no implications about residents
- [ ] No racial, ethnic, national origin, or language data — none of those ACS variables are fetched or rendered

---

## Files

| File | Change |
|---|---|
| `src/modules/community/data.js` | Add varsBatch3 with new ACS variables; expand return object |
| `src/templates/chapters/community.js` | Add `buildCommunityDeepDiveHTML()` (L3) and `buildCommunityResearchHTML()` (L4); wire into `buildDemographicsHTML()` |
| `tests/community.test.js` | New test file — unit tests for all new data transforms and edge cases |

No new CSS required — reuse `.climate-tab`, `.climate-tab-panel`, `.climate-tab-nav`, `.prem-age-row`, `.prem-age-fill`, `.climate-data-table`, `.climate-table-scroll` from existing stylesheets.

No new npm packages.

---

## Acceptance Criteria

- [ ] `getDemographics()` returns `incomeDistribution`, `educationLadder`, `householdComposition`, `commuteMode`, and `tractFips` for all non-null FIPS inputs
- [ ] Suppressed ACS cells (-666666666) are converted to null and handled gracefully — no NaN or "-666,666,666" appears in output
- [ ] L3 tab bar renders with correct labels; clicking tabs switches panels (reuses existing climate tab JS in `public/ui.js`)
- [ ] L4 renders raw count tables and Census tract link
- [ ] All 5 test addresses render without error at L3 and L4 depth
- [ ] Jeffersonville IN (border city) returns IN tract data, not KY
- [ ] Harlan KY (rural) — suppressed cells handled gracefully, no crashed sections
- [ ] No inline styles anywhere in new HTML (CONSTRAINT-008)
- [ ] No HTML or CSS class names in `data.js` (CONSTRAINT-009)
- [ ] All new business logic (pct calculations, suppression checks, bracket grouping) is unit-tested before template work begins (CONSTRAINT-011)
- [ ] Fair Housing checklist above passes review

## Test Addresses
1. `100 Wishing Well Path Unit 2306, Georgetown, KY 40324`
2. `456 Rural Route 1, Harlan, KY 40831`
3. `123 Main St, Louisville, KY 40202`
4. `789 Main St, Bozeman, MT 59715`
5. `1007 Stonelilly Dr, Jeffersonville, IN 47130`

## Out of Scope
- Racial/ethnic composition data — not fetched, not rendered (Fair Housing)
- Language spoken at home — out of scope
- Historical population trend — deferred to a future FR
- Occupation/industry breakdown — deferred; requires B24010 (large variable set)
- Mobile segmented control UI — deferred per FR-045
