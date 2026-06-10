# FR-060 — Resilient Utilities fallback (NREL → HIFLD / OpenChargeMap) — Summary

**Status:** ✅ Built, full suite green (1,371 tests / 73 suites), HIFLD live-verified across all 5 addresses. Branch `FR-060-resilient-utilities-fallback`, PR pending.

## What shipped

The Utilities chapter (FR-032) depended entirely on NREL for the electric provider/rate and EV charging. On an NREL failure the chapter showed *no data* — only a link fallback. FR-060 adds a **data fallback chain** behind the existing `utilities/data.js` fetchers so an NREL outage degrades to real provider/charger data, not silence:

```
Electric:  NREL  →  HIFLD Electric Retail Service Territories  →  OpenEI/PUC link
EV:        NREL  →  OpenChargeMap                              →  AFDC lookup link
```

NREL stays primary (it carries the unique per-address residential rate). The reachable fallbacks fill in real provider/charger data when NREL is down. Each result carries a `source` tag for provenance.

## The fallback chain

- **`getElectricFromNREL` / `getElectricFromHIFLD`** — NREL body refactored out and tagged `source: 'NREL'`. New keyless HIFLD ArcGIS point query returns `{ utilityName: titleCase(NAME), residentialRate: null, ownership: TYPE, source: 'HIFLD' }`, or `null` on non-ok / `data.error` / empty feature. `getElectricData` is now a thin orchestrator: NREL → HIFLD, short-circuiting (no HIFLD call when NREL succeeds).
- **`getEvFromNREL` / `getEvFromOpenChargeMap`** — NREL EV body refactored out (returns `null` when it finds no chargers so the fallback can trigger). New OpenChargeMap fetcher classifies each POI by `Connections[]` (L2 vs DC-fast), shapes to the **same** `{ name, address, driveTimeMinutes, distanceMiles }` the NREL path returns, and rides the injected `getDriveTime` + cell cache. `OPENCHARGEMAP_API_KEY` is **optional** — without it the fetcher returns `null` and the chapter degrades to the AFDC link (CONSTRAINT-015).

`getUtilitiesData` and the FR-058 cell cache are **unchanged** — the fetchers self-fall-back, and the cached `{ electric, evCharging }` now simply carry `source`.

## Logic + template

- `assembleUtilities` threads `electricSource`, `evSource`, and `stateAvgRate` (`STATE_AVG_ELECTRIC_RATE[state]`). `getUtilityType` already maps HIFLD's `INVESTOR OWNED` / `COOPERATIVE` / `MUNICIPAL` strings — no change. `rateContext` stays `null` when there's no per-address rate, which drives the new template state.
- **New electric template state — "provider known, rate unknown":** provider name + ownership type badge + a state-average context line (`Typical residential rate in <state> is about <n>¢/kWh; a provider-specific rate wasn't available for this address.`). No guessed per-address number.
- **Provenance notes:** `Provider via HIFLD Electric Retail Service Territories.` when `electricSource !== 'NREL'`; `Charger data via OpenChargeMap.` when `evSource === 'OpenChargeMap'`. The full-NREL path renders unchanged (no note). All existing classes, no inline styles (CONSTRAINT-008), no scoring (CONSTRAINT-001).

## Live verification — HIFLD reachable (closes FR-032's gap)

FR-032 shipped with its populated NREL provider data unverified (NREL was DNS-blocked from every build path). HIFLD is reachable, and `getElectricFromHIFLD` resolves the correct provider for all 5 test addresses:

| Address | Provider | Ownership |
|---|---|---|
| Georgetown KY | Kentucky Utilities Co | INVESTOR OWNED |
| Harlan KY | Kentucky Utilities Co | INVESTOR OWNED |
| Louisville KY | Louisville Gas & Electric Co | INVESTOR OWNED |
| Bozeman MT | Northwestern Energy Llc - (Mt) | INVESTOR OWNED |
| Jeffersonville IN | Duke Energy Indiana, Llc | INVESTOR OWNED |

All title-cased from the ArcGIS `NAME` field. This independently confirms the providers FR-032 expected. (OpenChargeMap live check skipped locally — `OPENCHARGEMAP_API_KEY` unset, which is the intended graceful-degradation path.)

## Rate-gap behavior

When the fallback fires, there is a real provider but no per-address rate. Rather than guess a number or show nothing, the chapter shows the **state-average** residential rate as context with an explicit caveat — honest, sourced, and actionable.

## Files

- `src/utils/constants.js` — `HIFLD_TERRITORIES_URL`
- `src/modules/utilities/data.js` — NREL/HIFLD + NREL/OCM fetchers and orchestrators
- `src/modules/utilities/logic.js` — `assembleUtilities` threads source + state-avg rate
- `src/modules/utilities/template.js` — three-state electric section/tab + provenance notes
- `tests/modules/utilities/{data,logic,template}.test.js` — fallback ordering, parser hardening, render states
- `tests/modules/utilities/fixtures/{hifld-territories,openchargemap-poi}.json`
- `.env.example` — `OPENCHARGEMAP_API_KEY` (optional)

## Dependencies / new keys

- **HIFLD Electric Retail Service Territories** (ArcGIS REST) — keyless, no new dependency.
- **`OPENCHARGEMAP_API_KEY`** — optional free key (openchargemap.org). EV fallback is best-effort; degrades to the AFDC link when unset.
- No new npm packages.
