# FR-034 Chapter Enhancements — Implementation Plan
*Items 1–3: Construction Era Health Risks, Civic Infrastructure, 10-Year Horizon*

> **For agentic workers:** Use superpowers:test-driven-development for each task. Write failing tests first, then implement. Commit after each task passes.

---

## Project Context

- Working directory: `C:\Users\Borde\livably`
- Framework: Node.js + Express, vanilla JS/HTML/CSS
- Test runner: Jest (`npx jest --no-coverage`)
- All CSS goes in `public/report.css` using existing design tokens from `public/design-tokens.css`
- Constraints enforced: CONSTRAINT-001 (no scoring), CONSTRAINT-008 (no inline styles), CONSTRAINT-015 (graceful degradation)
- Key tokens: `--space-1` through `--space-6`, `--text-xs/sm/base/lg/xl`, `--ink`, `--ink-60`, `--ink-10`, `--ink-04`, `--ch` (chapter color)
- Full test suite baseline: `npx jest --no-coverage` → all 1,084 tests must pass after each task

---

## Task 1: Construction Era Health Risks (Property L3)

**Files to modify:**
- `src/modules/property/template.js`
- `public/report.css`
- `tests/modules/property/template.test.js`

**What to build:**
Expand `buildHousingAgeTab(housingAgeBands, era)` in `src/modules/property/template.js` to add a "Construction Era Health Risks" subsection below the histogram bars. Only rendered when `era?.medianYearBuilt < 2000`.

**Current function signature (line ~69):**
```js
function buildHousingAgeTab(housingAgeBands, era) {
```
`era` is already passed in and has `{ medianYearBuilt, newConstructionPct, context }`.

**New helper function to add** (before `buildHousingAgeTab`):
```js
function buildEraHealthRisks(medianYear) {
  if (!medianYear || medianYear >= 2000) return '';
  // Returns era-specific risk items as HTML
}
```

**Era-specific content** (based on `medianYear`):

Pre-1940 (`medianYear < 1940`):
- Lead paint: "Assumed present in original surfaces. Any renovation disturbing painted surfaces requires lead-safe practices. Full abatement costs $10,000–$30,000."
- Plumbing: "Galvanized or cast iron plumbing may be near end of life. Full replacement runs $4,000–$15,000."
- Electrical: "Knob-and-tube wiring possible if not updated. An electrician's assessment before closing is worth the cost — full rewire is $8,000–$15,000."
- Asbestos: "Common in insulation, floor tiles, and siding from this era. Testing costs $250–$800; abatement if required is $1,500–$30,000+."

1940s–50s (`medianYear < 1960`):
- Lead paint: "Pre-1978 construction — lead paint is likely in original finishes. Testing costs $20–$50 per room."
- Asbestos: "Common in popcorn ceilings, floor tiles, and pipe insulation from this era. Undisturbed asbestos isn't a health risk; disturbed during renovation is."
- Plumbing: "Original galvanized plumbing may be aging toward end of life. Ask the inspector to assess pipe condition specifically."

1960s–70s (`medianYear < 1978`):
- Lead paint: "Pre-1978 construction — lead paint in original finishes is federally presumed. Sellers are required to disclose known hazards, but testing is the only way to confirm presence."
- Aluminum wiring: "Homes built 1965–1973 often used aluminum branch circuit wiring, which has higher fire risk than copper if connections weren't properly maintained. Ask your electrician to inspect specifically for aluminum wiring."
- Asbestos: "Common in floor tiles, textured ceilings, and pipe insulation. Testing before any renovation is the right call."

Late 1970s–80s (`medianYear < 1990`):
- Polybutylene plumbing: "Polybutylene plumbing was commonly installed 1978–1995 and was recalled for high failure risk. Ask directly whether it has been replaced — full replacement costs $4,000–$15,000."
- Asbestos: "Possible in textured surfaces or floor tiles if not previously remediated. Ask the inspector to check."

1990s (`medianYear < 2000`):
- Polybutylene tail: "If built before 1995, check whether polybutylene plumbing was installed and replaced."
- HVAC: "Homes of this era may have original HVAC systems approaching end of life (15–20 year lifespan). Ask the inspector to note system age and condition."

**Output HTML structure:**
```html
<div class="prem-intel-era-risks">
  <div class="prem-intel-era-risks-label">What to Watch For in Homes from This Era</div>
  <div class="prem-intel-era-risk-item">
    <div class="prem-intel-era-risk-title">Lead paint</div>
    <p class="prem-intel-era-risk-body">...</p>
  </div>
  <!-- repeat for each risk -->
</div>
```

**Where to insert:** In `buildHousingAgeTab`, call `buildEraHealthRisks(era?.medianYearBuilt)` and append its output after the `riskNotes` and before the final `prem-disclaimer` p tag.

**New CSS to add** (after existing Property Intelligence CSS, search for `prem-intel-cautions` to find the right location):
```css
/* ── Property — Era Health Risks ──────────────────────────── */
.prem-intel-era-risks {
  margin-top: var(--space-4);
  border-top: 1px solid var(--ink-10);
  padding-top: var(--space-3);
}

.prem-intel-era-risks-label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-60);
  margin-bottom: var(--space-3);
}

.prem-intel-era-risk-item {
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--ink-10);
}

.prem-intel-era-risk-item:last-of-type { border-bottom: none; }

.prem-intel-era-risk-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink);
  margin-bottom: var(--space-1);
}

.prem-intel-era-risk-body {
  font-size: var(--text-sm);
  color: var(--ink-60);
  margin: 0;
}
```

**Tests to write** (add to `tests/modules/property/template.test.js`):

```js
describe('buildPropertyIntelligenceHTML — era health risks', () => {
  test('era risk section absent for modern home (2010)', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 2010, newConstructionPct: 40, context: { era: 'Modern', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).not.toMatch(/prem-intel-era-risks/);
  });

  test('era risk section present for 1970s home', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1972, newConstructionPct: 0, context: { era: '1960s–70s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/prem-intel-era-risks/);
  });

  test('lead paint risk shown for pre-1978 home', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1965, newConstructionPct: 0, context: { era: '1960s–70s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/[Ll]ead paint/);
  });

  test('polybutylene risk shown for 1985 home', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1985, newConstructionPct: 0, context: { era: '1980s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/[Pp]olybutylene/);
  });

  test('pre-1940 home shows lead paint and asbestos and plumbing risks', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1935, newConstructionPct: 0, context: { era: 'Pre-1940', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).toMatch(/[Ll]ead paint/);
    expect(html).toMatch(/[Aa]sbestos/);
    expect(html).toMatch(/[Pp]lumbing/);
  });

  test('era risk absent when era is null', () => {
    const p = { ...basePropIntel, era: null };
    const html = buildPropertyIntelligenceHTML(p);
    expect(html).not.toMatch(/prem-intel-era-risks/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const p = { ...basePropIntel, era: { medianYearBuilt: 1965, newConstructionPct: 0, context: { era: '1960s–70s', cautions: [] } } };
    const html = buildPropertyIntelligenceHTML(p);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });
});
```

**Commit message:** `feat(fr-034): add construction era health risks to property L3 building age tab`

---

## Task 2: Civic Infrastructure (Daily Reachability)

**Files to modify:**
- `src/modules/recreation/data.js`
- `src/services/reportBuilder.js`
- `src/templates/pages/reportPage.js`
- `src/modules/reachability/template.js`
- `tests/modules/reachability/template.test.js` (if it exists; create it if not)

**Step 1: Add 3 new functions to `src/modules/recreation/data.js`**

Pattern: identical to `findNearestPark` but with different type and cache key.

```js
async function findNearestLibrary(originLatLng) {
  const cacheKey = `library:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }
  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'library' },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No library found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestRecreationCenter(originLatLng) {
  const cacheKey = `reccenter:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }
  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'community_center' },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No recreation center found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}

async function findNearestPostOffice(originLatLng) {
  const cacheKey = `postoffice:${originLatLng}`;
  const cached = placesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] places:', cacheKey); return cached; }
  const placesResponse = await googleMapsClient.placesNearby({
    params: { key: googleMapsApiKey, location: originLatLng, rankby: 'distance', type: 'post_office' },
  });
  const place = (placesResponse.data.results || [])[0];
  if (!place) throw new Error('No post office found near that address.');
  const result = {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
  placesCache.set(cacheKey, result);
  return result;
}
```

Add to `module.exports`: `findNearestLibrary, findNearestRecreationCenter, findNearestPostOffice`

**Step 2: Update `src/services/reportBuilder.js`**

Import:
```js
const { findNearestPark, findNearestCoffeeShop, findNearestLibrary, findNearestRecreationCenter, findNearestPostOffice } = require('../modules/recreation/data');
```

Add to the `Promise.allSettled` array (after `findNearestElementarySchool`):
```js
findNearestLibrary(originLatLng),
findNearestRecreationCenter(originLatLng),
findNearestPostOffice(originLatLng),
```

Update destructuring:
```js
const [grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, library, recCenter, postOffice] =
  results.map((r) => (r.status === 'fulfilled' ? r.value : null));
```

Pass to `buildReportHTML`:
```js
const html = buildReportHTML(address, {
  grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation,
  park, coffeeShop, elementarySchool, library, recCenter, postOffice,
  customDestinations, trafficData, origin, reportId, chapters,
});
```

**Step 3: Update `src/templates/pages/reportPage.js`**

Update `buildReportHTML` signature:
```js
function buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation, park, coffeeShop, elementarySchool, library, recCenter, postOffice, customDestinations, trafficData, origin, reportId, chapters }) {
```

Update the `buildAdditionalServicesCardHTML` call:
```js
const additionalServicesCardHTML = buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop, library, recCenter, postOffice);
```

**Step 4: Update `buildAdditionalServicesCardHTML` in `src/modules/reachability/template.js`**

Update signature:
```js
function buildAdditionalServicesCardHTML(elementarySchool, park, coffeeShop, library, recCenter, postOffice) {
```

After the existing `services-grid` div, add a civic infrastructure section:
```js
  const civicItems = [
    library   ? { label: 'Public Library',      ...library   } : null,
    recCenter ? { label: 'Recreation Center',   ...recCenter } : null,
    postOffice? { label: 'Post Office',          ...postOffice} : null,
  ].filter(Boolean);

  const civicHTML = civicItems.length ? `
    <div class="civic-section">
      <div class="civic-section-label">Civic Infrastructure</div>
      ${civicItems.map(c => `
        <div class="civic-item">
          <span class="civic-item-label">${escapeHtml(c.label)}</span>
          <span class="civic-item-name">${escapeHtml(c.name)}</span>
          <span class="civic-item-time">${c.driveTimeMinutes} min</span>
        </div>`).join('')}
    </div>` : '';
```

Return `''` if no school/park/coffee AND no civic items. Append `civicHTML` to the existing return value.

**New CSS** (add after `.services-grid` CSS, search for `services-grid-item` to locate):
```css
/* ── Daily — Civic Infrastructure ─────────────────────────── */
.civic-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--ink-10);
}

.civic-section-label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-60);
  margin-bottom: var(--space-3);
}

.civic-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--ink-10);
  font-size: var(--text-sm);
}

.civic-item:last-of-type { border-bottom: none; }

.civic-item-label {
  color: var(--ink-60);
  min-width: 140px;
  flex-shrink: 0;
}

.civic-item-name {
  flex: 1;
  font-weight: 500;
  color: var(--ink);
}

.civic-item-time {
  font-weight: 600;
  color: var(--ink);
  flex-shrink: 0;
}
```

**Tests** (add to `tests/modules/reachability/template.test.js` or create file):

```js
const { buildAdditionalServicesCardHTML } = require('../../../src/modules/reachability/template');

const baseLib    = { name: 'Scott County Public Library', address: '104 S Bradford Ln', location: {}, driveTimeMinutes: 4 };
const baseRec    = { name: 'Georgetown Recreation Center', address: '100 Rec Dr', location: {}, driveTimeMinutes: 6 };
const basePost   = { name: 'Georgetown Main Post Office', address: '200 Main St', location: {}, driveTimeMinutes: 3 };

describe('buildAdditionalServicesCardHTML — civic infrastructure', () => {
  test('civic section rendered when library present', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, null, null);
    expect(html).toMatch(/civic-section/);
    expect(html).toMatch(/Scott County Public Library/);
  });

  test('all three civic items rendered', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, baseRec, basePost);
    expect(html).toMatch(/Scott County Public Library/);
    expect(html).toMatch(/Georgetown Recreation Center/);
    expect(html).toMatch(/Georgetown Main Post Office/);
  });

  test('civic section absent when all three null', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, null, null, null);
    expect(html).toBe('');
  });

  test('drive times rendered', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, null, null);
    expect(html).toMatch(/4 min/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildAdditionalServicesCardHTML(null, null, null, baseLib, baseRec, basePost);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('existing school/park/coffee still renders with civic', () => {
    const school = { name: 'Georgetown Middle School', address: '100 School Rd', driveTimeMinutes: 5 };
    const html = buildAdditionalServicesCardHTML(school, null, null, baseLib, null, null);
    expect(html).toMatch(/Georgetown Middle School/);
    expect(html).toMatch(/Scott County Public Library/);
  });
});
```

**Commit message:** `feat(fr-034): add civic infrastructure (library, rec center, post office) to daily chapter`

---

## Task 3: The 10-Year Horizon (Growth)

**Files to modify:**
- `src/modules/growth/template.js`
- `public/report.css`
- `tests/modules/growth/template.test.js`

**New function to add** (before `buildGrowthAndDevelopmentHTML`):

```js
function buildTenYearHorizonHTML(growth) {
  if (!growth) return '';
  const { permits, newConstruction, namedProjects = [], establishments = [], locationInfo } = growth;
  const county = locationInfo?.county || 'this area';

  // Require at least one real signal to render
  if (!permits && !newConstruction && !namedProjects.length) return '';

  // Signal 1: development pace
  let paceSignal, paceSentence;
  if (permits) {
    if (permits.trend === 'rising' && permits.percentChange >= 10) {
      paceSignal = 'growth';
      paceSentence = `Building permits in ${escapeHtml(county)} are up ${Math.abs(permits.percentChange)}% year-over-year — an active construction pace that typically signals continued investment in the area.`;
    } else if (permits.trend === 'declining' && permits.percentChange <= -10) {
      paceSignal = 'cooling';
      paceSentence = `Building permits in ${escapeHtml(county)} are down ${Math.abs(permits.percentChange)}% from the prior year. That can reflect a maturing market or broader economic conditions — established neighborhoods with stable demand often hold value well even as permit activity cools.`;
    } else {
      paceSignal = 'stable';
      paceSentence = `Building activity in ${escapeHtml(county)} is holding steady — neither a boom nor a significant slowdown.`;
    }
  } else if (newConstruction) {
    const pct = newConstruction.newConstructionPct;
    if (pct >= 20) {
      paceSignal = 'growth';
      paceSentence = `${pct}% of housing in this Census tract was built after 2010, indicating an area that has seen significant recent development.`;
    } else if (pct < 10) {
      paceSignal = 'stable';
      paceSentence = `Only ${pct}% of housing in this Census tract was built after 2010 — an established neighborhood with limited recent new construction.`;
    } else {
      paceSignal = 'stable';
      paceSentence = `About ${pct}% of housing in this Census tract was built after 2010, reflecting moderate new construction activity.`;
    }
  } else {
    return '';
  }

  // Signal 2: confirmed pipeline
  const underConstruction = namedProjects.filter(p => p.status === 'Under Construction');
  const approved          = namedProjects.filter(p => p.status === 'Approved');
  let pipelineSentence = '';
  if (underConstruction.length) {
    pipelineSentence = ` ${escapeHtml(underConstruction[0].name)} is currently under construction nearby — a confirmed change coming to this area.`;
  } else if (approved.length) {
    pipelineSentence = ` ${escapeHtml(approved[0].name)} has been approved and is on the way.`;
  } else if (namedProjects.length === 0) {
    pipelineSentence = ' No major development projects were confirmed in the immediate area.';
  }

  // Signal 3: closing framing
  let closingSentence;
  if (paceSignal === 'growth') {
    closingSentence = "The 10-year signals here point toward continued expansion rather than contraction. That's generally positive for property values, but also means the neighborhood will likely change in character over time.";
  } else if (paceSignal === 'cooling') {
    closingSentence = "Slower growth isn't necessarily negative — ask your agent whether this reflects local conditions or broader trends, and how similar neighborhoods in the area have fared.";
  } else {
    closingSentence = "Stability suggests a neighborhood that has found its equilibrium. The question is whether nearby infrastructure investment will create new momentum or keep things largely as they are.";
  }

  const disclaimer = `<p class="prem-disclaimer">Development signals based on Census permit data, ACS housing data, and confirmed project reports. These are documented trends — not predictions. Research date: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>`;

  return `
    <div class="prem-growth-horizon">
      <div class="prem-growth-label">10-Year Outlook</div>
      <p class="prem-narrative-body">${paceSentence}${pipelineSentence} ${closingSentence}</p>
      ${disclaimer}
    </div>`;
}
```

**Where to insert in `buildGrowthAndDevelopmentHTML`:** After `placesHTML` and before the `key-takeaway` div. Add this line:
```js
const horizonHTML = buildTenYearHorizonHTML(growth);
```

And in the `body` template string, add `${horizonHTML}` between `${placesHTML}` and the `key-takeaway` div.

**New CSS** (add after existing growth CSS, search for `growth-permit-trend-flat` to find the end):
```css
/* ── Growth — 10-Year Horizon ──────────────────────────────── */
.prem-growth-horizon {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--ink-10);
}
```

(The `.prem-growth-label` and `.prem-narrative-body` and `.prem-disclaimer` classes already exist globally.)

**Tests** (add to `tests/modules/growth/template.test.js`):

```js
describe('buildGrowthAndDevelopmentHTML — 10-Year Horizon', () => {
  test('horizon section rendered when rising permits', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/prem-growth-horizon/);
    expect(html).toMatch(/10-Year Outlook/);
  });

  test('horizon includes rising permit context', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/15%/); // percentChange from fullGrowth fixture
  });

  test('horizon includes named project pipeline when present', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    expect(html).toMatch(/Maplewood Subdivision Phase 2/);
  });

  test('horizon absent when no permits and no newConstruction and no namedProjects', () => {
    const g = { ...baseGrowth, namedProjects: [], permits: null, newConstruction: null };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).not.toMatch(/prem-growth-horizon/);
  });

  test('horizon present when only newConstruction available', () => {
    const g = { ...baseGrowth, namedProjects: [], permits: null, newConstruction: { newConstructionPct: 22 } };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/prem-growth-horizon/);
    expect(html).toMatch(/22%/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const html = buildGrowthAndDevelopmentHTML(fullGrowth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('declining permits produce appropriate framing', () => {
    const g = { ...fullGrowth, permits: { current: 900, currentYear: 2023, priorYear: 2022, trend: 'declining', percentChange: -20 } };
    const html = buildGrowthAndDevelopmentHTML(g);
    expect(html).toMatch(/prem-growth-horizon/);
    expect(html).toMatch(/20%/);
  });
});
```

**Commit message:** `feat(fr-034): add 10-year horizon synthesis section to growth chapter`

---

## Final Steps (after all 3 tasks)

1. Run full test suite: `npx jest --no-coverage` — all tests must pass
2. Run the app and visually verify all three chapters using the `/run` skill
3. Write `summary.md` in `feature-requests/FR-034-chapter-enhancements/`
4. Commit summary: `chore(fr-034): add implementation plan and summary`
5. Push to GitHub
