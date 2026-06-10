# FR-060 — Resilient Utilities fallback · Phase 1 Discovery

*Read-only findings. No code changed in this phase.*

## Why
FR-032's Utilities chapter depends on NREL (`developer.nrel.gov`) for the electric provider+rate and EV charging. NREL is **unverifiable from every path we have** (Nathan's devices filter the DNS name across networks; the build sandbox ENOTFOUNDs it; Anthropic WebFetch resolves but NREL refuses the datacenter IP). When NREL fails, the chapter currently degrades to a **link fallback** (OpenEI/AFDC/PUC links) — graceful, but shows *no data*. This adds a **data fallback** so an NREL failure degrades to real provider/charging data from reachable sources, and (bonus) gives us the verification NREL couldn't.

## Spikes — both alternatives confirmed live
**HIFLD "Electric Retail Service Territories"** (ArcGIS REST, point-query → utility name + ownership type):
`https://services3.arcgis.com/OYP7N6mAJJCyH6hd/arcgis/rest/services/Electric_Retail_Service_Territories_HIFLD/FeatureServer/0`
Live 5-address query (fast, `services*.arcgis.com` — same ArcGIS-REST pattern the project already uses for FEMA/USGS/BTS):
| Address | HIFLD NAME (TYPE) |
|---|---|
| Georgetown KY | KENTUCKY UTILITIES CO (INVESTOR OWNED) |
| Harlan KY | KENTUCKY UTILITIES CO (INVESTOR OWNED) |
| Louisville KY | LOUISVILLE GAS & ELECTRIC CO (INVESTOR OWNED) |
| Bozeman MT | NORTHWESTERN ENERGY LLC - (MT) (INVESTOR OWNED) |
| Jeffersonville IN | DUKE ENERGY INDIANA, LLC (INVESTOR OWNED) |

**This retroactively verifies FR-032's two acceptance criteria** (Georgetown→Kentucky Utilities, Bozeman→NorthWestern Energy) that NREL never could. HIFLD `TYPE` values ("INVESTOR OWNED" / "COOPERATIVE" / "MUNICIPAL" / …) map directly through the existing `getUtilityType(name, ownership)`.

**OpenChargeMap** (`api.openchargemap.io/v3/poi`): reachable (returned `403` = needs a free key, not blocked). Clean point/radius query with `Connections[].Level` (L2 / DC-fast).

## Current data layer (`src/modules/utilities/data.js`, on `main`)
- `getElectricData(lat,lng)` → NREL utility_rates → `{ utilityName, residentialRate, ownership } | null`. Returns `null` on non-ok / throw / missing rate.
- `getEvChargingData(lat,lng,driveOrigin,getDriveTime,cell)` → NREL alt-fuel-stations → `{ level2, dcFast } | null`.
- `getUtilitiesData(...)` → cell-cached; fans out both via `Promise.allSettled`; caches `{ electric, evCharging }` (skips a both-null total miss).
- Logic `assembleUtilities` → `{ electric, evCharging, rateContext, utilityType, outage, services, evCost, locationInfo }`; template gates the electric section on `electric && rateContext`.

## The one real wrinkle
HIFLD gives **provider + ownership but no rate**. The current electric section renders fully only when it has *both* provider and rate; otherwise it shows the link fallback. So the HIFLD fallback data wouldn't surface without a new **"provider known, per-address rate unknown"** render state (provider + type + the **state-average** rate we already bundle in `STATE_AVG_ELECTRIC_RATE`, clearly labeled "provider-specific rate unavailable").

## Constraints in play
- CONSTRAINT-001 (no scoring), 008/009 (layer purity), 015 (graceful degradation — the chain becomes NREL → HIFLD/OCM → links).
- Cost (FR-058): fallback results ride the existing cell cache; HIFLD/OCM queried from the cell centroid.
- CONSTRAINT-016 lesson: harden the new parsers with response fixtures (HIFLD + OCM) — both are reachable, so also live-verifiable.

## Decisions taken in brainstorming
- **NREL primary → reachable-source fallback → link fallback** (keeps NREL's per-address rate when it's up; HIFLD/OCM only on NREL failure).
- New optional `OPENCHARGEMAP_API_KEY` (EV fallback best-effort; degrades to links without it).
- On the HIFLD fallback, show provider + type + state-average context with a "provider-specific rate unavailable" note — never guess a per-address number.
- Provenance: each result carries `source` ('NREL' | 'HIFLD' | 'OpenChargeMap'); the template shows a subtle "via …" note on a fallback source.
