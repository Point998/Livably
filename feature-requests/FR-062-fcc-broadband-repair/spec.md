# FR-062 — FCC Broadband Repair (official BDC API)

## Problem

The old keyless FCC map API (`broadbandmap.fcc.gov/api/public/map/listAvailability`) is **retired** — the entire `/api/public/map/*` surface returns HTTP 405 for GET and POST. Livably's Utilities Internet section (FR-061) therefore always degrades to its fallback (FCC link + satellite floor). We want to restore real internet availability data via the **official FCC Broadband Data Collection (BDC) Public Data API**.

## Key constraint that shapes the solution

The BDC public API is a **bulk data-download API** (base `https://bdc.fcc.gov/api/public/map/`; auth: registered FCC `username` + 44-char token sent as `username` / `hash_value` headers; list endpoint `downloads/listAvailabilityData/<as-of-date>`), **not** a per-address live lookup.

**Key correction (vs. early discovery):** the published fixed-availability download files are **location-level but carry a `block_geoid` column AND a `brand_name` column** (full schema incl. `frn, provider_id, brand_name, location_id, technology, max_advertised_download_speed, max_advertised_upload_speed, low_latency, business_residential_code, state_usps, block_geoid`). Therefore **aggregating these files by `block_geoid` recovers the provider list, technologies, AND max speeds — without the license-restricted CostQuest Fabric.** The Fabric is only needed to resolve an *exact parcel's* `location_id`; for "what's available in this address's census block," block aggregation suffices and keeps named providers.

**Consequences of the block-aggregation path:**
- ✅ Full FR-061 fidelity retained: providers + band + max speed. **No template/logic change** (FR-061 already renders all of this).
- ⚠️ Precision is **block-level, not parcel-level** — we report what's available *somewhere in the block*, not guaranteed at the exact address. Acceptable for the "felt" framing; the disclaimer states it.
- ⚠️ The real cost is **data volume**: location-level files are large (millions of rows per state). Aggregation happens at **ingest time** (offline), producing a compact block→availability artifact; runtime reads only the artifact.

**⚠️ External preconditions (cannot be satisfied in-repo):** building/running the ingestion needs (1) an FCC BDC account + token, (2) `bdc.fcc.gov` reachable from the build environment, (3) the exact file-download endpoint + CSV schema confirmed against the gated swagger. The token-independent parts (runtime lookup, transform, wiring, tests against a fixture) are buildable now; the live ingestion + real artifact + 5-address live verify are gated on (1)–(3).

## Solution (block-level, no Fabric)

A periodic **ingestion** step (token used only here, offline) pulls the FCC BDC published **fixed-availability summary by census block** for the relevant states, transforms it into a compact **block-GEOID → availability** lookup artifact committed/stored in the repo. At report time, Livably resolves the address's census block (it already computes FIPS), looks up the block's availability, maps it into the existing FR-061 internet shape, and renders through the **unchanged** `getInternetContext` felt band. Runtime stays **keyless and fast** (no live FCC call). Graceful fallback (FR-061) covers any block with no record.

## Ingestion — `scripts/ingest-bdc-broadband.js` (offline, token-gated)

- Authenticates to `https://bdc.fcc.gov/` with `BDC_USERNAME` + `BDC_API_TOKEN` (env; documented in `.env.example`; **never committed**).
- Downloads the latest published **fixed broadband availability — summary by geography type = block** files (per state, current as-of date).
- Aggregates rows by 15-digit `block_geoid`: collects the distinct `brand_name`s (with each provider's best technology + max down/up), the set of technologies present, and the block max advertised down/up. Produces a lookup keyed by block GEOID:
  `{ "<block_geoid>": { providers: [{ name, tech, download, upload }], maxDown, maxUp, hasFiber, asOf } }`.
- Writes a compact artifact (e.g. `src/modules/utilities/data/bdc-broadband-<asOf>.json` or a per-state shard) + records the as-of date.
- Idempotent; re-runnable when the FCC publishes a new vintage (~biannual). The token is needed only to run this script, not to serve reports.

## Data layer — `src/modules/utilities/data.js`

- Replace the dead `getBroadbandData(lat, lng)` HTTP call with `getBroadbandFromBDC(blockGeoid)` that reads the ingested lookup and returns the **FR-061 contract**: `{ providers: [{ name, tech, download, upload }], maxDownloadMbps, hasFiber }` (providers from block aggregation; `hasFiber` = technologies include fiber code 50; `maxDownloadMbps` = block max advertised down). Returns `null` when the block is absent.
- `getUtilitiesData` already threads `internet` and resolves an origin; pass the **block GEOID** (resolved upstream the same way the ACS FIPS is resolved) into the internet fetch. Keep FR-058 cell-cache behavior.
- Keep the function name/shape stable so `assembleUtilities` and the template are **unchanged**.

## Logic layer — `src/modules/utilities/logic.js`

- **No change.** `getInternetContext(broadband, ruralMode)` already derives the band from `maxDownloadMbps` + `hasFiber` and tolerates an empty `providers` array (`providerCount: 0` → "Provider details weren't itemized…"). The felt band, meaning, and satellite floor all keep working.

## Template layer — `src/modules/utilities/template.js`

- **No change required.** FR-061 already renders providers (cards) + band + meaning, and the no-provider fallback. Block-aggregated providers flow straight through.
- The L3 disclaimer should read "Source: FCC Broadband Data Collection, availability by census block (as of <date>). Reflects the block, not the exact parcel."

## Config — `.env.example`

- Add `BDC_USERNAME` and `BDC_API_TOKEN` with a comment that they are **ingestion-only** (not needed to serve reports) and how to get them (register at the FCC BDC system, generate a 44-char token).

## Constraints

- CONSTRAINT-009: ingestion + lookup in the data layer; FR-061 logic/template reused unchanged.
- CONSTRAINT-011: fixtures for the BDC parser + block lookup; verify the 5 test addresses resolve a band from a sample ingested artifact.
- CONSTRAINT-015: graceful fallback already in place (FR-061) for absent blocks.
- "Fit into existing chapters": strengthens the existing Utilities Internet section; no new chapter; minimal/zero template change.
- Secrets: token in `.env` only; ingested artifact contains only public availability data.

## Tests

- `getBroadbandFromBDC(blockGeoid)`: parses a sample lookup fixture → correct `{ providers:[], maxDownloadMbps, hasFiber }`; `null` for an unknown block; fiber detection from technology codes.
- Ingestion transform: a unit test over a tiny sample BDC CSV/row → expected lookup entry (maxDown/maxUp/technologies/asOf). (Pure transform function, no network.)
- `getUtilitiesData`: threads `internet` from the block lookup; cell-cache unchanged.
- End-to-end: the 5 test addresses → block GEOID → a non-null band (using a committed sample artifact covering those blocks); plus an absent-block → fallback.
- Full suite green; FR-061 utilities tests still pass unchanged.

## Acceptance Criteria

- [ ] An offline, token-gated ingestion script produces a committed block-GEOID → availability artifact with an as-of date.
- [ ] Runtime resolves an address's census block → availability with **no live FCC call and no runtime token**.
- [ ] The Utilities Internet felt band renders from real BDC data for the 5 test addresses (providers + band + max speed + fiber flag).
- [ ] Disclaimer cites BDC availability-by-block + as-of date + the block-not-parcel caveat.
- [ ] Absent block → FR-061 graceful fallback (FCC link + satellite floor).
- [ ] No secrets committed; `.env.example` documents the ingestion-only token.
- [ ] No scoring, no inline styles; full suite green.

## Out of Scope (YAGNI)

- Licensing the CostQuest **Fabric** for provider-named, per-location data (separate cost/legal decision; revisit only if named providers become a requirement).
- A live per-request FCC call (the public API does not offer one).
- Mobile broadband / cellular signal.

## Risks / Open decisions (confirm at review)

1. **Block-level precision** (not parcel-level) — acceptable for the felt band, with the disclaimer? (Recommendation: yes. Provider names ARE retained — see Key correction.)
2. **Data volume / artifact storage & cadence** — location-level source files are large (millions of rows/state); aggregate at ingest into a compact block→availability artifact. Committed JSON shard(s) per state vs. a generated build artifact; refresh each BDC vintage (~biannual). Likely **restrict to states Livably serves** (KY/IN/MT for the test set) to bound size.
3. **Block GEOID resolution** — confirm Livably can resolve a 15-digit census **block** GEOID per address (it already resolves tract-level FIPS for ACS; block may need a Census geocoder field). Decide the resolver at planning.
4. **External preconditions** — FCC BDC token, `bdc.fcc.gov` reachability, and the exact download endpoint/CSV schema (gated swagger) must be confirmed before the ingestion task can be made fully concrete and executed.
