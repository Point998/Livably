# FR-034 Enhancement 4 — Healthcare Depth — Implementation Plan

> **For agentic workers:** Use TDD. Write failing tests first, then implement. Commit after the full suite passes.

---

## Project Context

- Working directory: `C:\Users\Borde\livably`
- Test runner: `npx jest --no-coverage`
- Full suite baseline: 1,104 tests / 61 suites — all must pass after this task
- Constraints: CONSTRAINT-008 (no inline styles), CONSTRAINT-009 (no HTML in data.js), CONSTRAINT-015 (tab always renders with actionable fallback when hospital exists)

---

## File Map

| File | Change |
|------|--------|
| `src/modules/health/data.js` | Add `getCMSHospitalType`, `getPrimaryCareCount`, `getHealthcareDepth` |
| `src/services/reportBuilder.js` | Import `getHealthcareDepth`, call after main batch, pass to `buildReportHTML` |
| `src/templates/pages/reportPage.js` | Update `buildReportHTML` signature + `buildHealthSafetyChapterHTML` call |
| `src/modules/health/template.js` | Add 4th param to `buildHealthSafetyChapterHTML`, add `buildHealthcareEcosystemTab`, add tab to `buildHealthDeepDiveHTML` |
| `tests/modules/health/template.test.js` | Add Healthcare Ecosystem describe block |

---

## Task 1: Data functions

### Step 1: Read `src/modules/health/data.js` first

### Step 2: Add three functions to `src/modules/health/data.js`

Add before `module.exports`:

```js
function mapCMSHospitalType(hospitalType) {
  if (!hospitalType) return null;
  const t = hospitalType.toLowerCase();
  if (t.includes('critical access'))
    return { label: 'Critical Access Hospital', note: 'A smaller rural hospital (typically ≤25 beds). Excellent for local access, but major trauma, complex cardiac events, and specialty procedures are typically transferred to a larger regional medical center.' };
  if (t.includes('acute care') || t.includes('short term'))
    return { label: 'Acute Care Hospital', note: 'Equipped for most emergencies. Verify trauma center designation directly with the hospital if your household has specific trauma care needs.' };
  if (t.includes('children'))
    return { label: "Children’s Hospital", note: 'Specialized pediatric facility — not a general emergency department for adults.' };
  if (t.includes('psychiatric'))
    return { label: 'Psychiatric Hospital', note: 'Specialized psychiatric facility — not a general emergency department.' };
  return null;
}

async function getCMSHospitalType(address) {
  if (!address) return null;
  try {
    const zipMatch = address.match(/\b(\d{5})\b/);
    if (!zipMatch) return null;
    const zip = zipMatch[1];
    const url = `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0?conditions[0][property]=zip_code&conditions[0][operator]=%3D&conditions[0][value]=${zip}&limit=10`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const rows = data?.results ?? data?.data ?? [];
    if (!rows.length) return null;
    // Prefer acute care / critical access over specialty hospitals
    const preferred = rows.find(r => {
      const t = (r.hospital_type || '').toLowerCase();
      return t.includes('acute') || t.includes('critical access');
    }) || rows[0];
    return mapCMSHospitalType(preferred.hospital_type || preferred.hospitalType || null);
  } catch {
    return null;
  }
}

async function getPrimaryCareCount(city, state) {
  if (!city || !state) return null;
  try {
    const cityEnc  = encodeURIComponent(city);
    const stateEnc = encodeURIComponent(state);
    const base = `https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-1&city=${cityEnc}&state=${stateEnc}&limit=1`;
    const [famRes, intRes] = await Promise.allSettled([
      fetch(`${base}&taxonomy_description=Family+Medicine`,  { signal: AbortSignal.timeout(10000) }),
      fetch(`${base}&taxonomy_description=Internal+Medicine`, { signal: AbortSignal.timeout(10000) }),
    ]);
    let total = 0;
    for (const r of [famRes, intRes]) {
      if (r.status !== 'fulfilled' || !r.value.ok) continue;
      const json = await r.value.json();
      total += (json.result_count ?? 0);
    }
    return total;
  } catch {
    return null;
  }
}

async function getHealthcareDepth(hospital, locationInfo) {
  if (!hospital) return null;
  const [desigRes, pcRes] = await Promise.allSettled([
    getCMSHospitalType(hospital.address),
    getPrimaryCareCount(locationInfo?.city, locationInfo?.state),
  ]);
  return {
    designation:      desigRes.status === 'fulfilled' ? desigRes.value : null,
    primaryCareCount: pcRes.status    === 'fulfilled' ? pcRes.value    : null,
  };
}
```

Add to `module.exports`:
```js
module.exports = { findNearestHospital, findNearestUrgentCare, getCMSHospitalType, getPrimaryCareCount, getHealthcareDepth };
```

---

## Task 2: Wire into reportBuilder + reportPage

### Step 1: Update `src/services/reportBuilder.js`

Add import:
```js
const { findNearestHospital, findNearestUrgentCare, getHealthcareDepth } = require('../modules/health/data');
```

After the main `Promise.allSettled` batch and destructuring (after the `library, recCenter, postOffice` line), add:

```js
// Enrich hospital with CMS + NPI depth data (non-blocking)
let healthcareDepth = null;
if (hospital) {
  try {
    healthcareDepth = await getHealthcareDepth(hospital, locationInfo);
  } catch {}
}
```

Update the `buildReportHTML` call to include `healthcareDepth`:
```js
const html = buildReportHTML(address, {
  grocery, pharmacy, hospital, urgentCare, highwayRamp, school, gasStation,
  park, coffeeShop, elementarySchool, library, recCenter, postOffice,
  healthcareDepth, customDestinations, trafficData, origin, reportId, chapters,
});
```

### Step 2: Update `src/templates/pages/reportPage.js`

Update `buildReportHTML` function signature to include `healthcareDepth` in the destructured parameter object.

Update the call to `buildHealthSafetyChapterHTML`:
```js
const healthSafetyChapterHTML = buildHealthSafetyChapterHTML(hospital, chapters?.emergency, urgentCare, healthcareDepth);
```

---

## Task 3: Template — new tab

### Step 1: Read `src/modules/health/template.js`

### Step 2: Add `buildHealthcareEcosystemTab` before `buildHealthDeepDiveHTML`

```js
function buildHealthcareEcosystemTab(hospital, healthcareDepth) {
  const { designation, primaryCareCount } = healthcareDepth || {};

  // Hospital designation section
  let designationHTML;
  if (designation) {
    designationHTML = `
      <div class="health-ecosystem-section">
        <div class="health-ecosystem-label">Hospital Type</div>
        <p class="prem-narrative-body"><strong>${escapeHtml(designation.label)}</strong> — ${escapeHtml(designation.note)}</p>
        <p class="prem-narrative-body">To verify trauma center designation: call ${escapeHtml(hospital.name)} directly or look it up on <a href="https://www.medicare.gov/care-compare/" target="_blank" rel="noopener noreferrer">CMS Care Compare</a>, which includes emergency services and hospital type for every Medicare-certified facility.</p>
      </div>`;
  } else {
    designationHTML = `
      <div class="health-ecosystem-section">
        <div class="health-ecosystem-label">Hospital Type</div>
        <p class="prem-narrative-body">To understand ${escapeHtml(hospital.name)}'s capabilities — trauma designation, ICU capacity, specialty coverage — call the hospital directly or look it up on <a href="https://www.medicare.gov/care-compare/" target="_blank" rel="noopener noreferrer">CMS Care Compare</a>.</p>
      </div>`;
  }

  // Primary care section
  let pcInterpretation;
  if (primaryCareCount === null) {
    pcInterpretation = 'Primary care data was not available for this location. Contact your health insurer for in-network family medicine physicians accepting new patients near this address.';
  } else if (primaryCareCount === 0) {
    pcInterpretation = 'No family medicine or internal medicine physicians were found in this city via the CMS NPI Registry. Verify primary care availability directly with your insurer before committing.';
  } else if (primaryCareCount <= 5) {
    pcInterpretation = `Only ${primaryCareCount} family medicine and internal medicine physicians are registered here. Competition for new patient slots may be limited — search for a primary care physician before you close, not after.`;
  } else if (primaryCareCount <= 15) {
    pcInterpretation = `${primaryCareCount} family medicine and internal medicine physicians are registered in this area — a moderate number. Contact your insurer for in-network options accepting new patients.`;
  } else {
    pcInterpretation = `${primaryCareCount} family medicine and internal medicine physicians are registered in this area, indicating solid primary care availability.`;
  }

  const primaryCareHTML = `
    <div class="health-ecosystem-section">
      <div class="health-ecosystem-label">Primary Care Availability</div>
      <p class="prem-narrative-body">${escapeHtml(pcInterpretation)}</p>
      <p class="prem-narrative-body"><strong>Action:</strong> Contact your health insurer and ask for in-network primary care physicians accepting new patients at this zip code. It typically takes 2–6 weeks to schedule a first appointment — better to find one before you need one.</p>
      <p class="prem-disclaimer">Physician count from CMS NPI Registry — registered practitioners in this city. Not all may be actively seeing patients or accepting new patients.</p>
    </div>`;

  return `${designationHTML}${primaryCareHTML}`;
}
```

### Step 3: Update `buildHealthDeepDiveHTML` to accept and use `healthcareDepth`

Update signature:
```js
function buildHealthDeepDiveHTML(hospital, emergency, urgentCare, healthcareDepth) {
```

Add the new tab to the tabs array (always add it when hospital is present):
```js
  const tabs = [
    { id: 'urgentcare',   label: 'Urgent Care',          content: buildUrgentCareTab(urgentCare, hospital) },
    (hasFire || hasPolice)
      ? { id: 'stations', label: 'Station Details',       content: buildStationDetailsTab(emergency) }
      : null,
    { id: 'iso',          label: 'ISO Fire Rating',       content: buildISOTab(emergency?.fire) },
    hospital
      ? { id: 'ecosystem', label: 'Healthcare Ecosystem', content: buildHealthcareEcosystemTab(hospital, healthcareDepth) }
      : null,
  ].filter(Boolean);
```

### Step 4: Update `buildHealthSafetyChapterHTML` to accept and pass `healthcareDepth`

Update signature:
```js
function buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, healthcareDepth) {
```

Update the call to `buildHealthDeepDiveHTML`:
```js
  const deepDiveHTML = buildHealthDeepDiveHTML(hospital, emergency, urgentCare, healthcareDepth);
```

### Step 5: CSS in `public/report.css`

Find the health deep dive CSS section (search for `health-deep-dive-label`). Add after it:

```css
/* ── Health — Healthcare Ecosystem tab ─────────────────────── */
.health-ecosystem-section {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--ink-10);
}

.health-ecosystem-section:last-of-type { border-bottom: none; }

.health-ecosystem-label {
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-60);
  margin-bottom: var(--space-2);
}
```

---

## Task 4: Tests

### Step 1: Write failing tests in `tests/modules/health/template.test.js`

Add after existing describes:

```js
describe('buildHealthSafetyChapterHTML — Healthcare Ecosystem tab', () => {
  test('Healthcare Ecosystem tab rendered when hospital present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/Healthcare Ecosystem/);
  });

  test('CMS Care Compare link always present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/care-compare/);
  });

  test('designation label rendered when designation present', () => {
    const depth = { designation: { label: 'Acute Care Hospital', note: 'Equipped for most emergencies.' }, primaryCareCount: 12 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/Acute Care Hospital/);
  });

  test('designation note rendered when designation present', () => {
    const depth = { designation: { label: 'Critical Access Hospital', note: 'Smaller rural hospital.' }, primaryCareCount: 3 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/Smaller rural hospital/);
  });

  test('primary care count rendered when available', () => {
    const depth = { designation: null, primaryCareCount: 18 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/18/);
  });

  test('low primary care count triggers appropriate framing', () => {
    const depth = { designation: null, primaryCareCount: 3 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/3/);
    expect(html).toMatch(/Competition for new patient slots/i);
  });

  test('null primaryCareCount shows data unavailable message', () => {
    const depth = { designation: null, primaryCareCount: null };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    expect(html).toMatch(/data was not available/i);
  });

  test('tab rendered when healthcareDepth is null (graceful degradation)', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/Healthcare Ecosystem/);
    expect(html).toMatch(/care-compare/);
  });

  test('no inline styles (CONSTRAINT-008)', () => {
    const depth = { designation: { label: 'Acute Care Hospital', note: 'Equipped.' }, primaryCareCount: 10 };
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, depth);
    const violations = html.match(/style="(?!--)[^"]+"/g);
    expect(violations).toBeNull();
  });

  test('existing tests still pass: urgentCare tab present', () => {
    const html = buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, null);
    expect(html).toMatch(/Urgent Care/);
  });
});
```

### Step 2: Run failing tests

```
npx jest tests/modules/health/template.test.js --no-coverage
```

New tests should fail. Implement then re-run.

### Step 3: Verify full suite

```
npx jest --no-coverage
```

All 1,104+ tests must pass.

---

## Commit messages

```
git add src/modules/health/data.js
git commit -m "feat(fr-034): add CMS hospital type and NPI primary care count to health data"

git add src/services/reportBuilder.js src/templates/pages/reportPage.js
git commit -m "feat(fr-034): wire healthcare depth data through reportBuilder to health template"

git add src/modules/health/template.js public/report.css tests/modules/health/template.test.js
git commit -m "feat(fr-034): add Healthcare Ecosystem tab to health L3 deep dive"
```
