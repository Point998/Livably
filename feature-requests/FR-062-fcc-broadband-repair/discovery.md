# FR-062 — FCC Broadband Repair — Phase 1 Discovery

*Read-only findings. No code changes in this phase.*

## Why this FR exists

FR-061 relocated the FCC broadband fetcher into Utilities and ran a live 5-address verify. All five returned the graceful fallback. Root-cause investigation (below) shows the **old keyless FCC map API is retired** — not a transient outage and not introduced by FR-061 (the fetcher was a verbatim relocation of Property's pre-existing code, which was already silently degrading).

## Root cause — the old API is gone

The fetcher called:
```
GET https://broadbandmap.fcc.gov/api/public/map/listAvailability?latitude=&longitude=&unit=location&limit=25&category=residential
```
Live probes (June 2026):

| Request | Result |
|---|---|
| `GET …/api/public/map/listAvailability` | **405** `{"message":"Method Not Available","status_code":405}` |
| `POST …/api/public/map/listAvailability` | **405** (same) |
| `GET …/api/public/map/processes` | **405** (same) |
| `GET …/nbm/map/api/location/coordinates` | **403 Forbidden** (nginx) |

The whole `/api/public/map/*` surface returns 405 for GET **and** POST — the public keyless map API has been retired, not merely changed method. The newer `nbm` front-end path is gated (403). There is no drop-in keyless lat/lng replacement on `broadbandmap.fcc.gov`.

## Replacement options investigated

1. **Official FCC Broadband Data Collection (BDC) Public Data API** — base URL `https://bdc.fcc.gov/`. Auth: a registered **FCC username + 44-character API token** (hash value). It is a **bulk data-download API**: it lists and serves published availability data files by **state and provider**, plus Fabric/challenge files, each with an as-of date (ISO-8601). **There is no per-address or per-lat/lng live lookup** in the public token API — the map website's per-location "Location Summary" uses internal, gated endpoints that are not part of the public API.
2. **broadbandmap.com (third-party)** — clean `GET /api/v1/location/internet?lat=&lng=` returning provider · technology · max down/up (near-perfect match for our existing contract). Requires a Bearer API key (free demo tier). Not chosen (third-party longevity risk).
3. **Accept the graceful fallback** — do nothing; internet is now a low-stakes "felt" tidbit. Not chosen.

**Direction chosen (by Nathan): Option 1 — official FCC BDC API.**

## The official-API reality (drives the spec)

Because the BDC public API is **bulk download, not live lookup**, the per-address resolution path matters:

- **Location-level availability files** (provider-named, per Broadband Serviceable Location) require mapping an address → a **Fabric `location_id`**. The Broadband Serviceable Location **Fabric is license-restricted** (CostQuest) — not freely available. So a *provider-named, per-location* lookup is effectively blocked without a Fabric license.
- **Geography-summary availability** (by **census block** / county / state) is published **without** needing the Fabric. These summarize, per geography, which **technologies and speed tiers** are available — but are **aggregate, not provider-named**.
- Livably **already resolves a census block/tract (FIPS)** for every address (used by the Census ACS calls in `property/data.js` and elsewhere), so a block-level lookup is architecturally cheap to wire in.

**Implication for the felt treatment:** the feasible official-API implementation (block-level summaries, no Fabric) yields the **band + technologies + max advertised speed** for the address's block — which is exactly what FR-061's "felt" band needs — but **not the named provider list**. FR-061's template shows provider names; under this path that list would be dropped (or sourced separately). This is the key tradeoff to confirm at spec review.

## Architectural fit

- The token is needed only at **ingestion time**, not per report — so runtime stays keyless and fast. Ingestion is a periodic (BDC publishes ~biannually) bulk pull + transform into a lookup keyed by block GEOID, cached/stored locally.
- This mirrors Livably's existing patterns: bulk-ish reference data resolved per-address via FIPS, then surfaced through the cell cache (FR-058) and the existing `getInternetContext` felt band (FR-061) unchanged.
- Graceful degradation (CONSTRAINT-015) already exists from FR-061 (FCC link + satellite floor), so any ingestion gap degrades safely.

## Open questions for the spec / Nathan

1. **Provider names:** accept the block-level path (band + tech + speed, **no provider list**), or pursue the Fabric license to keep named providers? (Recommendation: accept block-level; the felt band is the point, provider names are secondary and FR-061 already de-emphasized precise specifics.)
2. **Ingestion cadence & storage:** where the transformed block→availability table lives (committed data file vs. generated artifact vs. a small build step), and how often it refreshes.
3. **Geography grain:** census **block** (most precise, large dataset) vs. **block group/county** (smaller, coarser). Block aligns best with "this address."

## Constraints in play

- CONSTRAINT-009 (layers): ingestion/lookup in data layer; the FR-061 `getInternetContext` band logic is reused unchanged.
- CONSTRAINT-011 (tests + 5 addresses): fixtures for the BDC file parser + the block lookup; verify the 5 test addresses resolve a band.
- CONSTRAINT-015: graceful fallback already in place from FR-061.
- "Fit data into existing chapters": this strengthens the existing Utilities Internet section — no new chapter, no template change beyond possibly dropping the provider-list when unavailable.
