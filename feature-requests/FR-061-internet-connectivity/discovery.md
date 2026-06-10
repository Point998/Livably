# FR-061 — Internet as a Utility — Phase 1 Discovery

*Read-only findings. No code changes in this phase.*

## Intent (from brainstorming)

Internet has become an essential service — buyers treat an internet outage the same as losing water, power, or HVAC. It belongs in the **Utilities & Power** chapter, not tucked into Property next to soil and permits. The treatment should be the **bracketed / "felt"** style used elsewhere (e.g. FR-058 drive-time bands): **who** serves the address (providers), a **typical speed range** as a qualitative band, and **what it means** for common needs — *not* a precise guarantee ("1000 Mbps reliably"). It's a lightweight tidbit, not a headline finding: in 2026, between wired options and satellite, ~150–300 Mbps is reachable almost anywhere, so "who and what" is sufficient. A quiet satellite floor reassures on the rural end.

## What already exists

- **Internet/broadband already ships — in the Property chapter, not Utilities.** `src/modules/property/data.js#getBroadbandData(lat,lng)` calls the **FCC National Broadband Map** (`broadbandmap.fcc.gov/api/public/map/listAvailability`) and returns `{ providers:[{name,tech,download,upload}], maxDownloadMbps, hasFiber, category }`. Provider tech is decoded via `BROADBAND_TECH_CODES` (constants.js:519).
- **Logic:** `property/logic.js#getBroadbandCategory(maxMbps, hasFiber)` → `{ label, color, desc }` qualitative band (already the "felt" pattern — label + color, no numeric score).
- **Template (Property):** `buildBroadbandTab` (L3 "Internet Providers" tab), an L4 all-providers table, a broadband paragraph in the full section, "broadband" in the chapter subtitle (`"Soil, broadband, permits…"`), sources list, and glance.
- **Utilities** currently **cross-links** to Property for internet (`utilities/template.js#buildResearch`, the closing `<p>`), and FR-032 deliberately chose not to rebuild ISP data.
- The Property broadband tab's own disclaimer already says *"Advertised speeds; actual speeds may vary."* — confirming the felt/banded framing is the honest one.

## Utilities chapter shape (target)

- `data.js#getUtilitiesData` — cell-cached (FR-058) orchestrator; `Promise.allSettled([getElectricData, getEvChargingData])`. Internet fetch slots in here, inheriting the same 30-day cell cache.
- `logic.js#assembleUtilities(raw, ruralMode, locationInfo)` — builds the view model (electric, evCharging, rateContext, outage, services, evCost, sources, stateAvgRate, locationInfo).
- `template.js` — L1 body sections (electric / reliability / services + key takeaway), L3 deep-dive tabs (Electric / Reliability / EV Charging), L4 research links, glance.

## What's missing / what could break

- No internet field on the Utilities view model; no Internet tab; no felt-band internet logic in `utilities/logic.js`.
- Moving the fetch from per-address (Property) to cell-cached (Utilities) means broadband becomes cell-shared. **Acceptable** — FCC availability is census-block level, so addresses in one cell share providers; this matches how electric already behaves.
- Property removals must be clean (tab, table, paragraph, subtitle word, sources, glance) without leaving dangling references or breaking Property tests.
- `getBroadbandData`/`getBroadbandCategory` are imported in `property/data.js` and exported from `property/{data,logic}.js` — move all references, update tests on both sides.

## Constraints in play

- **CONSTRAINT-001 (no scoring):** the band is a qualitative label + color, like electric-rate context — not a numeric grade. Stays clean.
- **CONSTRAINT-004 (no brand names in search/filter):** the FCC fetch has no brand names in its query; provider names are inbound *content*. Satellite-floor copy stays **generic** ("satellite internet"), not a named brand.
- **CONSTRAINT-008/009 (layer separation, no inline styles):** fetch in data, band in logic, HTML in template; semantic classes only.
- **CONSTRAINT-011 (tests):** logic test per band + satellite trigger; all 5 addresses.
- **CONSTRAINT-015 (graceful degradation):** no FCC data → FCC-map link + satellite reassurance, never silence.
