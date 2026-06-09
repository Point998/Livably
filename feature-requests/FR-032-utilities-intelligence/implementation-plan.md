# FR-032 Utilities & Power — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Utilities & Power" chapter that tells a buyer who provides their electricity, what they'll likely pay vs the state average, how reliable the grid is (state-level), whether the home is likely on municipal services vs well/septic/propane, and what EV charging costs here.

**Architecture:** A standard three-layer module (`src/modules/utilities/{data,logic,template}.js`) following the Property chapter pattern. `data.js` fetches NREL utility-rate + EV-charging data; `logic.js` applies factual comparison/inference rules (no scoring); `template.js` renders the L1–L4 depth card. Wired into `getChapterData`/`buildChaptersHTML`; `ruralMode` threaded from `reportBuilder.js`. New static constants for state-average electric rate + reliability. ISP is cross-linked to the existing Property chapter, never rebuilt.

**Tech Stack:** Node.js, Express, Jest, vanilla template strings. New external API: NREL (`developer.nrel.gov`) via `fetch`, keyed by optional `NREL_API_KEY` (falls back to `DEMO_KEY`).

**Test path convention (enforced by `tests/constraints/test-coverage.test.js`):** `tests/modules/utilities/{data,logic,template}.test.js`.

**Run tests with:** `npx jest <path>` (Windows: PowerShell).

---

### Task 1: Constants — state electric rate, reliability, EV reference

**Files:**
- Modify: `src/utils/constants.js` (add three exports)

- [ ] **Step 1: Add the constants block**

Append to `src/utils/constants.js` (before `module.exports`, then add the three names to the exports object):

```js
// ── FR-032: Utilities & Power ────────────────────────────────────────────────
// Source: U.S. EIA, average residential electricity price by state ($/kWh).
// Snapshot for comparison context only — values shift slowly; refresh annually
// from https://www.eia.gov/electricity/state/ . Last set: June 2026.
const STATE_AVG_ELECTRIC_RATE = {
  AL: 0.149, AK: 0.246, AZ: 0.143, AR: 0.124, CA: 0.298, CO: 0.149, CT: 0.276,
  DE: 0.151, DC: 0.161, FL: 0.147, GA: 0.140, HI: 0.416, ID: 0.112, IL: 0.151,
  IN: 0.149, IA: 0.136, KS: 0.137, KY: 0.128, LA: 0.118, ME: 0.250, MD: 0.166,
  MA: 0.305, MI: 0.184, MN: 0.148, MS: 0.128, MO: 0.117, MT: 0.120, NE: 0.117,
  NV: 0.155, NH: 0.238, NJ: 0.183, NM: 0.142, NY: 0.234, NC: 0.128, ND: 0.108,
  OH: 0.156, OK: 0.117, OR: 0.128, PA: 0.179, RI: 0.293, SC: 0.142, SD: 0.126,
  TN: 0.122, TX: 0.151, UT: 0.113, VT: 0.213, VA: 0.142, WA: 0.109, WV: 0.143,
  WI: 0.163, WY: 0.118,
};

// Source: U.S. EIA-861 annual electric distribution reliability, IEEE 1366,
// EXCLUDING major event days. saidiHours = avg total interruption duration per
// customer per year; saifiEvents = avg number of interruptions per customer per
// year. State-level averages — NOT parcel- or utility-specific. Refresh from
// EIA-861 reliability tables. Last set: June 2026. NATIONAL_AVG is the fallback.
const STATE_AVG_RELIABILITY = {
  NATIONAL: { saidiHours: 2.2, saifiEvents: 1.0 },
  AL: { saidiHours: 2.0, saifiEvents: 1.1 }, AK: { saidiHours: 2.6, saifiEvents: 1.4 },
  AZ: { saidiHours: 1.7, saifiEvents: 0.9 }, AR: { saidiHours: 2.4, saifiEvents: 1.2 },
  CA: { saidiHours: 2.0, saifiEvents: 0.9 }, CO: { saidiHours: 1.8, saifiEvents: 0.9 },
  CT: { saidiHours: 1.9, saifiEvents: 0.8 }, DE: { saidiHours: 1.6, saifiEvents: 0.8 },
  DC: { saidiHours: 1.4, saifiEvents: 0.6 }, FL: { saidiHours: 1.8, saifiEvents: 1.0 },
  GA: { saidiHours: 2.1, saifiEvents: 1.1 }, HI: { saidiHours: 1.9, saifiEvents: 1.2 },
  ID: { saidiHours: 2.5, saifiEvents: 1.2 }, IL: { saidiHours: 1.7, saifiEvents: 0.9 },
  IN: { saidiHours: 2.2, saifiEvents: 1.1 }, IA: { saidiHours: 2.3, saifiEvents: 1.1 },
  KS: { saidiHours: 2.6, saifiEvents: 1.3 }, KY: { saidiHours: 2.4, saifiEvents: 1.2 },
  LA: { saidiHours: 2.7, saifiEvents: 1.3 }, ME: { saidiHours: 3.1, saifiEvents: 1.4 },
  MD: { saidiHours: 1.8, saifiEvents: 0.8 }, MA: { saidiHours: 1.7, saifiEvents: 0.8 },
  MI: { saidiHours: 2.8, saifiEvents: 1.3 }, MN: { saidiHours: 2.0, saifiEvents: 1.0 },
  MS: { saidiHours: 2.5, saifiEvents: 1.3 }, MO: { saidiHours: 2.4, saifiEvents: 1.2 },
  MT: { saidiHours: 2.7, saifiEvents: 1.3 }, NE: { saidiHours: 2.2, saifiEvents: 1.1 },
  NV: { saidiHours: 1.8, saifiEvents: 0.9 }, NH: { saidiHours: 2.9, saifiEvents: 1.3 },
  NJ: { saidiHours: 1.6, saifiEvents: 0.8 }, NM: { saidiHours: 2.3, saifiEvents: 1.2 },
  NY: { saidiHours: 1.9, saifiEvents: 0.9 }, NC: { saidiHours: 2.2, saifiEvents: 1.1 },
  ND: { saidiHours: 2.4, saifiEvents: 1.1 }, OH: { saidiHours: 2.1, saifiEvents: 1.0 },
  OK: { saidiHours: 2.6, saifiEvents: 1.3 }, OR: { saidiHours: 2.5, saifiEvents: 1.2 },
  PA: { saidiHours: 2.0, saifiEvents: 1.0 }, RI: { saidiHours: 1.7, saifiEvents: 0.8 },
  SC: { saidiHours: 2.2, saifiEvents: 1.1 }, SD: { saidiHours: 2.3, saifiEvents: 1.1 },
  TN: { saidiHours: 2.3, saifiEvents: 1.2 }, TX: { saidiHours: 2.5, saifiEvents: 1.2 },
  UT: { saidiHours: 1.9, saifiEvents: 1.0 }, VT: { saidiHours: 3.0, saifiEvents: 1.4 },
  VA: { saidiHours: 2.1, saifiEvents: 1.0 }, WA: { saidiHours: 2.6, saifiEvents: 1.2 },
  WV: { saidiHours: 2.9, saifiEvents: 1.4 }, WI: { saidiHours: 2.1, saifiEvents: 1.0 },
  WY: { saidiHours: 2.5, saifiEvents: 1.2 },
};

// Reference battery for the "cost to charge once" figure (mid-size EV, kWh).
const EV_BATTERY_KWH_REF = 60;

// FR-058 parity: cell-cache TTL for the utilities payload (electric + EV).
// Utility territory + residential rate are annual-stable; 30 days balances
// freshness against fetch volume.
const UTILITIES_CELL_TTL_DAYS = 30;
```

Add `STATE_AVG_ELECTRIC_RATE`, `STATE_AVG_RELIABILITY`, `EV_BATTERY_KWH_REF`, `UTILITIES_CELL_TTL_DAYS` to the `module.exports` object.

- [ ] **Step 2: Verify constants load**

Run: `node -e "const c=require('./src/utils/constants'); console.log(c.STATE_AVG_ELECTRIC_RATE.KY, c.STATE_AVG_RELIABILITY.MT.saidiHours, c.EV_BATTERY_KWH_REF, c.UTILITIES_CELL_TTL_DAYS)"`
Expected: `0.128 2.7 60 30`

- [ ] **Step 3: Commit**

```bash
git add src/utils/constants.js
git commit -m "feat(FR-032): add state electric-rate, reliability, EV-ref constants"
```

---

### Task 2: Logic — `getElectricRateContext`

**Files:**
- Create: `src/modules/utilities/logic.js`
- Test: `tests/modules/utilities/logic.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/modules/utilities/logic.test.js`:

```js
'use strict';
const { getElectricRateContext } = require('../../../src/modules/utilities/logic');

describe('getElectricRateContext', () => {
  test('rate well below state avg -> below', () => {
    const r = getElectricRateContext(0.10, 'KY'); // avg 0.128
    expect(r.deltaLabel).toBe('below state average');
    expect(r.color).toBe('green');
    expect(r.stateAvg).toBe(0.128);
  });

  test('rate within +/-7% -> near', () => {
    const r = getElectricRateContext(0.128, 'KY');
    expect(r.deltaLabel).toBe('near state average');
    expect(r.color).toBe('gold');
  });

  test('rate well above state avg -> above', () => {
    const r = getElectricRateContext(0.20, 'KY');
    expect(r.deltaLabel).toBe('above state average');
    expect(r.color).toBe('orange');
  });

  test('returns null when rate missing', () => {
    expect(getElectricRateContext(null, 'KY')).toBeNull();
    expect(getElectricRateContext(0, 'KY')).toBeNull();
  });

  test('returns null when state has no average', () => {
    expect(getElectricRateContext(0.12, 'ZZ')).toBeNull();
  });

  test('narrative is a non-empty string with no numeric grade words', () => {
    const r = getElectricRateContext(0.10, 'KY');
    expect(typeof r.narrative).toBe('string');
    expect(r.narrative.length).toBeGreaterThan(0);
    expect(r.narrative.toLowerCase()).not.toMatch(/score|grade|rating|out of/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/utilities/logic.test.js -t getElectricRateContext`
Expected: FAIL — `Cannot find module '.../utilities/logic'`

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/utilities/logic.js`:

```js
'use strict';

const { STATE_AVG_ELECTRIC_RATE, STATE_AVG_RELIABILITY, EV_BATTERY_KWH_REF } = require('../../utils/constants');

// CONSTRAINT-001: factual delta vs state average — never a score or grade.
function getElectricRateContext(residentialRate, state) {
  const rate = Number(residentialRate);
  if (!rate || rate <= 0) return null;
  const stateAvg = STATE_AVG_ELECTRIC_RATE[state];
  if (stateAvg == null) return null;

  const delta = (rate - stateAvg) / stateAvg; // signed fraction
  let deltaLabel, color;
  if (delta < -0.07)      { deltaLabel = 'below state average'; color = 'green'; }
  else if (delta > 0.07)  { deltaLabel = 'above state average'; color = 'orange'; }
  else                    { deltaLabel = 'near state average';  color = 'gold'; }

  const centsRate = Math.round(rate * 100);
  const centsAvg  = Math.round(stateAvg * 100);
  const narrative =
    `The residential rate here is about ${centsRate}¢/kWh, ${deltaLabel} ` +
    `(the ${state} average is roughly ${centsAvg}¢/kWh). Rates are set by the ` +
    `provider and state regulators, so this reflects the utility serving the address.`;

  return { rate, stateAvg, delta, deltaLabel, color, narrative };
}

module.exports = { getElectricRateContext };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/modules/utilities/logic.test.js -t getElectricRateContext`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-032): electric rate-vs-state-average context (logic)"
```

---

### Task 3: Logic — `getUtilityType`

**Files:**
- Modify: `src/modules/utilities/logic.js`
- Test: `tests/modules/utilities/logic.test.js`

- [ ] **Step 1: Add the failing test** (append a new `describe` block)

```js
const { getUtilityType } = require('../../../src/modules/utilities/logic');

describe('getUtilityType', () => {
  test('cooperative names', () => {
    expect(getUtilityType('Blue Grass Energy Cooperative').type).toBe('cooperative');
    expect(getUtilityType('Owen Electric Co-op').type).toBe('cooperative');
    expect(getUtilityType('Jackson Energy EMC').type).toBe('cooperative');
  });
  test('municipal names', () => {
    expect(getUtilityType('City of Tallahassee Utilities').type).toBe('municipal');
    expect(getUtilityType('Frankfort Plant Board').type).toBe('municipal'); // fallback handled below
  });
  test('investor-owned fallback', () => {
    expect(getUtilityType('Kentucky Utilities Company').type).toBe('investor-owned');
    expect(getUtilityType('NorthWestern Energy').type).toBe('investor-owned');
  });
  test('label is hedged (inference, not authoritative)', () => {
    expect(getUtilityType('Kentucky Utilities Company').label.toLowerCase()).toMatch(/appears to be/);
  });
  test('returns null for empty name', () => {
    expect(getUtilityType('')).toBeNull();
    expect(getUtilityType(null)).toBeNull();
  });
});
```

> Note: "Frankfort Plant Board" is a municipal utility but won't match the municipal regex. Adjust this test to expect `investor-owned` (the documented fallback) OR add `plant board` to the municipal regex — choose the regex addition (Step 3 includes it).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/modules/utilities/logic.test.js -t getUtilityType`
Expected: FAIL — `getUtilityType is not a function`

- [ ] **Step 3: Implement** (add to `logic.js`, export it)

```js
function getUtilityType(utilityName) {
  const name = String(utilityName || '').trim();
  if (!name) return null;
  const n = name.toLowerCase();

  let type;
  if (/co-?op|cooperative|rural electric|\bemc\b|\brec\b/.test(n)) {
    type = 'cooperative';
  } else if (/city of|municipal|public (power|util)|board of public|plant board|\butilities?\b$/.test(n)) {
    type = 'municipal';
  } else {
    type = 'investor-owned';
  }

  const LABEL = {
    cooperative:     'Appears to be a member-owned electric cooperative',
    municipal:       'Appears to be a municipal (city/public) utility',
    'investor-owned':'Appears to be an investor-owned utility',
  };
  return { type, label: LABEL[type], hedge: true };
}
```

Update the `module.exports` to include `getUtilityType`.

> Edge case: `/\butilities?\b$/` makes "Kentucky Utilities Company" NOT match municipal (it doesn't end in "utilities"), so it correctly falls to investor-owned. "City of Tallahassee Utilities" matches via `city of`. Verify both in tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/modules/utilities/logic.test.js -t getUtilityType`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-032): utility-type inference from provider name (logic)"
```

---

### Task 4: Logic — `getOutageContext`

**Files:**
- Modify: `src/modules/utilities/logic.js`
- Test: `tests/modules/utilities/logic.test.js`

- [ ] **Step 1: Add failing test**

```js
const { getOutageContext } = require('../../../src/modules/utilities/logic');

describe('getOutageContext', () => {
  test('known state returns its values', () => {
    const r = getOutageContext('MT'); // saidiHours 2.7, saifiEvents 1.3
    expect(r.saidiHours).toBe(2.7);
    expect(r.saifiEvents).toBe(1.3);
    expect(r.narrative.toLowerCase()).toMatch(/state-level|statewide|state average/);
  });
  test('unknown state falls back to NATIONAL', () => {
    const r = getOutageContext('ZZ');
    expect(r.saidiHours).toBe(2.2);
    expect(r.isNationalFallback).toBe(true);
  });
  test('returns null when no state given', () => {
    expect(getOutageContext(null)).toBeNull();
  });
  test('narrative makes clear it is not parcel-specific', () => {
    expect(getOutageContext('KY').narrative.toLowerCase()).toMatch(/not specific|state-level|statewide/);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/logic.test.js -t getOutageContext`
Expected: FAIL

- [ ] **Step 3: Implement**

```js
function getOutageContext(state) {
  if (!state) return null;
  const rec = STATE_AVG_RELIABILITY[state];
  const isNationalFallback = !rec;
  const { saidiHours, saifiEvents } = rec || STATE_AVG_RELIABILITY.NATIONAL;

  const where = isNationalFallback ? 'Nationally' : `In ${state}`;
  const narrative =
    `${where}, utilities average about ${saifiEvents} power interruption(s) per ` +
    `customer per year, totaling roughly ${saidiHours} hours, excluding major ` +
    `storms. This is a state-level average — not specific to this parcel or its ` +
    `feeder line. Actual reliability depends on local infrastructure and tree cover.`;

  return { saidiHours, saifiEvents, isNationalFallback, narrative };
}
```

Export `getOutageContext`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/logic.test.js -t getOutageContext`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-032): state-level reliability context (logic)"
```

---

### Task 5: Logic — `getServiceInference`

**Files:**
- Modify: `src/modules/utilities/logic.js`
- Test: `tests/modules/utilities/logic.test.js`

- [ ] **Step 1: Add failing test**

```js
const { getServiceInference } = require('../../../src/modules/utilities/logic');

describe('getServiceInference', () => {
  test('rural -> well/septic/propane', () => {
    const r = getServiceInference('rural');
    expect(r.water).toMatch(/well/i);
    expect(r.sewer).toMatch(/septic/i);
    expect(r.gas).toMatch(/propane|electric/i);
    expect(r.verify).toBe(true);
  });
  test('remote behaves like rural', () => {
    expect(getServiceInference('remote').water).toMatch(/well/i);
  });
  test('suburban -> municipal', () => {
    const r = getServiceInference('suburban');
    expect(r.water).toMatch(/municipal/i);
    expect(r.sewer).toMatch(/municipal/i);
    expect(r.verify).toBe(true);
  });
  test('urban -> municipal', () => {
    expect(getServiceInference('urban').water).toMatch(/municipal/i);
  });
  test('always carries a verify action string', () => {
    expect(getServiceInference('urban').verifyAction).toMatch(/seller|county|disclosure/i);
  });
  test('unknown mode defaults to suburban/municipal framing', () => {
    expect(getServiceInference(undefined).water).toMatch(/municipal/i);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/logic.test.js -t getServiceInference`
Expected: FAIL

- [ ] **Step 3: Implement**

```js
// Inference only (no parcel-level source exists for water/sewer/gas). CONSTRAINT-007
// classification (ruralMode) is computed upstream and passed in (CONSTRAINT-014).
function getServiceInference(ruralMode) {
  const isRural = ruralMode === 'rural' || ruralMode === 'remote';
  const verifyAction =
    "Confirm on the seller's property disclosure or with the county — water, sewer, " +
    'and gas service can vary lot by lot and this is an inference from area density.';

  if (isRural) {
    return {
      water: 'Likely a private well',
      sewer: 'Likely a septic system',
      gas:   'Likely propane or electric-only (natural gas mains are uncommon here)',
      verify: true,
      verifyAction,
    };
  }
  return {
    water: 'Likely municipal water',
    sewer: 'Likely municipal sewer',
    gas:   'Likely natural gas is available',
    verify: true,
    verifyAction,
  };
}
```

Export `getServiceInference`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/logic.test.js -t getServiceInference`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-032): municipal-vs-well/septic service inference (logic)"
```

---

### Task 6: Logic — `getEvChargingCost`

**Files:**
- Modify: `src/modules/utilities/logic.js`
- Test: `tests/modules/utilities/logic.test.js`

- [ ] **Step 1: Add failing test**

```js
const { getEvChargingCost } = require('../../../src/modules/utilities/logic');

describe('getEvChargingCost', () => {
  test('cost = 60 kWh * rate, rounded to cents', () => {
    const r = getEvChargingCost(0.128);
    expect(r.fullChargeCost).toBeCloseTo(7.68, 2); // 60 * 0.128
    expect(r.batteryKwh).toBe(60);
  });
  test('includes a home-charging note', () => {
    expect(getEvChargingCost(0.128).homeNote.length).toBeGreaterThan(0);
  });
  test('returns null when rate missing', () => {
    expect(getEvChargingCost(null)).toBeNull();
    expect(getEvChargingCost(0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/logic.test.js -t getEvChargingCost`
Expected: FAIL

- [ ] **Step 3: Implement**

```js
function getEvChargingCost(residentialRate) {
  const rate = Number(residentialRate);
  if (!rate || rate <= 0) return null;
  const fullChargeCost = Math.round(EV_BATTERY_KWH_REF * rate * 100) / 100;
  const homeNote =
    `At the local residential rate, a full charge of a typical ${EV_BATTERY_KWH_REF} ` +
    `kWh battery costs about $${fullChargeCost.toFixed(2)} at home — far cheaper than ` +
    `public DC-fast charging. Home charging needs a 240V Level 2 circuit; most garages ` +
    `can add one for $500–$2,000.`;
  return { batteryKwh: EV_BATTERY_KWH_REF, fullChargeCost, homeNote };
}
```

Export `getEvChargingCost`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/logic.test.js`
Expected: PASS (all describe blocks)

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-032): EV cost-per-charge at local rate (logic)"
```

---

### Task 7: Data — NREL electric + EV charging fetch

**Files:**
- Create: `src/modules/utilities/data.js`
- Test: `tests/modules/utilities/data.test.js`

Pattern reference: `src/modules/property/data.js#getBroadbandData` (fetch, timeout, defensive parsing, `null` on failure). `data.js` must contain **no HTML and no inline state comparison** (CONSTRAINT-009/014: no `\.state === 'XX'`, no `detectRuralMode(`).

- [ ] **Step 1: Write the failing test**

Create `tests/modules/utilities/data.test.js`:

```js
'use strict';
const { getElectricData, getEvChargingData, getUtilitiesData } = require('../../../src/modules/utilities/data');
const { utilitiesCache } = require('../../../src/cache');

beforeEach(() => utilitiesCache.clear());
afterAll(() => utilitiesCache.clear());

describe('getElectricData', () => {
  afterEach(() => { global.fetch = undefined; });

  test('parses utility name + residential rate', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ outputs: { utility_name: 'Kentucky Utilities Co', residential: 0.131 } }),
    });
    const r = await getElectricData(38.2, -84.5);
    expect(r).toEqual({ utilityName: 'Kentucky Utilities Co', residentialRate: 0.131 });
  });

  test('returns null on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await getElectricData(38.2, -84.5)).toBeNull();
  });

  test('returns null on fetch throw', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await getElectricData(38.2, -84.5)).toBeNull();
  });

  test('returns null when residential rate absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ outputs: { utility_name: 'X' } }) });
    expect(await getElectricData(38.2, -84.5)).toBeNull();
  });
});

describe('getEvChargingData', () => {
  afterEach(() => { global.fetch = undefined; });
  const fakeDrive = async () => 7;

  test('returns nearest L2 and DC-fast with drive time', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fuel_stations: [
        { station_name: 'Library L2', street_address: '1 Main St', ev_level2_evse_num: 2, ev_dc_fast_num: 0,
          latitude: 38.21, longitude: -84.51, distance: 1.2 },
        { station_name: 'Pilot DCFC', street_address: '2 Hwy', ev_level2_evse_num: 0, ev_dc_fast_num: 4,
          latitude: 38.25, longitude: -84.40, distance: 4.0 },
      ] }),
    });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', fakeDrive);
    expect(r.level2.name).toBe('Library L2');
    expect(r.level2.driveTimeMinutes).toBe(7);
    expect(r.dcFast.name).toBe('Pilot DCFC');
  });

  test('null fields when a type is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ fuel_stations: [] }) });
    const r = await getEvChargingData(38.2, -84.5, '38.2,-84.5', fakeDrive);
    expect(r).toEqual({ level2: null, dcFast: null });
  });

  test('returns null on fetch failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await getEvChargingData(38.2, -84.5, '38.2,-84.5', fakeDrive)).toBeNull();
  });
});

describe('getUtilitiesData', () => {
  afterEach(() => { global.fetch = undefined; });

  test('aggregates electric + ev under Promise.allSettled, tolerates partial failure', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) })
      .mockRejectedValueOnce(new Error('ev down'));
    const r = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, null);
    expect(r.electric.utilityName).toBe('KU');
    expect(r.evCharging).toBeNull();
  });

  test('cell-caches: second call with same cellId makes zero new NREL calls', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ fuel_stations: [] }) });
    const cell = { cellId: 'TESTCELL-FR032', centroid: { lat: 38.2, lng: -84.5 } };
    const r1 = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    const callsAfterMiss = global.fetch.mock.calls.length; // 2 (electric + ev)
    const r2 = await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(global.fetch.mock.calls.length).toBe(callsAfterMiss); // no new fetches on hit
    expect(r2.electric.utilityName).toBe('KU');
    expect(r1).toEqual(r2);
  });

  test('searches from the cell centroid, not the raw address', async () => {
    const seen = [];
    global.fetch = jest.fn((url) => { seen.push(url); return Promise.resolve({ ok: true, json: async () => ({ outputs: { utility_name: 'KU', residential: 0.13 }, fuel_stations: [] }) }); });
    const cell = { cellId: 'TESTCELL-CENTROID', centroid: { lat: 39.99, lng: -83.99 } };
    await getUtilitiesData(38.2, -84.5, '38.2,-84.5', async () => 5, cell);
    expect(seen.join('|')).toContain('39.99'); // centroid lat used in NREL URL
    expect(seen.join('|')).not.toContain('38.2');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/data.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Add the `utilitiesCache` namespace to `src/cache.js`**

After the `watershedCache` definition, add:

```js
// FR-032: utilities (electric + EV charging) are cell-stable — cache by cell.
const { UTILITIES_CELL_TTL_DAYS } = require('./utils/constants');
const utilitiesCache = new Cache('utilities', 60 * 60 * 24 * UTILITIES_CELL_TTL_DAYS); // 30 days
```

Add `utilities: files.filter((f) => utilitiesCache._ownsFile(f)).length` to the `cacheStats` breakdown, and add `utilitiesCache` to `module.exports`.

> Note: `DRIVETIME_CELL_TTL_DAYS` is already destructured at the top of `cache.js`; add `UTILITIES_CELL_TTL_DAYS` to that same top-level require instead of a second require if you prefer — either works.

- [ ] **Step 4: Implement the data layer**

Create `src/modules/utilities/data.js`:

```js
'use strict';

const { haversineDistance } = require('../../utils/geo');
const { cellSearchOrigin, cellDriveOpts } = require('../../shared/spatial');
const { utilitiesCache } = require('../../cache');

const NREL_BASE = 'https://developer.nrel.gov/api';
function nrelKey() { return process.env.NREL_API_KEY || 'DEMO_KEY'; }

async function getElectricData(lat, lng) {
  try {
    const url = `${NREL_BASE}/utility_rates/v3.json?api_key=${nrelKey()}&lat=${lat}&lon=${lng}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const out = data?.outputs || {};
    const residentialRate = Number(out.residential);
    const utilityName = String(out.utility_name || '').trim();
    if (!residentialRate || residentialRate <= 0) return null;
    return { utilityName: utilityName || 'Unknown provider', residentialRate };
  } catch (err) {
    console.error('[NREL Utility Rates]', err.message);
    return null;
  }
}

// driveOrigin is the cell centroid string ("lat,lng") when a cell is present;
// drive time is cell-shared via cellDriveOpts (FR-058), never a Google call here.
async function getEvChargingData(lat, lng, driveOrigin, getDriveTime, cell = null) {
  try {
    const url =
      `${NREL_BASE}/alt-fuel-stations/v1/nearest.json?api_key=${nrelKey()}` +
      `&latitude=${lat}&longitude=${lng}&fuel_type=ELEC&radius=infinite&limit=20&status=E&access=public`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const stations = Array.isArray(data?.fuel_stations) ? data.fuel_stations : [];

    const nearestOf = (predicate) =>
      stations.filter(predicate)
        .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))[0] || null;

    const rawL2 = nearestOf((s) => Number(s.ev_level2_evse_num) > 0);
    const rawDC = nearestOf((s) => Number(s.ev_dc_fast_num) > 0);

    const shape = async (s) => {
      if (!s) return null;
      let driveTimeMinutes = null;
      try { driveTimeMinutes = await getDriveTime(driveOrigin, { lat: s.latitude, lng: s.longitude }, cellDriveOpts(cell)); } catch {}
      const distanceMiles = s.distance != null
        ? Number(s.distance).toFixed(1)
        : haversineDistance(lat, lng, s.latitude, s.longitude).toFixed(1);
      return {
        name: String(s.station_name || 'Charging station').trim(),
        address: String(s.street_address || '').trim(),
        driveTimeMinutes,
        distanceMiles,
      };
    };

    const [level2, dcFast] = await Promise.all([shape(rawL2), shape(rawDC)]);
    return { level2, dcFast };
  } catch (err) {
    console.error('[NREL Alt Fuel Stations]', err.message);
    return null;
  }
}

// Cell-cached entry point (FR-058 parity). Warm cell -> zero NREL calls.
// Searches from the cell centroid so every address in a cell shares one fetch.
async function getUtilitiesData(lat, lng, originLatLng, getDriveTime, cell = null) {
  const cacheKey = cell ? `utilities:${cell.cellId}` : `utilities:${originLatLng}`;
  const cached = utilitiesCache.get(cacheKey);
  if (cached) { console.log('[CACHE HIT] utilities:', cacheKey); return cached; }

  const searchOrigin = cellSearchOrigin(originLatLng, cell); // "lat,lng" string
  const [sLat, sLng] = searchOrigin.split(',').map((n) => parseFloat(n));

  const [electricRes, evRes] = await Promise.allSettled([
    getElectricData(sLat, sLng),
    getEvChargingData(sLat, sLng, searchOrigin, getDriveTime, cell),
  ]);
  const result = {
    electric:   electricRes.status === 'fulfilled' ? electricRes.value : null,
    evCharging: evRes.status       === 'fulfilled' ? evRes.value       : null,
  };
  utilitiesCache.set(cacheKey, result);
  return result;
}

module.exports = { getElectricData, getEvChargingData, getUtilitiesData };
```

- [ ] **Step 5: Run to verify pass**

Run: `npx jest tests/modules/utilities/data.test.js`
Expected: PASS (electric, ev, aggregate, cache-hit, centroid)

- [ ] **Step 6: Commit**

```bash
git add src/cache.js src/modules/utilities/data.js tests/modules/utilities/data.test.js
git commit -m "feat(FR-032): cell-cached NREL electric + EV-charging data layer"
```

---

### Task 8: Template — `buildUtilitiesHTML` (L1–L4)

**Files:**
- Create: `src/modules/utilities/template.js`
- Test: `tests/modules/utilities/template.test.js`

Pattern reference: `src/modules/property/template.js`. Use only existing semantic classes (`prem-narrative`, `prem-narrative-lead`, `prem-narrative-body`, `prem-intel-section`, `prem-intel-label`, `prem-badge`, `prem-disclaimer`, `key-takeaway`/`kt-icon`/`kt-body`, `climate-tab`/`climate-tab-nav`/`climate-tab-panel`/`climate-tab-panels`, `chapter-glance`/`chapter-glance-item`/`chapter-glance-sep`, `climate-research-section`/`climate-research-links`). **No inline styles, no hardcoded colors** (CONSTRAINT-008). Build aggregate object shape:

```
utilities = {
  electric: { utilityName, residentialRate } | null,
  evCharging: { level2, dcFast } | null,
  rateContext: <getElectricRateContext result> | null,
  utilityType: <getUtilityType result> | null,
  outage: <getOutageContext result> | null,
  services: <getServiceInference result>,
  evCost: <getEvChargingCost result> | null,
  locationInfo: { state, county, city },
}
```

> The `logic.js` derivations are assembled in the wiring task (Task 9), then handed to the template. The template performs **zero** logic/fetch — it only renders this object.

- [ ] **Step 1: Write the failing test**

Create `tests/modules/utilities/template.test.js`:

```js
'use strict';
const { buildUtilitiesHTML } = require('../../../src/modules/utilities/template');

const full = {
  electric: { utilityName: 'Kentucky Utilities', residentialRate: 0.131 },
  evCharging: {
    level2: { name: 'Library L2', address: '1 Main', driveTimeMinutes: 6, distanceMiles: '1.2' },
    dcFast: { name: 'Pilot DCFC', address: '2 Hwy', driveTimeMinutes: 9, distanceMiles: '4.0' },
  },
  rateContext: { rate: 0.131, stateAvg: 0.128, delta: 0.02, deltaLabel: 'near state average', color: 'gold', narrative: 'about 13¢/kWh, near state average.' },
  utilityType: { type: 'investor-owned', label: 'Appears to be an investor-owned utility', hedge: true },
  outage: { saidiHours: 2.4, saifiEvents: 1.2, isNationalFallback: false, narrative: 'In KY, utilities average about 1.2 interruptions, state-level — not specific to this parcel.' },
  services: { water: 'Likely municipal water', sewer: 'Likely municipal sewer', gas: 'Likely natural gas is available', verify: true, verifyAction: 'Confirm with the county.' },
  evCost: { batteryKwh: 60, fullChargeCost: 7.86, homeNote: 'A full charge costs about $7.86 at home.' },
  locationInfo: { state: 'KY', county: 'Scott', city: 'Georgetown' },
};

describe('buildUtilitiesHTML', () => {
  test('returns empty string when utilities is null', () => {
    expect(buildUtilitiesHTML(null)).toBe('');
  });
  test('renders chapter section with data-ch="utilities"', () => {
    const html = buildUtilitiesHTML(full);
    expect(html).toContain('data-ch="utilities"');
    expect(html).toContain('Utilities &amp; Power');
  });
  test('shows provider name and rate label at L2', () => {
    const html = buildUtilitiesHTML(full);
    expect(html).toContain('Kentucky Utilities');
    expect(html).toContain('near state average');
  });
  test('renders EV L2 + DC-fast in the deep dive', () => {
    const html = buildUtilitiesHTML(full);
    expect(html).toContain('Library L2');
    expect(html).toContain('Pilot DCFC');
  });
  test('cross-links to Property internet, does not invent ISP data', () => {
    const html = buildUtilitiesHTML(full).toLowerCase();
    expect(html).toMatch(/internet|broadband|property/);
  });
  test('contains no inline style attributes', () => {
    expect(buildUtilitiesHTML(full)).not.toMatch(/style="/);
  });
  test('contains no scoring language', () => {
    expect(buildUtilitiesHTML(full).toLowerCase()).not.toMatch(/\bscore\b|\bgrade\b|out of 10|\/100/);
  });
  test('graceful fallback when electric is null (actionable, not silent)', () => {
    const html = buildUtilitiesHTML({ ...full, electric: null, rateContext: null, utilityType: null, evCost: null });
    expect(html.toLowerCase()).toMatch(/nrel|look up|provider/);
    expect(html).toContain('data-ch="utilities"');
  });
  test('graceful fallback when evCharging is null', () => {
    const html = buildUtilitiesHTML({ ...full, evCharging: null });
    expect(html.toLowerCase()).toMatch(/charging|afdc|alternative fuel/);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/template.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `src/modules/utilities/template.js`:

```js
'use strict';
const { escapeHtml } = require('../../utils/text');
const { badgeClass, renderChapterCard } = require('../../templates/components');

const ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

function evFallback() {
  return `<p class="prem-narrative-body">No public charging stations were returned for this area through the U.S. DOE Alternative Fuel Data Center. Search current stations at <a href="https://afdc.energy.gov/stations" target="_blank" rel="noopener">afdc.energy.gov/stations</a>.</p>`;
}

function buildElectricSection(u) {
  if (!u.electric || !u.rateContext) {
    const state = u.locationInfo?.state || 'your state';
    return `
      <div class="prem-intel-section">
        <div class="prem-intel-label">Electric Service</div>
        <p class="prem-narrative-body">The electric provider and rate for this address weren't returned by NREL. Look up your provider and residential rate at the <a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener">OpenEI Utility Rate Database</a>, or check the ${escapeHtml(state)} Public Service Commission site.</p>
      </div>`;
  }
  const { utilityName } = u.electric;
  const typeLabel = u.utilityType ? `<span class="prem-badge ${badgeClass('muted')}">${escapeHtml(u.utilityType.label)}</span>` : '';
  const rateBadge = `<span class="prem-badge ${badgeClass(u.rateContext.color)}">${escapeHtml(u.rateContext.deltaLabel)}</span>`;
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Electric Service ${rateBadge}</div>
      <p class="prem-narrative-body"><strong>${escapeHtml(utilityName)}</strong> ${typeLabel}</p>
      <p class="prem-narrative-body">${escapeHtml(u.rateContext.narrative)}</p>
    </div>`;
}

function buildReliabilitySection(u) {
  if (!u.outage) return '';
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Grid Reliability</div>
      <p class="prem-narrative-body">${escapeHtml(u.outage.narrative)}</p>
    </div>`;
}

function buildServicesSection(u) {
  const s = u.services;
  if (!s) return '';
  return `
    <div class="prem-intel-section">
      <div class="prem-intel-label">Water, Sewer &amp; Gas (Likely)</div>
      <p class="prem-narrative-body">${escapeHtml(s.water)}. ${escapeHtml(s.sewer)}. ${escapeHtml(s.gas)}.</p>
      <p class="prem-disclaimer">${escapeHtml(s.verifyAction)}</p>
    </div>`;
}

function buildBody(u) {
  let takeaway;
  if (u.rateContext?.deltaLabel === 'above state average') {
    takeaway = 'Electricity here runs above the state average — factor a slightly higher monthly bill into your cost picture, and ask the seller for recent utility statements.';
  } else if (u.services?.water?.match(/well/i)) {
    takeaway = 'This address is likely on a private well and septic system. Budget for periodic testing and maintenance, and make a well/septic inspection part of your due diligence.';
  } else if (u.evCost) {
    takeaway = `If you drive electric, a full home charge here costs about $${u.evCost.fullChargeCost.toFixed(2)} — far below public fast-charging.`;
  } else {
    takeaway = 'Confirm water, sewer, and gas service on the seller\'s disclosure before closing — these set your monthly costs for as long as you own the home.';
  }

  return `
    <div class="prem-narrative">
      <p class="prem-narrative-lead">Who powers this home, what it costs relative to the state, how reliable the grid is, and what services the lot is likely on — the monthly costs you'll carry for as long as you live here.</p>
    </div>
    ${buildElectricSection(u)}
    ${buildReliabilitySection(u)}
    ${buildServicesSection(u)}
    <div class="key-takeaway">
      <span class="kt-icon">🔌</span>
      <div class="kt-body"><strong>Key Takeaway:</strong> ${escapeHtml(takeaway)}</div>
    </div>`;
}

function buildElectricTab(u) {
  if (!u.electric || !u.rateContext) return buildElectricSection(u);
  const centsRate = Math.round(u.rateContext.rate * 100);
  const centsAvg  = Math.round(u.rateContext.stateAvg * 100);
  return `
    <p class="prem-narrative-body">${escapeHtml(u.electric.utilityName)} serves this address. ${u.utilityType ? escapeHtml(u.utilityType.label) + '.' : ''}</p>
    <p class="prem-narrative-body">Residential rate: about <strong>${centsRate}¢/kWh</strong> vs the ${escapeHtml(u.locationInfo?.state || '')} average of about ${centsAvg}¢/kWh — ${escapeHtml(u.rateContext.deltaLabel)}.</p>
    <p class="prem-disclaimer">Source: NREL / OpenEI Utility Rate Database. Rate is the provider's residential average, not a parcel-specific bill.</p>`;
}

function buildReliabilityTab(u) {
  if (!u.outage) return `<p class="prem-narrative-body">State reliability data was not available.</p>`;
  return `
    <p class="prem-narrative-body">${escapeHtml(u.outage.narrative)}</p>
    <p class="prem-narrative-body">SAIDI (avg hours of interruption/yr): <strong>${u.outage.saidiHours}</strong> · SAIFI (avg interruptions/yr): <strong>${u.outage.saifiEvents}</strong>.</p>
    <p class="prem-disclaimer">Source: U.S. EIA-861 distribution reliability (IEEE 1366), excluding major event days. State-level average.</p>`;
}

function buildEvTab(u) {
  if (!u.evCharging) return evFallback();
  const card = (s, kind) => s
    ? `<div class="prem-intel-bb-provider prem-intel-bb-provider--full">
         <span class="prem-intel-bb-name">${escapeHtml(s.name)}</span>
         <span class="prem-intel-bb-tech">${kind}</span>
         <span class="prem-intel-bb-speed">${s.driveTimeMinutes != null ? `${s.driveTimeMinutes} min drive` : `${escapeHtml(s.distanceMiles)} mi`}</span>
       </div>`
    : `<p class="prem-narrative-body">No public ${kind} charger found nearby.</p>`;
  const cost = u.evCost
    ? `<p class="prem-narrative-body">${escapeHtml(u.evCost.homeNote)}</p>`
    : '';
  return `
    <div class="prem-intel-bb-providers">
      ${card(u.evCharging.level2, 'Level 2')}
      ${card(u.evCharging.dcFast, 'DC Fast')}
    </div>
    ${cost}
    <p class="prem-disclaimer">Source: U.S. DOE Alternative Fuel Data Center. Drive time via Google, 8am Tuesday departure.</p>`;
}

function buildDeepDive(u) {
  const tabs = [
    { id: 'electric',    label: 'Electric',    content: buildElectricTab(u) },
    { id: 'reliability', label: 'Reliability', content: buildReliabilityTab(u) },
    { id: 'ev',          label: 'EV Charging',  content: buildEvTab(u) },
  ];
  const buttons = tabs.map((t, i) =>
    `<button class="climate-tab${i === 0 ? ' climate-tab--active' : ''}" role="tab" aria-selected="${i === 0}" aria-controls="utiltab-${t.id}" id="utilbtn-${t.id}">${t.label}</button>`).join('');
  const panels = tabs.map((t, i) =>
    `<div class="climate-tab-panel${i === 0 ? ' climate-tab-panel--active' : ''}" id="utiltab-${t.id}" role="tabpanel" aria-labelledby="utilbtn-${t.id}">${t.content}</div>`).join('');
  return `
    <div class="property-deep-dive">
      <div class="community-deep-dive-label">Utilities in Depth</div>
      <nav class="climate-tab-nav" role="tablist" aria-label="Utilities deep dive">${buttons}</nav>
      <div class="climate-tab-panels">${panels}</div>
    </div>`;
}

function buildResearch(u) {
  const state  = u.locationInfo?.state  || '';
  const county = u.locationInfo?.county || 'this county';
  const outageSearch = `https://www.google.com/search?q=${encodeURIComponent(`${u.electric?.utilityName || state + ' electric utility'} outage map`)}`;
  const serviceSearch = `https://www.google.com/search?q=${encodeURIComponent(`${county} county water sewer service area`)}`;
  return `
    <div class="climate-research-section">
      <div class="climate-research-section-label">Verify &amp; Go Deeper</div>
      <ul class="climate-research-links">
        <li><a href="https://apps.openei.org/USURDB/" target="_blank" rel="noopener noreferrer">OpenEI Utility Rate Database — provider &amp; rate</a></li>
        <li><a href="https://www.eia.gov/electricity/data/eia861/" target="_blank" rel="noopener noreferrer">EIA-861 — utility reliability data</a></li>
        <li><a href="${outageSearch}" target="_blank" rel="noopener noreferrer">Your utility's live outage map</a></li>
        <li><a href="${serviceSearch}" target="_blank" rel="noopener noreferrer">${escapeHtml(county)} water &amp; sewer service-area lookup</a></li>
        <li><a href="https://afdc.energy.gov/stations" target="_blank" rel="noopener noreferrer">DOE Alternative Fuel Data Center — EV charging stations</a></li>
      </ul>
      <p class="prem-narrative-body">Internet providers for this address are covered in the <strong>Property Intelligence</strong> chapter's “Internet Providers” tab (FCC National Broadband Map).</p>
    </div>`;
}

function buildGlance(u) {
  if (!u.electric) return '';
  const parts = [
    `<span class="chapter-glance-item">${escapeHtml(u.electric.utilityName)}</span>`,
    u.rateContext ? `<span class="chapter-glance-sep">·</span><span class="chapter-glance-item">${escapeHtml(u.rateContext.deltaLabel)}</span>` : '',
  ].filter(Boolean).join('');
  return `<div class="chapter-glance">${parts}</div>`;
}

function buildUtilitiesHTML(utilities) {
  if (!utilities) return '';
  const body = buildBody(utilities);
  const glance = buildGlance(utilities);
  const fullHTML = [
    `<div class="depth-l3">${buildDeepDive(utilities)}</div>`,
    `<div class="depth-l4">${buildResearch(utilities)}</div>`,
  ].join('');
  return renderChapterCard(
    'utilities', '12', ICON,
    'Utilities & Power',
    'What you\'ll pay, who provides it, and how reliable it is.',
    null, body, null, fullHTML, null, glance || null,
  );
}

module.exports = { buildUtilitiesHTML };
```

> Chapter number `'12'` is a display label; adjust only if the final chapter ordering requires it. The `data-ch="utilities"` attribute (not the number) drives the color.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/template.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/utilities/template.js tests/modules/utilities/template.test.js
git commit -m "feat(FR-032): Utilities chapter template (L1-L4)"
```

---

### Task 9: Wiring — assemble logic, thread ruralMode, render

**Files:**
- Modify: `src/chapters.js` (imports, `getChapterData`, `buildChaptersHTML`)
- Modify: `src/services/reportBuilder.js` (pass `ruralMode` into `getChapterData`)
- Test: `tests/modules/utilities/wiring.test.js` (new) — unit-test the assembly helper

To keep `getChapterData` thin and testable, put the logic-assembly in a small exported helper in `src/modules/utilities/logic.js`.

- [ ] **Step 1: Add failing test for the assembly helper**

Append to `tests/modules/utilities/logic.test.js`:

```js
const { assembleUtilities } = require('../../../src/modules/utilities/logic');

describe('assembleUtilities', () => {
  const raw = { electric: { utilityName: 'Kentucky Utilities', residentialRate: 0.131 },
                evCharging: { level2: null, dcFast: null } };
  const loc = { state: 'KY', county: 'Scott', city: 'Georgetown' };

  test('derives rateContext, utilityType, outage, services, evCost', () => {
    const u = assembleUtilities(raw, 'suburban', loc);
    expect(u.rateContext.deltaLabel).toMatch(/average/);
    expect(u.utilityType.type).toBe('investor-owned');
    expect(u.outage.saidiHours).toBe(2.4);
    expect(u.services.water).toMatch(/municipal/i);
    expect(u.evCost.batteryKwh).toBe(60);
    expect(u.locationInfo).toBe(loc);
  });

  test('handles null electric (no rate) without throwing', () => {
    const u = assembleUtilities({ electric: null, evCharging: null }, 'rural', loc);
    expect(u.rateContext).toBeNull();
    expect(u.utilityType).toBeNull();
    expect(u.evCost).toBeNull();
    expect(u.services.water).toMatch(/well/i); // rural inference still present
    expect(u.outage).not.toBeNull();           // state-level, independent of electric
  });

  test('returns null when raw is null', () => {
    expect(assembleUtilities(null, 'urban', loc)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx jest tests/modules/utilities/logic.test.js -t assembleUtilities`
Expected: FAIL — `assembleUtilities is not a function`

- [ ] **Step 3: Implement the helper in `logic.js`**

```js
function assembleUtilities(raw, ruralMode, locationInfo) {
  if (!raw) return null;
  const electric = raw.electric || null;
  const state = locationInfo?.state || '';
  const rate = electric?.residentialRate ?? null;
  return {
    electric,
    evCharging:  raw.evCharging || null,
    rateContext: getElectricRateContext(rate, state),
    utilityType: electric ? getUtilityType(electric.utilityName) : null,
    outage:      getOutageContext(state),
    services:    getServiceInference(ruralMode),
    evCost:      getEvChargingCost(rate),
    locationInfo: locationInfo || null,
  };
}
```

Add `assembleUtilities` to `module.exports`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest tests/modules/utilities/logic.test.js -t assembleUtilities`
Expected: PASS

- [ ] **Step 5: Wire into `src/chapters.js`**

Add imports near the other module imports:

```js
const { getUtilitiesData } = require('./modules/utilities/data');
const { assembleUtilities } = require('./modules/utilities/logic');
const { buildUtilitiesHTML } = require('./modules/utilities/template');
```

Change the `getChapterData` signature to accept `ruralMode` and `cell`:

```js
async function getChapterData({ lat, lng, originLatLng, locationInfo, googleMapsClient, googleMapsApiKey, getDriveTime, highwayDriveMinutes, fips: prefetchedFips, ruralMode, cell }) {
```

Add `getUtilitiesData(...)` to the `Promise.allSettled` array and destructuring (append at the end so existing indices are unchanged):

```js
  const [demographics, propertyData, walkability, emergency, environment, safetyLocation, schools, growth, propIntel, gardenData, climateHistory, utilitiesRaw] =
    await Promise.allSettled([
      // ...existing entries unchanged...
      getClimateHistoryData(lat, lng, locationInfo, fips),
      getUtilitiesData(lat, lng, originLatLng, getDriveTime, cell),
    ]);
```

After `val()` is defined, derive utilities and add to the return object:

```js
  const utilities = assembleUtilities(val(utilitiesRaw), ruralMode || 'suburban', locationInfo);
```

```js
  return {
    // ...existing fields...
    utilities,
    locationInfo,
  };
```

Add to `buildChaptersHTML`, immediately after `buildPropertyDataHTML(chapters.propertyData)`:

```js
    buildPropertyDataHTML(chapters.propertyData),
    buildUtilitiesHTML(chapters.utilities),
```

Add `buildUtilitiesHTML` is used internally; no new export needed (only `getChapterData`/`buildChaptersHTML` are exported).

- [ ] **Step 6: Thread `ruralMode` and `cell` from `reportBuilder.js`**

In `src/services/reportBuilder.js`, the `getChapterData(...)` call (around line 145) passes `fips: prefetchedFips`. `ruralMode` (line ~52) and `cell` (line ~74) are already computed earlier in that function. Add both:

```js
    chapters = await getChapterData({
      lat: origin.lat,
      lng: origin.lng,
      originLatLng,
      locationInfo,
      googleMapsClient,
      googleMapsApiKey,
      getDriveTime,
      highwayDriveMinutes,
      fips: prefetchedFips,
      ruralMode,
      cell,
    });
```

- [ ] **Step 7: Run module + wiring + smoke tests**

Run: `npx jest tests/modules/utilities tests/smoke.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/chapters.js src/services/reportBuilder.js src/modules/utilities/logic.js tests/modules/utilities/logic.test.js
git commit -m "feat(FR-032): wire Utilities chapter into report (ruralMode threaded)"
```

---

### Task 10: Design token + color mapping

**Files:**
- Modify: `public/design-tokens.css`
- Modify: `public/report.css`

- [ ] **Step 1: Add the chapter color tokens**

In `public/design-tokens.css`, alongside the other `--ch-*` tokens (near line 37):

```css
  --ch-utilities:     #1a6b6b; --ch-utilities-light:#e3f0f0; --ch-utilities-text:#0f3d3d;
```

- [ ] **Step 2: Add the data-ch mapping**

In `public/report.css`, alongside the other `.chapter[data-ch="..."]` lines (near line 536):

```css
.chapter[data-ch="utilities"] { --ch: var(--ch-utilities); --ch-light: var(--ch-utilities-light); --ch-text: var(--ch-utilities-text); }
```

- [ ] **Step 3: Verify the no-inline-styles + no-scoring constraint suites still pass**

Run: `npx jest tests/constraints`
Expected: PASS (utilities module now scanned and clean)

- [ ] **Step 4: Commit**

```bash
git add public/design-tokens.css public/report.css
git commit -m "feat(FR-032): deep-teal chapter color for Utilities"
```

---

### Task 11: `.env.example`, full suite, visual check, summary

**Files:**
- Modify: `.env.example`
- Create: `feature-requests/FR-032-utilities-intelligence/summary.md`

- [ ] **Step 1: Document the new key**

Add to `.env.example`:

```
# NREL (developer.nrel.gov) — utility rates + EV charging stations (FR-032).
# Optional: falls back to DEMO_KEY (low rate limit). Free key: https://developer.nrel.gov/signup/
NREL_API_KEY=your_key_here
```

- [ ] **Step 2: Run the full test suite**

Run: `npx jest`
Expected: PASS — prior count (1232) + new utilities tests, zero failures.

- [ ] **Step 3: Visual + live-data check on all 5 addresses**

Use the `run` skill (launch server + screenshot) and generate a report for each of the five test addresses. Confirm for each:
- Utilities chapter renders after Property Costs, deep-teal identity.
- Georgetown KY → Kentucky Utilities; Bozeman MT → NorthWestern Energy (live NREL).
- Harlan KY (rural) shows well/septic inference; Georgetown/Louisville show municipal.
- Jeffersonville IN renders without error (CONSTRAINT-006 regression).
- L3 tabs (Electric / Reliability / EV Charging) switch; L4 links present; ISP cross-link visible.
- Missing-data path: temporarily unset `NREL_API_KEY` is unnecessary (DEMO_KEY works) — instead verify the electric fallback copy by mocking, already covered in template tests.

- [ ] **Step 4: Write `summary.md`**

Document: what shipped, the scope decisions (solid-core-first; deferred items), the new `NREL_API_KEY`, the data sources + research dates, any deviations, and the 5-address test results. Note FR-033 will consume this chapter's local electric rate.

- [ ] **Step 5: Update the roadmap**

In `docs/IMPLEMENTATION_ROADMAP.md`, mark FR-032 status (Phase 5) as shipped, leaving FR-033 as the remaining Phase 5 chapter.

- [ ] **Step 6: Commit + open PR**

```bash
git add .env.example feature-requests/FR-032-utilities-intelligence/summary.md docs/IMPLEMENTATION_ROADMAP.md
git commit -m "docs(FR-032): summary, roadmap, .env.example for Utilities chapter"
git push -u origin FR-032-utilities-intelligence
gh pr create --title "FR-032: Utilities & Power chapter" --body "<summary>"
```

---

## Self-Review

**Spec coverage:**
- Electric provider + type + rate vs state avg → Tasks 2, 3, 7, 8, 9 ✅
- State-level reliability → Tasks 4, 8 ✅
- Gas/water/sewer inference + verify → Tasks 5, 8 ✅
- EV charging nearest + cost-per-charge → Tasks 6, 7, 8 ✅
- ISP cross-link (not rebuilt) → Task 8 research section ✅
- Color #1a6b6b, placement after Costs → Tasks 8 (placement label), 9 (order), 10 (color) ✅
- Constants tables → Task 1 ✅
- **Cell-cached fetch (FR-058 parity) + centroid search → Task 7** (`utilitiesCache`, cache-hit + centroid tests); `cell` threaded in Task 9 ✅
- `NREL_API_KEY` + graceful degradation + resilience → Tasks 7, 11; fallbacks in Task 8 ✅
- Constraints (001 no-score, 008 no-inline-style, 009/014 layer purity, 011 tests, 015 fallbacks) → enforced by Task 8/10 tests + Task 9 ruralMode threading + `tests/constraints` ✅
- All 5 addresses incl. Jeffersonville → Task 11 ✅

**Placeholder scan:** No TODO/TBD in code steps. Constants carry real values + a dated "refresh from source" comment (a maintenance note, not a code placeholder). `<summary>` in the final `gh pr create` is the only intentional fill-in (PR body), written from `summary.md`.

**Type consistency:** `getElectricRateContext`→`{rate,stateAvg,delta,deltaLabel,color,narrative}`; `getUtilityType`→`{type,label,hedge}`; `getOutageContext`→`{saidiHours,saifiEvents,isNationalFallback,narrative}`; `getServiceInference`→`{water,sewer,gas,verify,verifyAction}`; `getEvChargingCost`→`{batteryKwh,fullChargeCost,homeNote}`; `getUtilitiesData`→`{electric,evCharging}`; `assembleUtilities`→ the `utilities` object the template consumes. Template reads exactly these names. Consistent across tasks. ✅
