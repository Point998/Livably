# FR-061 Internet as a Utility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the existing FCC National Broadband Map integration from the Property chapter into the Utilities chapter and reframe it as a lightweight "felt" band (who serves it · typical speed range · what it means · satellite floor), with no new data source.

**Architecture:** Three-layer move. `getBroadbandData` (FCC fetch) moves into `utilities/data.js` and rides the existing FR-058 cell cache via `getUtilitiesData`. A new `getInternetContext` in `utilities/logic.js` turns advertised Mbps into a qualitative band + plain-language meaning + a generic satellite-floor flag. `utilities/template.js` gains an Internet L1 section + L3 tab + L4 research link. The Property chapter cleanly loses its internet tab, table, paragraph, and subtitle word.

**Tech Stack:** Node.js, Express, Jest. No new dependencies, no new API key (FCC is keyless).

**Run tests with:** `npx jest <path>` (Windows PowerShell).

**Constraints:** CONSTRAINT-001 (band is label+color, never a score), CONSTRAINT-004 (FCC query carries no brand names; satellite copy generic), CONSTRAINT-008/009 (fetch in data, band in logic, HTML in template; no inline styles), CONSTRAINT-011 (tests + all 5 addresses), CONSTRAINT-015 (no-data → FCC link + satellite reassurance, never silent).

---

### Task 1: Relocate the FCC fetcher into Utilities + cell-cache the internet result

**Files:**
- Modify: `src/modules/utilities/data.js`
- Test: `tests/modules/utilities/data.test.js` (append)
- Create: `tests/modules/utilities/fixtures/fcc-broadband.json`

- [ ] **Step 1: Create the FCC fixture**

`tests/modules/utilities/fixtures/fcc-broadband.json`:
```json
{
  "availability": [
    { "brand_name": "Glo Fiber", "technology_code": 50, "max_advertised_download_speed": 1000, "max_advertised_upload_speed": 1000 },
    { "brand_name": "Spectrum", "technology_code": 41, "max_advertised_download_speed": 300, "max_advertised_upload_speed": 20 },
    { "brand_name": "Spectrum", "technology_code": 41, "max_advertised_download_speed": 300, "max_advertised_upload_speed": 20 }
  ]
}
```

- [ ] **Step 2: Write the failing tests** (append to `tests/modules/utilities/data.test.js`)

```js
const { getBroadbandData } = require('../../../src/modules/utilities/data');
const fccFixture = require('./fixtures/fcc-broadband.json');

describe('getBroadbandData (relocated from Property)', () => {
  afterEach(() => { global.fetch = undefined; });

  test('parses providers, dedups by name, detects fiber + max download, no category field', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fccFixture });
    const r = await getBroadbandData(38.2098, -84.5588);
    expect(r.providers.map((p) => p.name)).toEqual(['Glo Fiber', 'Spectrum']); // dedup, sorted by download desc
    expect(r.providers[0].tech).toBe('Fiber'); // tech code 50
    expect(r.maxDownloadMbps).toBe(1000);
    expect(r.hasFiber).toBe(true);
    expect(r).not.toHaveProperty('category'); // categorization moved to logic
  });

  test('returns null on non-ok / empty / throw', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getBroadbandData(0, 0)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ availability: [] }) });
    expect(await getBroadbandData(0, 0)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await getBroadbandData(0, 0)).toBeNull();
  });
});

describe('getUtilitiesData threads internet', () => {
  afterEach(() => { global.fetch = undefined; });
  const noDrive = async () => null;

  test('includes internet in the assembled raw result', async () => {
    // electric NREL ok, EV none, FCC ok
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) }) // electric
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fuel_stations: [] }) })                                  // EV NREL none
      .mockResolvedValueOnce({ ok: true, json: async () => fccFixture });                                              // FCC
    const r = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', noDrive, null);
    expect(r.internet).not.toBeNull();
    expect(r.internet.hasFiber).toBe(true);
  });
});
```

> Note: `getUtilitiesData` is already imported at the top of `data.test.js` for the FR-060 orchestration tests. If it is not, add `const { getUtilitiesData } = require('../../../src/modules/utilities/data');`.

- [ ] **Step 3: Run to verify fail**

Run: `npx jest tests/modules/utilities/data.test.js -t "getBroadbandData|threads internet"`
Expected: FAIL — `getBroadbandData is not a function`.

- [ ] **Step 4: Implement** — in `src/modules/utilities/data.js`

Add the require near the top (after the existing `HIFLD_TERRITORIES_URL` require):
```js
const { BROADBAND_TECH_CODES } = require('../../utils/constants');
```

Add this function (before `getUtilitiesData`):
```js
// FR-061: FCC National Broadband Map (keyless). Relocated from the Property
// chapter — internet is treated as a utility. Returns advertised availability
// only; the "felt" band is computed in logic.js. No category field here.
async function getBroadbandData(lat, lng) {
  try {
    const url =
      `https://broadbandmap.fcc.gov/api/public/map/listAvailability` +
      `?latitude=${lat}&longitude=${lng}&unit=location&limit=25&category=residential`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const availability =
      Array.isArray(data?.availability) ? data.availability :
      Array.isArray(data?.data)         ? data.data         :
      Array.isArray(data)               ? data              : [];
    if (!availability.length) return null;

    let maxDownload = 0;
    let hasFiber = false;
    const seenNames = new Set();
    const providers = [];
    for (const item of availability) {
      const techCode = item.technology_code ?? item.tech_code ?? 0;
      const download = Number(item.max_advertised_download_speed ?? item.download_speed ?? 0);
      if (download > maxDownload) maxDownload = download;
      if (techCode === 50) hasFiber = true;
      const name = String(item.brand_name || item.doing_business_as || item.provider_name || '').trim();
      if (name && !seenNames.has(name)) {
        seenNames.add(name);
        providers.push({
          name,
          tech:     BROADBAND_TECH_CODES[techCode] || `Type ${techCode}`,
          download,
          upload:   Number(item.max_advertised_upload_speed ?? item.upload_speed ?? 0),
        });
      }
    }
    providers.sort((a, b) => b.download - a.download);
    return { providers: providers.slice(0, 5), maxDownloadMbps: maxDownload, hasFiber };
  } catch (err) {
    console.error('[FCC Broadband]', err.message);
    return null;
  }
}
```

In `getUtilitiesData`, replace the `Promise.allSettled` block and `result` assembly:
```js
  const [electricRes, evRes, internetRes] = await Promise.allSettled([
    getElectricData(sLat, sLng),
    getEvChargingData(sLat, sLng, searchOrigin, getDriveTime, cell),
    getBroadbandData(sLat, sLng),
  ]);
  const result = {
    electric:   electricRes.status === 'fulfilled' ? electricRes.value : null,
    evCharging: evRes.status       === 'fulfilled' ? evRes.value       : null,
    internet:   internetRes.status === 'fulfilled' ? internetRes.value : null,
  };
  // Don't cache a total miss (all null) for the full 30-day TTL.
  if (result.electric !== null || result.evCharging !== null || result.internet !== null) {
    utilitiesCache.set(cacheKey, result);
  }
  return result;
```

Add `getBroadbandData` to `module.exports`.

- [ ] **Step 5: Run to verify pass**

Run: `npx jest tests/modules/utilities/data.test.js`
Expected: PASS (new + existing FR-060 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/utilities/data.js tests/modules/utilities/data.test.js tests/modules/utilities/fixtures/fcc-broadband.json
git commit -m "feat(FR-061): relocate FCC broadband fetch into utilities + cell-cache internet"
```

---

### Task 2: `getInternetContext` felt band + thread through `assembleUtilities`

**Files:**
- Modify: `src/modules/utilities/logic.js`
- Test: `tests/modules/utilities/logic.test.js` (append)

- [ ] **Step 1: Write the failing tests** (append to `tests/modules/utilities/logic.test.js`)

```js
const { getInternetContext } = require('../../../src/modules/utilities/logic');

describe('getInternetContext — FR-061 felt band', () => {
  const bb = (over) => ({ providers: [{ name: 'X', tech: 'Cable' }], maxDownloadMbps: 0, hasFiber: false, ...over });

  test('null in -> null out', () => {
    expect(getInternetContext(null, 'suburban')).toBeNull();
  });
  test('fiber -> gigabit-class green', () => {
    const r = getInternetContext(bb({ hasFiber: true, maxDownloadMbps: 1000 }), 'suburban');
    expect(r.band).toEqual({ label: 'Gigabit-class (fiber)', color: 'green' });
    expect(r.satelliteFloor).toBe(false);
  });
  test('>=940 without fiber flag still gigabit-class', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 940 }), 'suburban').band.color).toBe('green');
  });
  test('>=200 -> fast wired lightgreen', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 300 }), 'suburban').band.color).toBe('lightgreen');
  });
  test('>=25 -> standard gold', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 50 }), 'suburban').band.color).toBe('gold');
  });
  test('>0 -> limited orange, satelliteFloor true', () => {
    const r = getInternetContext(bb({ maxDownloadMbps: 10 }), 'suburban');
    expect(r.band.color).toBe('orange');
    expect(r.satelliteFloor).toBe(true);
  });
  test('0 -> unconfirmed muted, satelliteFloor true', () => {
    const r = getInternetContext(bb({ maxDownloadMbps: 0 }), 'suburban');
    expect(r.band.color).toBe('muted');
    expect(r.satelliteFloor).toBe(true);
  });
  test('rural mode forces satelliteFloor even on fast wired', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 300 }), 'rural').satelliteFloor).toBe(true);
    expect(getInternetContext(bb({ maxDownloadMbps: 300 }), 'remote').satelliteFloor).toBe(true);
  });
  test('providerCount reflects providers length', () => {
    const r = getInternetContext(bb({ maxDownloadMbps: 300, providers: [{ name: 'A', tech: 'Fiber' }, { name: 'B', tech: 'Cable' }] }), 'suburban');
    expect(r.providerCount).toBe(2);
  });
});

describe('assembleUtilities threads internet (FR-061)', () => {
  test('internet present when raw.internet present', () => {
    const u = assembleUtilities(
      { electric: null, evCharging: null, internet: { providers: [], maxDownloadMbps: 1000, hasFiber: true } },
      'suburban',
      { state: 'KY' },
    );
    expect(u.internet.band.color).toBe('green');
  });
  test('internet null when raw lacks it', () => {
    const u = assembleUtilities({ electric: null, evCharging: null }, 'suburban', { state: 'KY' });
    expect(u.internet).toBeNull();
  });
});
```

> `assembleUtilities` is already required at the top of `logic.test.js` (FR-060 tests use it). If not, add `const { assembleUtilities } = require('../../../src/modules/utilities/logic');`.

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/logic.test.js -t "getInternetContext|threads internet"`
Expected: FAIL — `getInternetContext is not a function`.

- [ ] **Step 3: Implement** — in `src/modules/utilities/logic.js`

Add this function (after `getEvChargingCost`, before `assembleUtilities`):
```js
// FR-061: internet treated as a utility. Qualitative "felt" band + plain-language
// meaning from FCC advertised availability — never a precise throughput promise
// (CONSTRAINT-001: label+color, not a score). Satellite copy is generic (CONSTRAINT-004).
function getInternetContext(broadband, ruralMode) {
  if (!broadband) return null;
  const max = Number(broadband.maxDownloadMbps) || 0;
  const hasFiber = !!broadband.hasFiber;

  let band, meaning;
  if (hasFiber || max >= 940) {
    band = { label: 'Gigabit-class (fiber)', color: 'green' };
    meaning = 'Handles anything a household throws at it — multiple remote workers, 4K streaming, and large uploads at once.';
  } else if (max >= 200) {
    band = { label: 'Fast wired broadband', color: 'lightgreen' };
    meaning = 'Comfortable for remote work, video calls, and a houseful of simultaneous streaming.';
  } else if (max >= 25) {
    band = { label: 'Standard broadband', color: 'gold' };
    meaning = 'Fine for everyday streaming and a remote worker or two; heavy simultaneous use may strain it.';
  } else if (max > 0) {
    band = { label: 'Limited wired options', color: 'orange' };
    meaning = 'Wired speeds here are modest — fine for browsing and standard streaming, tighter for heavy remote work.';
  } else {
    band = { label: 'Wired coverage unconfirmed', color: 'muted' };
    meaning = 'No wired speed was confirmed for this address through FCC data — worth verifying directly.';
  }

  const isRural = ruralMode === 'rural' || ruralMode === 'remote';
  const satelliteFloor = band.color === 'orange' || band.color === 'muted' || isRural;

  const providers = Array.isArray(broadband.providers) ? broadband.providers : [];
  return { providers, providerCount: providers.length, band, meaning, satelliteFloor };
}
```

In `assembleUtilities`, add this line to the returned object (after the `evCost:` line):
```js
    internet:    getInternetContext(raw.internet, ruralMode),
```

Add `getInternetContext` to `module.exports`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/logic.test.js`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-061): getInternetContext felt band + assembleUtilities threading"
```

---

### Task 3: Utilities template — Internet L1 section + L3 tab + L4 link + fallback

**Files:**
- Modify: `src/modules/utilities/template.js`
- Test: `tests/modules/utilities/template.test.js` (append)

- [ ] **Step 1: Write the failing tests** (append to `tests/modules/utilities/template.test.js`)

```js
describe('FR-061 internet rendering', () => {
  const { buildUtilitiesHTML: buildUnet } = require('../../../src/modules/utilities/template');
  const withNet = (internet) => ({ ...full, internet });

  test('L1 section + L3 tab show providers, band, and meaning', () => {
    const html = buildUnet(withNet({
      providers: [{ name: 'Glo Fiber', tech: 'Fiber' }, { name: 'Spectrum', tech: 'Cable' }],
      providerCount: 2,
      band: { label: 'Gigabit-class (fiber)', color: 'green' },
      meaning: 'Handles anything a household throws at it.',
      satelliteFloor: false,
    }));
    expect(html).toContain('Gigabit-class (fiber)');
    expect(html).toContain('Glo Fiber');
    expect(html).toMatch(/2 providers serve this address/);
    expect(html).toContain('Internet'); // tab label
  });

  test('satellite line appears only when satelliteFloor is true', () => {
    const on = buildUnet(withNet({ providers: [], providerCount: 0, band: { label: 'Limited wired options', color: 'orange' }, meaning: 'Modest.', satelliteFloor: true }));
    expect(on.toLowerCase()).toMatch(/satellite internet/);
    const off = buildUnet(withNet({ providers: [{ name: 'A', tech: 'Fiber' }], providerCount: 1, band: { label: 'Gigabit-class (fiber)', color: 'green' }, meaning: 'Great.', satelliteFloor: false }));
    expect(off.toLowerCase()).not.toMatch(/satellite internet/);
  });

  test('null internet -> FCC link fallback, never silent', () => {
    const html = buildUnet(withNet(null));
    expect(html).toMatch(/broadbandmap\.fcc\.gov/);
    expect(html.toLowerCase()).toMatch(/satellite internet/);
  });

  test('no inline styles, no scoring in the internet section', () => {
    const html = buildUnet(withNet({ providers: [{ name: 'A', tech: 'Fiber' }], providerCount: 1, band: { label: 'Gigabit-class (fiber)', color: 'green' }, meaning: 'Great.', satelliteFloor: false }));
    expect(html).not.toMatch(/style="/);
    expect(html.toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b/);
  });
});
```

> The existing `full` fixture in this file has no `internet` key; `withNet` adds it explicitly per test. A `full` object without `internet` will render the fallback section — that's acceptable and covered by the existing FR-060 tests staying green.

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/template.test.js -t "FR-061 internet"`
Expected: FAIL (no internet section/tab yet).

- [ ] **Step 3: Implement** — in `src/modules/utilities/template.js`

Add near the top (after the `ICON` constant):
```js
const SATELLITE_LINE = 'Even where wired options are thin, satellite internet now reaches roughly 100–300 Mbps almost anywhere — a workable backstop for this address.';

function internetFallback() {
  return `<p class="prem-narrative-body">No internet providers were returned for this address through the FCC National Broadband Map. Check current availability at <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener noreferrer">broadbandmap.fcc.gov</a> by entering the address directly. ${SATELLITE_LINE}</p>`;
}
```

Add the L1 section builder (after `buildServicesSection`):
```js
function buildInternetSection(u) {
  const net = u.internet;
  if (!net) {
    return `
      <div class="prem-intel-section">
        <div class="prem-intel-label">Internet</div>
        ${internetFallback()}
      </div>`;
  }
  const bandBadge = `<span class="prem-badge ${badgeClass(net.band.color)}">${escapeHtml(net.band.label)}</span>`;
  const who = net.providerCount > 0
    ? `${net.providerCount} provider${net.providerCount === 1 ? '' : 's'} serve this address.`
    : "Provider details weren't itemized for this address.";
  const sat = net.satelliteFloor ? ` ${SATELLITE_LINE}` : '';
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Internet ${bandBadge}</div>
      <p class="prem-narrative-body">${escapeHtml(who)} ${escapeHtml(net.meaning)}${sat}</p>
    </div>`;
}
```

Add the L3 tab builder (after `buildEvTab`):
```js
function buildInternetTab(u) {
  const net = u.internet;
  if (!net) return internetFallback();
  const bandBadge = `<span class="prem-badge ${badgeClass(net.band.color)}">${escapeHtml(net.band.label)}</span>`;
  const cards = net.providers.length
    ? `<div class="prem-intel-bb-providers">
         ${net.providers.map((p) => `
         <div class="prem-intel-bb-provider prem-intel-bb-provider--full">
           <span class="prem-intel-bb-name">${escapeHtml(p.name)}</span>
           <span class="prem-intel-bb-tech">${escapeHtml(p.tech)}</span>
         </div>`).join('')}
       </div>`
    : '';
  const sat = net.satelliteFloor ? `<p class="prem-narrative-body">${SATELLITE_LINE}</p>` : '';
  return `
    <p class="prem-narrative-body">${bandBadge} ${escapeHtml(net.meaning)}</p>
    ${cards}
    ${sat}
    <p class="prem-disclaimer">Source: FCC National Broadband Map. Advertised availability, not measured speeds.</p>`;
}
```

In `buildBody`, add the internet section after the services section:
```js
    ${buildServicesSection(u)}
    ${buildInternetSection(u)}
```

In `buildDeepDive`, add the Internet tab to the `tabs` array (after the `ev` entry):
```js
    { id: 'internet',    label: 'Internet',    content: buildInternetTab(u) },
```

In `buildResearch`, replace the closing cross-link paragraph and the `</ul>` above it. Find:
```js
        <li><a href="https://afdc.energy.gov/stations" target="_blank" rel="noopener noreferrer">DOE Alternative Fuel Data Center — EV charging stations</a></li>
      </ul>
      <p class="prem-narrative-body">Internet providers for this address are covered in the <strong>Property Intelligence</strong> chapter's "Internet Providers" tab (FCC National Broadband Map).</p>
```
Replace with:
```js
        <li><a href="https://afdc.energy.gov/stations" target="_blank" rel="noopener noreferrer">DOE Alternative Fuel Data Center — EV charging stations</a></li>
        <li><a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noopener noreferrer">FCC National Broadband Map — internet providers at this address</a></li>
        <li><a href="${ispSearch}" target="_blank" rel="noopener noreferrer">Search internet providers in ${escapeHtml(county)} County</a></li>
      </ul>
```
And add this line near the other URL consts at the top of `buildResearch` (after the `serviceSearch` const):
```js
  const ispSearch = `https://www.google.com/search?q=${encodeURIComponent(`internet providers ${county} county ${state}`)}`;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/template.test.js`
Expected: PASS (new + existing FR-060 tests).

Also run the constraint guards:
Run: `npx jest tests/constraints/no-inline-styles.test.js tests/constraints/no-scoring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/template.js tests/modules/utilities/template.test.js
git commit -m "feat(FR-061): Internet section + tab + research link in Utilities"
```

---

### Task 4: Clean removal of broadband from the Property chapter

**Files:**
- Modify: `src/modules/property/data.js`, `src/modules/property/logic.js`, `src/modules/property/template.js`
- Test: `tests/modules/property/data.test.js`, `tests/modules/property/template.test.js`

- [ ] **Step 1: Update Property tests first (they will fail until the code is removed)**

In `tests/modules/property/data.test.js`:
- Remove `getBroadbandCategory` from the require destructuring (line ~10).
- Delete the entire `describe('getBroadbandCategory', …)` block (lines ~25–31).

In `tests/modules/property/template.test.js`:
- Remove the `broadband: { … }` key from every fixture object (the `basePropIntel` near line ~19 and `basePropIntelWithBands` near line ~72) — delete the whole `broadband: { providers…, maxDownloadMbps…, hasFiber…, category… }` block in each.
- Delete these tests entirely (they assert the removed internet UI): `renders Internet Providers tab button`, `shows upload speed arrow in broadband tab`, `shows remote work note when upload >= 100 Mbps`, `does not show remote work note when no provider has upload >= 100 Mbps`, `graceful fallback when broadband is null`, `renders FCC broadband map link`, and any test whose body references `broadband`.

- [ ] **Step 2: Run to confirm the suite now expects no broadband**

Run: `npx jest tests/modules/property`
Expected: FAIL — remaining code still references `broadband`/`getBroadbandCategory` (or passes if the assertions were purely additive). Either way, proceed to remove the code.

- [ ] **Step 3: Remove from `src/modules/property/logic.js`**

Delete the entire `getBroadbandCategory` function (lines ~15–21) and remove `getBroadbandCategory` from `module.exports` (line ~61).

- [ ] **Step 4: Remove from `src/modules/property/data.js`**

- Line ~11: remove `getBroadbandCategory` from the `require('./logic')` destructuring.
- Delete the entire `getBroadbandData` function (lines ~85–129).
- In `getPropertyIntelligence`: remove `getBroadbandData(lat, lng),` from the `Promise.allSettled` array; remove the `broadbandRes` element from the destructured results (change `const [soilRes, broadbandRes, acsRes]` to `const [soilRes, acsRes]`); delete the `const broadband = …` line; remove `broadband` from the returned object (`return { soil, era, housingAgeBands, locationInfo };`).
- Remove `getBroadbandData` and `getBroadbandCategory` from `module.exports`.

- [ ] **Step 5: Remove from `src/modules/property/template.js`**

- Delete the entire `buildBroadbandTab` function (lines ~5–32).
- In `buildPropertyDeepDiveHTML`: delete the `{ id: 'internet', label: 'Internet Providers', content: buildBroadbandTab(propIntel.broadband) },` tab entry (line ~206). (`soil` becomes the first tab.)
- In `buildPropertyResearchHTML`: remove `broadband` from the destructuring (line ~234); delete the `providerTable` const (lines ~243–254); remove `providerTable` from the `content` array (line ~297, leaving `[soilSection, ageTable, linksSection]`).
- In `buildPropertyIntelligenceHTML`:
  - Remove `broadband` from the destructuring (line ~303).
  - Delete the entire `// ── Broadband ──` block (`let broadbandPara; … }` lines ~352–376).
  - Delete the `Internet Availability` `prem-intel-section` block from the `body` template (lines ~418–422).
  - In the takeaway `if/else` chain: delete the two branches that reference `broadband` — `} else if (broadband === null || !broadband?.providers?.length) { … }` (lines ~388–389) and `} else if (broadband?.hasFiber || broadband?.maxDownloadMbps >= 1000) { … }` (lines ~392–393).
  - In the `sources` array: delete the `broadband ? 'FCC National Broadband Map' : null,` line (~400).
  - Narrative lead (line ~407): change `County records, soil surveys, and broadband maps reveal` → `County records and soil surveys reveal`.
  - Subtitle (line ~442): change `'Soil, broadband, permits, and the details that listings don\'t show.'` → `'Soil, permits, and the details that listings don\'t show.'`
- `buildPropertyGlanceHTML` references only era + drainage — **no change needed**.

- [ ] **Step 6: Run to verify pass**

Run: `npx jest tests/modules/property`
Expected: PASS.

Run: `npx jest tests/constraints/no-inline-styles.test.js tests/constraints/no-scoring.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/property/data.js src/modules/property/logic.js src/modules/property/template.js tests/modules/property/data.test.js tests/modules/property/template.test.js
git commit -m "refactor(FR-061): remove broadband from Property (moved to Utilities)"
```

---

### Task 5: Full suite, live verify, summary, roadmap, PR

**Files:**
- Modify: `docs/IMPLEMENTATION_ROADMAP.md`
- Create: `feature-requests/FR-061-internet-connectivity/summary.md`

- [ ] **Step 1: Full suite**

Run: `npx jest`
Expected: PASS — zero failures. (Net test count ≈ prior + new utilities internet tests − removed property broadband tests.)

- [ ] **Step 2: Live verify (FCC reachable) on the 5 test addresses**

Run this script and confirm each address returns providers + a sensible band:
```bash
node -e "
const { getBroadbandData } = require('./src/modules/utilities/data');
const { getInternetContext } = require('./src/modules/utilities/logic');
const addrs = [
  ['Georgetown KY', 38.2098, -84.5588, 'suburban'],
  ['Harlan KY', 36.8429, -83.3216, 'rural'],
  ['Louisville KY', 38.2527, -85.7585, 'urban'],
  ['Bozeman MT', 45.6770, -111.0429, 'suburban'],
  ['Jeffersonville IN', 38.2776, -85.7372, 'suburban'],
];
(async () => {
  for (const [name, lat, lng, mode] of addrs) {
    const bb = await getBroadbandData(lat, lng);
    const ctx = getInternetContext(bb, mode);
    console.log(name.padEnd(20), ctx ? \`\${ctx.providerCount} providers | \${ctx.band.label} | sat=\${ctx.satelliteFloor}\` : 'NULL (fallback path)');
  }
})();
"
```
Expected: each address prints providers + a band (or, if FCC is unreachable from this network, `NULL (fallback path)` — which exercises the graceful-degradation path and is acceptable; note it in the summary).

- [ ] **Step 3: Write `summary.md`**

`feature-requests/FR-061-internet-connectivity/summary.md` — document: internet relocated from Property to Utilities (no new source); the felt band + meaning + satellite floor; the new Internet L1 section + L3 tab + L4 links; the Property removal; the live 5-address FCC results; constraints honored; full suite green.

- [ ] **Step 4: Update roadmap**

In `docs/IMPLEMENTATION_ROADMAP.md` (Active Work section), add an FR-061 entry: internet reframed as a utility and moved from Property into the Utilities chapter (felt band, satellite floor), no new data source.

- [ ] **Step 5: Commit, push, PR**

```bash
git add docs/IMPLEMENTATION_ROADMAP.md feature-requests/FR-061-internet-connectivity/summary.md
git commit -m "docs(FR-061): summary + roadmap"
git push -u origin FR-061-internet-connectivity
gh pr create --title "FR-061: Internet as a utility (relocate FCC broadband into Utilities + felt reframe)" --body "<from summary.md>"
```

---

## Self-Review

**Spec coverage:**
- FCC fetch in `utilities/data.js`, cell-cached, internet threaded → Task 1 ✅
- `getInternetContext` felt band (5 buckets) + satellite floor (limited/unconfirmed/rural) + `assembleUtilities` threading → Task 2 ✅
- Internet L1 section + L3 tab + L4 links + null fallback (CONSTRAINT-015) → Task 3 ✅
- Clean Property removal (data/logic/template + tests, subtitle, sources, takeaway branches; glance unchanged) → Task 4 ✅
- Full suite + 5-address live verify + summary + roadmap + PR → Task 5 ✅
- Constraints 001/004/008/009/011/015 + FR-058 cell cache → Tasks 1–4 ✅

**Placeholder scan:** No TBD/TODO. `<from summary.md>` is the intentional PR-body fill-in. Property removal steps cite approximate line numbers (`~`) because earlier edits in the same file shift lines — each removal is identified by function name + unique code, not line number alone.

**Type consistency:** Raw internet object `{ providers:[{name,tech,download,upload}], maxDownloadMbps, hasFiber }` (Task 1) → `getInternetContext` reads `maxDownloadMbps`, `hasFiber`, `providers` and returns `{ providers, providerCount, band:{label,color}, meaning, satelliteFloor }` (Task 2) → template reads `u.internet.{providerCount,band,meaning,satelliteFloor,providers[].{name,tech}}` (Task 3). `assembleUtilities` adds `internet`. `getUtilitiesData` returns `{ electric, evCharging, internet }`. Consistent across tasks. ✅
