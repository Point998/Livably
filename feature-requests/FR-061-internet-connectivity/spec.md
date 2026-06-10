# FR-061 — Internet as a Utility (relocate + "felt" reframe)

## Problem

Internet is an essential service — buyers treat losing it like losing power or water — but Livably files it under **Property** (next to soil and permits), and the **Utilities** chapter only cross-links to it. The current presentation also leans on advertised Mbps numbers, which read as precise guarantees they aren't (FCC data is advertised, census-block level). This FR moves internet into Utilities where it conceptually belongs and reframes it as a lightweight **"felt" band** — who serves the address, a typical speed range, and what it means — with a quiet satellite floor for the rural end.

## Solution

**Relocate** the existing FCC National Broadband Map integration from Property into Utilities (no new data source), and **reframe** its presentation from advertised-Mbps cards into the bracketed/"felt" treatment used elsewhere in the report. Property loses its internet tab; Utilities gains an Internet section + tab. The raw FCC fetch is unchanged — only its home and its framing change.

## Data Layer — `src/modules/utilities/data.js`

- **Move** `getBroadbandData(lat, lng)` verbatim from `property/data.js` (FCC `listAvailability` query, 12s timeout, dedup, top-5 by download). Drop the `category` field from its return (categorization moves to logic as the felt band): returns `{ providers:[{name,tech,download,upload}], maxDownloadMbps, hasFiber }` or `null`.
- Call it inside `getUtilitiesData`'s existing `Promise.allSettled`, so it rides the **FR-058 cell cache** (30-day TTL, cell-shared). The cached result object gains an `internet` key: `{ electric, evCharging, internet }`.
- The "don't cache a total miss" guard extends: cache when any of electric / evCharging / internet is non-null.
- Export `getBroadbandData` from `utilities/data.js`.

## Logic Layer — `src/modules/utilities/logic.js`

New `getInternetContext(broadband, ruralMode)` → the felt read, or `null` when `broadband` is null:

- **Band** (qualitative label + color, mirroring `getElectricRateContext` — NOT a numeric score, CONSTRAINT-001):
  | Condition | `band.label` | `band.color` |
  |---|---|---|
  | `hasFiber` or `maxDownloadMbps >= 940` | `Gigabit-class (fiber)` | `green` |
  | `maxDownloadMbps >= 200` | `Fast wired broadband` | `lightgreen` |
  | `maxDownloadMbps >= 25` | `Standard broadband` | `gold` |
  | `maxDownloadMbps > 0` | `Limited wired options` | `orange` |
  | else (no wired speed) | `Wired coverage unconfirmed` | `muted` |
- **`meaning`** — one plain-language line per band (what it supports: remote work, simultaneous 4K, video calls, a houseful of streaming). No precise throughput promises.
- **`satelliteFloor`** (bool) — `true` when band is `Limited wired options` / `Wired coverage unconfirmed`, OR `ruralMode` is `rural`/`remote`. Drives a generic satellite-internet reassurance line in the template (≈100–300 Mbps reachable almost anywhere). **Generic copy — no brand name** (CONSTRAINT-004 spirit).
- Output: `{ providers, providerCount, band: { label, color }, meaning, satelliteFloor }`.

`assembleUtilities(raw, ruralMode, locationInfo)` gains `internet: getInternetContext(raw.internet, ruralMode)`. (`ruralMode` is already a parameter.)

`getBroadbandCategory` is **removed** from `property/logic.js` (superseded by `getInternetContext`); update Property's exports/imports.

## Template Layer — `src/modules/utilities/template.js`

- **L1 body — new `buildInternetSection(u)`** (after services): when `u.internet` is present, `<n> providers serve this address` + band label badge + the `meaning` line + satellite line when `satelliteFloor`. When `u.internet` is null, render the fallback line (see below) — never an empty section. Slots into `buildBody` after `buildServicesSection`.
- **L3 — new `buildInternetTab(u)`** added as the 4th tab in `buildDeepDive` (`{ id:'internet', label:'Internet' }`): provider list (name + technology) styled with the existing `prem-intel-bb-*` provider classes, the band, the `meaning` line, the satellite line when relevant, and `<p class="prem-disclaimer">Source: FCC National Broadband Map. Advertised availability, not measured speeds.</p>`.
- **Fallback (CONSTRAINT-015)** — when `u.internet` is null: a line stating FCC returned no providers for this address + a link to `https://broadbandmap.fcc.gov/` to check directly + the generic satellite-floor reassurance. Used in both the L1 section and the L3 tab.
- **L4 research — `buildResearch`**: replace the closing Property cross-link `<p>` with FCC-map + provider-search links in the `climate-research-links` list.
- **Optional glance:** add a fiber/band chip to `buildGlance` only if it reads cleanly; otherwise leave glance unchanged. (Non-blocking.)

## Template Layer — `src/modules/property/template.js` (clean removal)

- Remove `buildBroadbandTab` and the `internet` tab entry from the Property deep-dive tab list.
- Remove the L4 broadband providers table and the broadband paragraph + cards from the full section.
- Subtitle: `"Soil, broadband, permits, and the details that listings don't show."` → `"Soil, permits, and the details that listings don't show."`
- Remove broadband from the Property sources list and glance.
- Remove now-unused `broadband` destructuring/imports in `property/template.js`.

## Property data — `src/modules/property/data.js`

- Remove `getBroadbandData` (moved) and its call in `getPropertyData`'s `Promise.allSettled`; the returned object drops `broadband`. Remove `getBroadbandCategory` import.

## Constants

- `BROADBAND_TECH_CODES` (constants.js:519) stays — now consumed by `utilities/data.js`. No new constants.

## Constraints

- **CONSTRAINT-001:** band is label+color, no score/grade.
- **CONSTRAINT-004:** FCC query has no brand names; provider names are inbound content; satellite copy is generic.
- **CONSTRAINT-008/009:** fetch in data, band in logic, HTML in template; semantic classes only, zero inline styles.
- **CONSTRAINT-011:** tests below; all 5 addresses.
- **CONSTRAINT-015:** no-FCC-data path gives a named URL + satellite reassurance, never silence.
- **FR-058:** internet rides the existing cell cache; queried from the cell centroid.

## Tests

- `utilities/logic.test.js`: one case per band threshold (gigabit/fiber, ≥200, ≥25, >0, none), `satelliteFloor` true on limited/unconfirmed and on rural/remote mode, `null` in → `null` out, `providerCount` correct.
- `utilities/data.test.js`: `getBroadbandData` parses FCC fixture (reuse/relocate Property's existing broadband fixture); `getUtilitiesData` threads `internet` and cell-caches it; total-miss guard still holds.
- `utilities/template.test.js`: Internet section + tab render providers/band/meaning; satellite line appears when flagged; fallback path (null internet) shows the FCC link, not silence; no inline styles; no scoring tokens.
- `property/*.test.js`: update for the removal — no broadband tab/table/paragraph; Property still renders; no dangling `broadband` references.
- Full suite green; constraint guards (`no-scoring`, `no-inline-styles`) green.

## Acceptance Criteria

- [ ] FCC fetch lives in `utilities/data.js`; Property no longer fetches or renders broadband.
- [ ] Utilities shows an Internet section (L1) + Internet tab (L3) with providers, a felt band, and a "what it means" line — no precise-throughput guarantee.
- [ ] Satellite floor reassurance appears on limited/unconfirmed wired coverage and in rural/remote mode; copy is generic (no brand name).
- [ ] No-FCC-data path renders the FCC-map link + satellite reassurance (no empty/silent section).
- [ ] Internet rides the FR-058 cell cache (no per-address FCC call when the cell is warm).
- [ ] Property chapter renders cleanly post-removal; subtitle/sources/glance updated.
- [ ] No scoring, no inline styles; all 5 test addresses pass; full suite green.

## Out of Scope (YAGNI)

- No measured-speed sources (M-Lab / Ookla) — advertised FCC data, reframed, is sufficient for a lightweight tidbit.
- No pricing, ACP/low-income program lookups, or per-provider plan detail.
- No new external dependency or API key.
