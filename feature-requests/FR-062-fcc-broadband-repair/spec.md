# FR-062 — FCC Broadband Repair (official BDC API)

## Problem

The old keyless FCC map API (`broadbandmap.fcc.gov/api/public/map/listAvailability`) is **retired** — the entire `/api/public/map/*` surface returns HTTP 405 for GET and POST. Livably's Utilities Internet section (FR-061) therefore always degrades to its fallback (FCC link + satellite floor). We want to restore real internet availability data via the **official FCC Broadband Data Collection (BDC) Public Data API**.

## Key constraint that shapes the solution

The BDC public API is a **bulk data-download API** (auth: registered FCC username + 44-char token), **not** a per-address live lookup. Per-**location**, provider-named availability requires mapping an address to a **Fabric `location_id`**, and the Broadband Serviceable Location Fabric is **license-restricted (CostQuest)** — out of reach without a paid/legal license. Per-**geography** (census block) availability summaries are published **without** the Fabric but are **aggregate by technology + speed, not provider-named**.

**⚠️ Decision to confirm at spec review:** This spec takes the **block-level summary** path (no Fabric). Consequence: we recover the **band + available technologies + max advertised speed** for the address's census block — exactly what FR-061's felt band needs — but **lose the named provider list**. (Alternative: license the Fabric to keep named providers — higher cost/effort; flagged, not assumed.)

## Solution (block-level, no Fabric)

A periodic **ingestion** step (token used only here, offline) pulls the FCC BDC published **fixed-availability summary by census block** for the relevant states, transforms it into a compact **block-GEOID → availability** lookup artifact committed/stored in the repo. At report time, Livably resolves the address's census block (it already computes FIPS), looks up the block's availability, maps it into the existing FR-061 internet shape, and renders through the **unchanged** `getInternetContext` felt band. Runtime stays **keyless and fast** (no live FCC call). Graceful fallback (FR-061) covers any block with no record.

## Ingestion — `scripts/ingest-bdc-broadband.js` (offline, token-gated)

- Authenticates to `https://bdc.fcc.gov/` with `BDC_USERNAME` + `BDC_API_TOKEN` (env; documented in `.env.example`; **never committed**).
- Downloads the latest published **fixed broadband availability — summary by geography type = block** files (per state, current as-of date).
- Transforms each block row to the max advertised down/up and the set of technologies present, producing a lookup keyed by 15-digit block GEOID:
  `{ "<block_geoid>": { maxDown, maxUp, technologies: [<codes>], asOf } }`.
- Writes a compact artifact (e.g. `src/modules/utilities/data/bdc-broadband-<asOf>.json` or a per-state shard) + records the as-of date.
- Idempotent; re-runnable when the FCC publishes a new vintage (~biannual). The token is needed only to run this script, not to serve reports.

## Data layer — `src/modules/utilities/data.js`

- Replace the dead `getBroadbandData(lat, lng)` HTTP call with `getBroadbandFromBDC(blockGeoid)` that reads the ingested lookup and returns the **FR-061 contract**: `{ providers: [], maxDownloadMbps, hasFiber }` (provider list empty under the block-level path; `hasFiber` = technologies include fiber code 50; `maxDownloadMbps` = block max advertised down). Returns `null` when the block is absent.
- `getUtilitiesData` already threads `internet` and resolves an origin; pass the **block GEOID** (resolved upstream the same way the ACS FIPS is resolved) into the internet fetch. Keep FR-058 cell-cache behavior.
- Keep the function name/shape stable so `assembleUtilities` and the template are **unchanged**.

## Logic layer — `src/modules/utilities/logic.js`

- **No change.** `getInternetContext(broadband, ruralMode)` already derives the band from `maxDownloadMbps` + `hasFiber` and tolerates an empty `providers` array (`providerCount: 0` → "Provider details weren't itemized…"). The felt band, meaning, and satellite floor all keep working.

## Template layer — `src/modules/utilities/template.js`

- **No change required.** FR-061 already renders the no-provider case in both L1 and L3 (shared `NO_PROVIDERS_LINE`). Optionally, the L3 tab may render the available **technologies** (e.g. "Fiber, Cable available") in place of provider cards — small, additive, decided at build time.
- The disclaimer should read "Source: FCC Broadband Data Collection (block-level, as of <date>)."

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
- [ ] The Utilities Internet felt band renders from real BDC data for the 5 test addresses (band + max speed + fiber flag).
- [ ] Provider-name absence is handled cleanly (no empty/broken UI); disclaimer cites BDC block-level + as-of date.
- [ ] Absent block → FR-061 graceful fallback (FCC link + satellite floor).
- [ ] No secrets committed; `.env.example` documents the ingestion-only token.
- [ ] No scoring, no inline styles; full suite green.

## Out of Scope (YAGNI)

- Licensing the CostQuest **Fabric** for provider-named, per-location data (separate cost/legal decision; revisit only if named providers become a requirement).
- A live per-request FCC call (the public API does not offer one).
- Mobile broadband / cellular signal.

## Risks / Open decisions (confirm at review)

1. **Provider names dropped** under the block-level path — acceptable for the felt band? (Recommendation: yes.)
2. **Artifact storage & cadence** — committed JSON shard(s) vs. generated build artifact; refresh each BDC vintage (~biannual).
3. **Geography grain** — census **block** (precise, larger data) vs. block group/county (smaller, coarser). Recommendation: block.
4. **Data size** — block-level for all 5 test states is large; may shard per state or restrict to states Livably serves. Decide at planning.
