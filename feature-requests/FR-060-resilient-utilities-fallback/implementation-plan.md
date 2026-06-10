# FR-060 Resilient Utilities Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a data fallback behind FR-032's NREL dependency — NREL primary → HIFLD (electric provider/type) + OpenChargeMap (EV) → existing link fallback — so an NREL failure degrades to real data, not just links.

**Architecture:** Contained to `src/modules/utilities/` + constants + `.env.example` + fixtures. Each fetcher (`getElectricData`, `getEvChargingData`) becomes a thin orchestrator over a primary (`*FromNREL`) and a fallback (`getElectricFromHIFLD`, `getEvFromOpenChargeMap`); results carry a `source`. `assembleUtilities` threads `source` + a `stateAvgRate`; the template gains a "provider known, rate unknown" state + provenance notes. `getUtilitiesData` and the cell cache are unchanged.

**Tech Stack:** Node.js, Express, Jest. New external sources: HIFLD Electric Retail Service Territories (ArcGIS REST, keyless) and OpenChargeMap (`api.openchargemap.io`, optional key).

**Run tests with:** `npx jest <path>` (Windows PowerShell).

---

### Task 1: Constant — HIFLD territories URL

**Files:**
- Modify: `src/utils/constants.js`

- [ ] **Step 1: Add the constant** (before `module.exports`, then add the name to the exports object)

```js
// FR-060: HIFLD Electric Retail Service Territories (ArcGIS REST, keyless) —
// point-query fallback for electric provider + ownership when NREL is down.
const HIFLD_TERRITORIES_URL = 'https://services3.arcgis.com/OYP7N6mAJJCyH6hd/arcgis/rest/services/Electric_Retail_Service_Territories_HIFLD/FeatureServer/0';
```

Add `HIFLD_TERRITORIES_URL` to `module.exports`.

- [ ] **Step 2: Verify load**

Run: `node -e "console.log(require('./src/utils/constants').HIFLD_TERRITORIES_URL.includes('Electric_Retail_Service_Territories'))"`
Expected: `true`

- [ ] **Step 3: Commit**

```bash
git add src/utils/constants.js
git commit -m "feat(FR-060): HIFLD Electric Retail Service Territories URL constant"
```

---

### Task 2: Electric — NREL → HIFLD fallback

**Files:**
- Modify: `src/modules/utilities/data.js`
- Create: `tests/modules/utilities/fixtures/hifld-territories.json`
- Test: `tests/modules/utilities/data.test.js` (append)

- [ ] **Step 1: Create the HIFLD fixture**

`tests/modules/utilities/fixtures/hifld-territories.json`:
```json
{
  "features": [
    { "attributes": { "NAME": "KENTUCKY UTILITIES CO", "TYPE": "INVESTOR OWNED" } }
  ]
}
```

- [ ] **Step 2: Write the failing test** (append to `tests/modules/utilities/data.test.js`)

```js
const { getElectricFromHIFLD } = require('../../../src/modules/utilities/data');
const hifldFixture = require('./fixtures/hifld-territories.json');

describe('getElectricFromHIFLD', () => {
  afterEach(() => { global.fetch = undefined; });
  test('parses + title-cases NAME, maps TYPE to ownership, rate null, source HIFLD', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => hifldFixture });
    const r = await getElectricFromHIFLD(38.2098, -84.5588);
    expect(r).toEqual({ utilityName: 'Kentucky Utilities Co', residentialRate: null, ownership: 'INVESTOR OWNED', source: 'HIFLD' });
  });
  test('returns null on empty features / ArcGIS error / non-ok / throw', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: { code: 400 } }) });
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await getElectricFromHIFLD(0, 0)).toBeNull();
  });
});

describe('getElectricData (NREL -> HIFLD orchestration)', () => {
  afterEach(() => { global.fetch = undefined; });
  test('returns NREL result (source NREL) and does NOT call HIFLD when NREL succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) });
    const r = await getElectricData(38.2, -84.5);
    expect(r.source).toBe('NREL');
    expect(global.fetch.mock.calls.length).toBe(1); // NREL only
  });
  test('falls back to HIFLD (source HIFLD) when NREL returns null', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false })                                  // NREL fails
      .mockResolvedValueOnce({ ok: true, json: async () => hifldFixture });   // HIFLD
    const r = await getElectricData(38.2, -84.5);
    expect(r.source).toBe('HIFLD');
    expect(r.utilityName).toBe('Kentucky Utilities Co');
    expect(r.residentialRate).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx jest tests/modules/utilities/data.test.js -t HIFLD`
Expected: FAIL — `getElectricFromHIFLD is not a function`

- [ ] **Step 4: Implement** — in `src/modules/utilities/data.js`

Add to the constants area near the top (after the existing requires):
```js
const { HIFLD_TERRITORIES_URL } = require('../../utils/constants');
```

Replace the existing `getElectricData` function with this refactor (NREL body → `getElectricFromNREL` with a `source` tag, new HIFLD fetcher, thin orchestrator):
```js
function titleCase(s) {
  return String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

async function getElectricFromNREL(lat, lng) {
  try {
    const url = `${NREL_BASE}/utility_rates/v3.json?api_key=${nrelKey()}&lat=${lat}&lon=${lng}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const out = data?.outputs || {};
    const residentialRate = Number(out.residential);
    const utilityName = String(out.utility_name || '').trim();
    const ownership = String(out.utility_info?.[0]?.ownership || '').trim() || null;
    if (!residentialRate || residentialRate <= 0) return null;
    return { utilityName: utilityName || 'Unknown provider', residentialRate, ownership, source: 'NREL' };
  } catch (err) {
    console.error('[NREL Utility Rates]', err.message);
    return null;
  }
}

// Fallback: HIFLD Electric Retail Service Territories (ArcGIS point query) —
// provider name + ownership type, no rate. Keyless.
async function getElectricFromHIFLD(lat, lng) {
  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME,TYPE',
      returnGeometry: 'false', resultRecordCount: '1', f: 'json',
    });
    const resp = await fetch(`${HIFLD_TERRITORIES_URL}/query?${params}`, {
      signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.error) return null; // ArcGIS returns 200 + {error} on bad requests
    const a = data?.features?.[0]?.attributes;
    const name = String(a?.NAME || '').trim();
    if (!name) return null;
    return { utilityName: titleCase(name), residentialRate: null, ownership: String(a?.TYPE || '').trim() || null, source: 'HIFLD' };
  } catch (err) {
    console.error('[HIFLD territories]', err.message);
    return null;
  }
}

// NREL primary -> HIFLD fallback. Short-circuits: no HIFLD call when NREL succeeds.
async function getElectricData(lat, lng) {
  return (await getElectricFromNREL(lat, lng)) || (await getElectricFromHIFLD(lat, lng));
}
```

Add `getElectricFromNREL` and `getElectricFromHIFLD` to `module.exports`.

- [ ] **Step 5: Run to verify pass**

Run: `npx jest tests/modules/utilities/data.test.js -t "HIFLD|orchestration"`
Expected: PASS. Also run `npx jest tests/modules/utilities/data.test.js` — existing electric tests still pass (they assert the parsed fields; the added `source` field means any `toEqual` on the whole electric object now needs `source: 'NREL'` — update those existing assertions if present).

- [ ] **Step 6: Commit**

```bash
git add src/modules/utilities/data.js tests/modules/utilities/data.test.js tests/modules/utilities/fixtures/hifld-territories.json
git commit -m "feat(FR-060): HIFLD electric fallback + NREL->HIFLD orchestration"
```

---

### Task 3: EV — NREL → OpenChargeMap fallback

**Files:**
- Modify: `src/modules/utilities/data.js`
- Create: `tests/modules/utilities/fixtures/openchargemap-poi.json`
- Test: `tests/modules/utilities/data.test.js` (append)

- [ ] **Step 1: Create the OpenChargeMap fixture**

`tests/modules/utilities/fixtures/openchargemap-poi.json`:
```json
[
  { "ID": 1, "AddressInfo": { "Title": "Library L2", "AddressLine1": "1 Main St", "Latitude": 38.21, "Longitude": -84.51, "Distance": 1.2 },
    "Connections": [ { "ConnectionTypeID": 1, "LevelID": 2, "Level": { "ID": 2, "Title": "Level 2", "IsFastChargeCapable": false } } ] },
  { "ID": 2, "AddressInfo": { "Title": "Pilot DCFC", "AddressLine1": "2 Hwy", "Latitude": 38.25, "Longitude": -84.40, "Distance": 4.0 },
    "Connections": [ { "ConnectionTypeID": 33, "LevelID": 3, "Level": { "ID": 3, "Title": "DC Fast", "IsFastChargeCapable": true } } ] }
]
```

- [ ] **Step 2: Write the failing test** (append to `tests/modules/utilities/data.test.js`)

```js
const { getEvFromOpenChargeMap } = require('../../../src/modules/utilities/data');
const ocmFixture = require('./fixtures/openchargemap-poi.json');

describe('getEvFromOpenChargeMap', () => {
  afterEach(() => { global.fetch = undefined; delete process.env.OPENCHARGEMAP_API_KEY; });
  const noDrive = async () => null;

  test('returns null without an API key (no fetch)', async () => {
    global.fetch = jest.fn();
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test('parses nearest L2 + DC-fast from Connections, source OpenChargeMap', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ocmFixture });
    const r = await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r.level2.name).toBe('Library L2');
    expect(r.level2.distanceMiles).toBe('1.2');
    expect(r.dcFast.name).toBe('Pilot DCFC');
    expect(r.source).toBe('OpenChargeMap');
  });
  test('null on non-ok / empty / throw', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('net'));
    expect(await getEvFromOpenChargeMap(38.2, -84.5, '38.2,-84.5', noDrive)).toBeNull();
  });
});

describe('getEvChargingData (NREL -> OpenChargeMap orchestration)', () => {
  afterEach(() => { global.fetch = undefined; delete process.env.OPENCHARGEMAP_API_KEY; });
  const noDrive = async () => null;

  test('falls back to OCM when NREL finds nothing', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fuel_stations: [] }) }) // NREL: none
      .mockResolvedValueOnce({ ok: true, json: async () => ocmFixture });               // OCM
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r.source).toBe('OpenChargeMap');
    expect(r.level2.name).toBe('Library L2');
  });
  test('uses NREL (source NREL) when it has stations; no OCM call', async () => {
    process.env.OPENCHARGEMAP_API_KEY = 'test';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ fuel_stations: [
      { station_name: 'NREL L2', street_address: '1 St', ev_level2_evse_num: 2, ev_dc_fast_num: 0, latitude: 38.21, longitude: -84.51, distance: 1 },
    ] }) });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', noDrive);
    expect(r.source).toBe('NREL');
    expect(global.fetch.mock.calls.length).toBe(1);
  });
});
```

- [ ] **Step 3: Run to verify fail**

Run: `npx jest tests/modules/utilities/data.test.js -t "OpenChargeMap|orchestration"`
Expected: FAIL — `getEvFromOpenChargeMap is not a function`

- [ ] **Step 4: Implement** — in `src/modules/utilities/data.js`

Replace the existing `getEvChargingData` with this refactor (NREL body → `getEvFromNREL`, returning `null` when it finds no chargers so the fallback can trigger; new OCM fetcher; thin orchestrator):
```js
async function getEvFromNREL(lat, lng, driveOrigin, getDriveTime, cell = null) {
  try {
    const url =
      `${NREL_BASE}/alt-fuel-stations/v1/nearest.json?api_key=${nrelKey()}` +
      `&latitude=${lat}&longitude=${lng}&fuel_type=ELEC&radius=infinite&limit=20&status=E&access=public`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const stations = Array.isArray(data?.fuel_stations) ? data.fuel_stations : [];
    const nearestOf = (predicate) =>
      stations.filter(predicate).sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))[0] || null;
    const rawL2 = nearestOf((s) => Number(s.ev_level2_evse_num) > 0);
    const rawDC = nearestOf((s) => Number(s.ev_dc_fast_num) > 0);
    const shape = async (s) => {
      if (!s) return null;
      let driveTimeMinutes = null;
      try { driveTimeMinutes = await getDriveTime(driveOrigin, { lat: s.latitude, lng: s.longitude }, cellDriveOpts(cell)); }
      catch (err) { console.warn('[NREL EV drive time]', err?.message); }
      const distanceMiles = s.distance != null ? Number(s.distance).toFixed(1) : haversineDistance(lat, lng, s.latitude, s.longitude).toFixed(1);
      return { name: String(s.station_name || 'Charging station').trim(), address: String(s.street_address || '').trim(), driveTimeMinutes, distanceMiles };
    };
    const [level2, dcFast] = await Promise.all([shape(rawL2), shape(rawDC)]);
    if (!level2 && !dcFast) return null; // nothing found -> let the fallback try
    return { level2, dcFast, source: 'NREL' };
  } catch (err) {
    console.error('[NREL Alt Fuel Stations]', err.message);
    return null;
  }
}

// Fallback: OpenChargeMap. Optional key; null without it (degrade to link fallback).
async function getEvFromOpenChargeMap(lat, lng, driveOrigin, getDriveTime, cell = null) {
  const key = process.env.OPENCHARGEMAP_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({
      output: 'json', latitude: String(lat), longitude: String(lng),
      distance: '25', distanceunit: 'Miles', maxresults: '20', key,
    });
    const resp = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, {
      signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;
    const pois = await resp.json();
    if (!Array.isArray(pois) || !pois.length) return null;

    const conns = (p) => Array.isArray(p.Connections) ? p.Connections : [];
    const isDC = (p) => conns(p).some((c) => c.LevelID === 3 || c.Level?.IsFastChargeCapable === true);
    const isL2 = (p) => conns(p).some((c) => c.LevelID === 2 || c.Level?.ID === 2);
    const nearest = (pred) => pois.filter(pred).sort((a, b) => (a.AddressInfo?.Distance ?? 1e9) - (b.AddressInfo?.Distance ?? 1e9))[0] || null;

    const shape = async (p) => {
      if (!p) return null;
      const ai = p.AddressInfo || {};
      let driveTimeMinutes = null;
      try { driveTimeMinutes = await getDriveTime(driveOrigin, { lat: ai.Latitude, lng: ai.Longitude }, cellDriveOpts(cell)); }
      catch (err) { console.warn('[OCM EV drive time]', err?.message); }
      const distanceMiles = ai.Distance != null ? Number(ai.Distance).toFixed(1) : haversineDistance(lat, lng, ai.Latitude, ai.Longitude).toFixed(1);
      return { name: String(ai.Title || 'Charging station').trim(), address: String(ai.AddressLine1 || '').trim(), driveTimeMinutes, distanceMiles };
    };
    const [level2, dcFast] = await Promise.all([shape(nearest(isL2)), shape(nearest(isDC))]);
    if (!level2 && !dcFast) return null;
    return { level2, dcFast, source: 'OpenChargeMap' };
  } catch (err) {
    console.error('[OpenChargeMap]', err.message);
    return null;
  }
}

// NREL primary -> OpenChargeMap fallback.
async function getEvChargingData(lat, lng, driveOrigin, getDriveTime, cell = null) {
  return (await getEvFromNREL(lat, lng, driveOrigin, getDriveTime, cell))
      || (await getEvFromOpenChargeMap(lat, lng, driveOrigin, getDriveTime, cell));
}
```

Add `getEvFromNREL` and `getEvFromOpenChargeMap` to `module.exports`.

- [ ] **Step 5: Run to verify pass**

Run: `npx jest tests/modules/utilities/data.test.js`
Expected: PASS (all, incl. the existing EV tests — note: the existing `getEvChargingData` tests in the file may assert `{level2, dcFast}` without `source`; the empty-stations test that expected `{level2:null,dcFast:null}` now expects `null` because NREL returns null when it finds nothing — update that one assertion: `expect(await getEvChargingData(...)).toBeNull()` for the empty case, and add `source: 'NREL'` to the populated-result assertions).

- [ ] **Step 6: Commit**

```bash
git add src/modules/utilities/data.js tests/modules/utilities/data.test.js tests/modules/utilities/fixtures/openchargemap-poi.json
git commit -m "feat(FR-060): OpenChargeMap EV fallback + NREL->OCM orchestration"
```

---

### Task 4: Logic — thread source + state-average rate

**Files:**
- Modify: `src/modules/utilities/logic.js`
- Test: `tests/modules/utilities/logic.test.js` (append)

- [ ] **Step 1: Write the failing test** (append to `tests/modules/utilities/logic.test.js`)

```js
describe('assembleUtilities — FR-060 source + state-avg threading', () => {
  const loc = { state: 'KY', county: 'Scott' };
  test('threads electricSource/evSource and stateAvgRate', () => {
    const raw = {
      electric: { utilityName: 'Kentucky Utilities', residentialRate: null, ownership: 'INVESTOR OWNED', source: 'HIFLD' },
      evCharging: { level2: null, dcFast: null, source: 'OpenChargeMap' },
    };
    const u = assembleUtilities(raw, 'suburban', loc);
    expect(u.electricSource).toBe('HIFLD');
    expect(u.evSource).toBe('OpenChargeMap');
    expect(u.stateAvgRate).toBe(0.128);   // STATE_AVG_ELECTRIC_RATE.KY
    expect(u.rateContext).toBeNull();      // no per-address rate
    expect(u.utilityType.type).toBe('investor-owned'); // ownership mapped
  });
  test('sources null when raw lacks them (NREL-less / older shape)', () => {
    const u = assembleUtilities({ electric: null, evCharging: null }, 'rural', loc);
    expect(u.electricSource).toBeNull();
    expect(u.evSource).toBeNull();
    expect(u.stateAvgRate).toBe(0.128);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/logic.test.js -t "FR-060"`
Expected: FAIL — `electricSource` undefined

- [ ] **Step 3: Implement** — replace `assembleUtilities` in `src/modules/utilities/logic.js`

```js
function assembleUtilities(raw, ruralMode, locationInfo) {
  if (!raw) return null;
  const electric = raw.electric || null;
  const evCharging = raw.evCharging || null;
  const state = locationInfo?.state || '';
  const rate = electric?.residentialRate ?? null;
  return {
    electric,
    evCharging,
    rateContext: getElectricRateContext(rate, state),
    utilityType: electric ? getUtilityType(electric.utilityName, electric.ownership) : null,
    outage:      getOutageContext(state),
    services:    getServiceInference(ruralMode),
    evCost:      getEvChargingCost(rate),
    electricSource: electric?.source ?? null,
    evSource:       evCharging?.source ?? null,
    stateAvgRate:   STATE_AVG_ELECTRIC_RATE[state] ?? null,
    locationInfo: locationInfo || null,
  };
}
```

(`STATE_AVG_ELECTRIC_RATE` is already required at the top of `logic.js`.)

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/logic.test.js`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-060): assembleUtilities threads source + state-avg rate"
```

---

### Task 5: Template — "provider known, rate unknown" state + provenance

**Files:**
- Modify: `src/modules/utilities/template.js`
- Test: `tests/modules/utilities/template.test.js` (append)

- [ ] **Step 1: Write the failing test** (append to `tests/modules/utilities/template.test.js`)

Reuse the existing `full` fixture object in that file. Add:
```js
const { buildUtilitiesHTML: buildU } = require('../../../src/modules/utilities/template');

describe('FR-060 fallback rendering', () => {
  // HIFLD fallback: provider + type known, no rate (rateContext null)
  const hifld = {
    ...full,
    electric: { utilityName: 'Kentucky Utilities', residentialRate: null, ownership: 'INVESTOR OWNED' },
    rateContext: null,
    electricSource: 'HIFLD',
    stateAvgRate: 0.128,
  };
  test('renders provider + type + state-average context (not the link fallback)', () => {
    const html = buildU(hifld);
    expect(html).toContain('Kentucky Utilities');
    expect(html.toLowerCase()).toMatch(/typical residential rate/);
    expect(html).toContain('13¢/kWh'); // round(0.128*100)
    expect(html).not.toMatch(/weren't returned by NREL/); // not the link fallback
  });
  test('shows a HIFLD provenance note on the fallback path', () => {
    expect(buildU(hifld).toLowerCase()).toContain('via hifld');
  });
  test('full NREL path is unchanged (no provenance note)', () => {
    const html = buildU(full); // full has rateContext + no electricSource
    expect(html.toLowerCase()).not.toContain('via hifld');
  });
  test('EV provenance note when evSource is OpenChargeMap', () => {
    const html = buildU({ ...full, evSource: 'OpenChargeMap' });
    expect(html.toLowerCase()).toContain('via openchargemap');
  });
  test('no inline styles, no scoring in the fallback state', () => {
    const html = buildU(hifld);
    expect(html).not.toMatch(/style="/);
    expect(html.toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b/);
  });
});
```

> If the existing test file's `full` fixture lacks `electricSource`/`evSource`/`stateAvgRate`, that's fine — they're read with `?.`/fallback and default to no-note / NREL behavior.

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/template.test.js -t "FR-060"`
Expected: FAIL (no state-average rendering / no provenance note yet)

- [ ] **Step 3: Implement** — in `src/modules/utilities/template.js`

Replace `buildElectricSection` with the three-state version:
```js
function buildElectricSection(u) {
  // State 3: nothing -> actionable link fallback (unchanged)
  if (!u.electric) {
    const state = u.locationInfo?.state || 'your state';
    return `
      <div class="prem-intel-section">
        <div class="prem-intel-label">Electric Service</div>
        <p class="prem-narrative-body">The electric provider and rate for this address weren't returned by NREL. Look up your provider and residential rate at the <a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener noreferrer">OpenEI Utility Rate Database</a>, or check the ${escapeHtml(state)} Public Service Commission site.</p>
      </div>`;
  }
  const { utilityName } = u.electric;
  const typeLabel = u.utilityType ? `<span class="prem-badge ${badgeClass('muted')}">${escapeHtml(u.utilityType.label)}</span>` : '';
  const provenance = (u.electricSource && u.electricSource !== 'NREL')
    ? `<p class="prem-disclaimer">Provider via HIFLD Electric Retail Service Territories.</p>`
    : '';

  // State 2: provider known, per-address rate unknown -> state-average context
  if (!u.rateContext) {
    const state = u.locationInfo?.state || 'your state';
    const stateAvgHTML = (u.stateAvgRate != null)
      ? ` Typical residential rate in ${escapeHtml(state)} is about ${Math.round(u.stateAvgRate * 100)}¢/kWh; a provider-specific rate wasn't available for this address.`
      : ' A provider-specific rate wasn\'t available for this address.';
    return `
      <div class="prem-intel-section">
        <div class="prem-intel-label">Electric Service</div>
        <p class="prem-narrative-body"><strong>${escapeHtml(utilityName)}</strong> ${typeLabel}</p>
        <p class="prem-narrative-body">${stateAvgHTML.trim()}</p>
        ${provenance}
      </div>`;
  }

  // State 1: full NREL (provider + per-address rate vs state) (unchanged)
  const rateBadge = `<span class="prem-badge ${badgeClass(u.rateContext.color)}">${escapeHtml(u.rateContext.deltaLabel)}</span>`;
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Electric Service ${rateBadge}</div>
      <p class="prem-narrative-body"><strong>${escapeHtml(utilityName)}</strong> ${typeLabel}</p>
      <p class="prem-narrative-body">${escapeHtml(u.rateContext.narrative)}</p>
      ${provenance}
    </div>`;
}
```

For the EV provenance note: find `buildEvTab(u)` (the L3 EV tab). At the end of its returned HTML (before the closing backtick / after the source disclaimer), append the OpenChargeMap note conditionally. Add this near the top of `buildEvTab`:
```js
  const evProvenance = (u.evSource === 'OpenChargeMap')
    ? `<p class="prem-disclaimer">Charger data via OpenChargeMap.</p>`
    : '';
```
and include `${evProvenance}` in the function's returned template (e.g., right after the existing `prem-disclaimer` source line). If `buildEvTab` currently takes the full `evCharging` rather than `u`, pass `u` through so it can read `u.evSource` — adjust the call site in `buildDeepDive` accordingly (it already has `u`).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/template.test.js`
Expected: PASS (existing + new). Also `npx jest tests/constraints/no-inline-styles.test.js tests/constraints/no-scoring.test.js` — stay green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/template.js tests/modules/utilities/template.test.js
git commit -m "feat(FR-060): provider-known-rate-unknown electric state + provenance notes"
```

---

### Task 6: `.env.example`, full suite, live verify, summary, roadmap, PR

**Files:**
- Modify: `.env.example`, `docs/IMPLEMENTATION_ROADMAP.md`
- Create: `feature-requests/FR-060-resilient-utilities-fallback/summary.md`

- [ ] **Step 1: Document the key**

Append to `.env.example`:
```
# OpenChargeMap (api.openchargemap.io) — EV charging FALLBACK for the Utilities
# chapter (FR-060), used when NREL's AFDC is unavailable. Free key:
# https://openchargemap.org/site/profile/applications . Optional: without it, the
# EV fallback is skipped and the chapter shows the AFDC lookup link.
OPENCHARGEMAP_API_KEY=your_key_here
```

- [ ] **Step 2: Full suite**

Run: `npx jest`
Expected: PASS — prior count + new FR-060 tests, zero failures.

- [ ] **Step 3: Live verify (HIFLD reachable)**

Run a script hitting `getElectricFromHIFLD` for the 5 test coordinates; confirm: Georgetown/Harlan → Kentucky Utilities, Louisville → Louisville Gas & Electric, Bozeman → NorthWestern Energy, Jeffersonville → Duke Energy Indiana (all title-cased, ownership "INVESTOR OWNED"). (This also closes FR-032's provider-verification gap.) If `OPENCHARGEMAP_API_KEY` is set, also confirm `getEvFromOpenChargeMap` returns chargers for Georgetown.

- [ ] **Step 4: Write `summary.md`**

Document: the fallback chain (NREL → HIFLD/OCM → links), the new electric state, provenance, the live HIFLD 5-address results (closing FR-032's gap), the new `OPENCHARGEMAP_API_KEY`, and the rate-gap behavior (state-average context on the HIFLD path).

- [ ] **Step 5: Update roadmap**

In `docs/IMPLEMENTATION_ROADMAP.md`, note FR-060 (resilient Utilities fallback) and that it closes FR-032's NREL provider-verification gap via HIFLD.

- [ ] **Step 6: Commit + PR**

```bash
git add .env.example feature-requests/FR-060-resilient-utilities-fallback/summary.md docs/IMPLEMENTATION_ROADMAP.md
git commit -m "docs(FR-060): summary, roadmap, .env.example"
git push -u origin FR-060-resilient-utilities-fallback
gh pr create --title "FR-060: Resilient Utilities fallback (NREL -> HIFLD / OpenChargeMap)" --body "<from summary.md>"
```

---

## Self-Review

**Spec coverage:**
- HIFLD constant → Task 1 ✅
- `getElectricFromHIFLD` + NREL→HIFLD orchestration (+ `source`, title-case) → Task 2 ✅
- `getEvFromOpenChargeMap` + NREL→OCM orchestration (+ `source`, key-optional, L2/DC from Connections) → Task 3 ✅
- `assembleUtilities` threads `electricSource`/`evSource`/`stateAvgRate`; `getUtilityType` reused for HIFLD ownership → Task 4 ✅
- Template "provider known, rate unknown" state + HIFLD/OCM provenance notes → Task 5 ✅
- Fixtures (HIFLD + OCM), constraints 001/008/009/011/015, cell-cache unchanged → Tasks 2/3/5 ✅
- `OPENCHARGEMAP_API_KEY` + graceful degradation; live 5-address verify (closes FR-032 gap) → Task 6 ✅

**Placeholder scan:** No TBD/TODO in code steps. `<from summary.md>` is the intentional PR-body fill-in. The existing-test-assertion updates (Tasks 2/3 step 5) are explicit instructions, not placeholders.

**Type consistency:** electric object `{ utilityName, residentialRate, ownership, source }` (NREL: rate number; HIFLD: rate null) consumed by `assembleUtilities` (`electric.source`, `electric.residentialRate`, `electric.ownership`/`utilityName`) and template (`u.electric`, `u.rateContext`, `u.electricSource`, `u.utilityType`, `u.stateAvgRate`). evCharging `{ level2, dcFast, source }`. `getElectricData`/`getEvChargingData` keep their signatures (orchestrators), so `getUtilitiesData` is unchanged. `assembleUtilities` adds `electricSource`/`evSource`/`stateAvgRate`. Consistent across tasks. ✅
