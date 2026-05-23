# FR-031 Implementation Plan: What Will Grow Here

## API Discovery Results

| Source | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| phzmapi.org hardiness zone | `/{zip}.json` | ✅ Works | ZIP-keyed, not lat/lng |
| iNaturalist native plants | `/v1/observations/species_counts?native=true&taxon_id=47126` | ✅ Works | Requires quality filtering |
| iNaturalist invasive plants | `...&introduced=true&taxon_id=47126` | ✅ Works | Requires benign exclusions |
| iNaturalist mammals | `...&taxon_id=40151` | ✅ Works | Excellent regional variation |
| iNaturalist birds | `...&taxon_id=3` | ✅ Works | Excellent backyard results |
| ACIS frost dates | StnMeta + StnData | ❌ Unreliable | Returns empty results, complex parsing |
| Open-Meteo climate | `/v1/climate` daily mins | ❌ Too expensive | 7,671 records per request, real-time compute |

**Frost date decision:** Zone-based lookup table. The hardiness zone from phzmapi.org IS coordinate-specific (not state-average), so frost dates derived from it are location-specific to the property. More reliable than ACIS for this use case.

## Soil data decision
Soil already fetched in `getPropertyIntelligence()` → `propIntel.soil`. Pass it through to `buildWhatWillGrowHTML` rather than re-fetching.

## Implementation Tasks (ordered)

### 1. Add constants to premium.js
- `FROST_DATE_TABLE` — zone string → `{ lastSpring, firstFall, days }`
- `NATIVE_PLANT_EXCLUDE_GENERA` — genera to filter from native plant results (ragweed, horsenettle, poison ivy, hemlock, etc.)
- `INVASIVE_PLANT_EXCLUDE_SPECIES` — benign introduced plants to exclude (white clover, chicory, ground ivy, etc.)
- `STATE_EXTENSION_SERVICE` — state abbreviation → `{ name, url }` for 50 states

### 2. Add `getGardenData(lat, lng, locationInfo)` async function
Fetches in parallel via `Promise.allSettled`:
- `getHardinessZone(zip)` — phzmapi.org
- `iNatSpeciesCounts(lat, lng, 16, 47126, { native: true }, 25)` — native plants
- `iNatSpeciesCounts(lat, lng, 32, 47126, { introduced: true }, 20)` — invasive plants
- `iNatSpeciesCounts(lat, lng, 16, 40151, {}, 15)` — mammals
- `iNatSpeciesCounts(lat, lng, 16, 3, {}, 20)` — birds

Returns: `{ hardinessZone, frostDates, nativePlants, invasivePlants, wildlife, birds }`

### 3. Add `buildWhatWillGrowHTML(gardenData, soil, locationInfo)` HTML builder
Sections:
1. **Growing Conditions** — zone badge, frost dates, season length
2. **Your Soil** — from propIntel.soil (muname + drainage), skip if no data
3. **What Grows Naturally Here** — top 6 native plants (filtered), with scientific names
4. **What to Avoid** — top 5 invasive plants (filtered), with why they're a problem
5. **Wildlife You'll Share the Yard With** — top mammals + top birds
6. **The Opportunity** — synthesis para + county extension CTA

Returns early with minimal output if `gardenData` is null.

### 4. Wire into `getPremiumData()`
Add `getGardenData(lat, lng, locationInfo)` to the `Promise.allSettled` array.
Add `gardenData: val(gardenDataRes)` to the returned object.

### 5. Wire into `buildPremiumSectionsHTML()`
Insert `buildWhatWillGrowHTML(premium.gardenData, premium.propIntel?.soil, premium.locationInfo)` after `buildClimateChapterHTML(...)`.

## Filtering Logic

### Native plants — exclude these genera (weedy/toxic/undesirable)
`Ambrosia`, `Conium`, `Toxicodendron`, `Solanum` (carolinense), `Urtica`, `Arctium`, `Ranunculus` (avoid confusion)

Also exclude by common name keywords: `ragweed`, `hemlock`, `poison`, `horsenettle`, `stinging nettle`

### Invasive plants — exclude these benign introduced species
`Trifolium repens` (white clover), `Cichorium intybus` (chicory), `Glechoma hederacea` (ground ivy), `Lamium purpureum` (red deadnettle), `Veronica persica` (field speedwell), `Medicago lupulina` (black medic), `Stellaria media` (chickweed)

### Wildlife — exclude domestic/feral animals
`Felis catus` (domestic cat), `Canis lupus familiaris` (domestic dog)

## Extension Office Lookup
State-keyed object: `{ 'KY': { name: 'UK Cooperative Extension Service', url: 'extension.ca.uky.edu' }, ... }`
Cover all 50 states. Fallback: USDA NIFA generic URL.

## Edge Cases
- No ZIP in locationInfo → use ZIP from geocoding reverse lookup (already available)
- phzmapi.org returns null → skip zone/frost section, show "zone data unavailable"
- iNaturalist returns < 3 native plants after filtering → show what we have, don't pad
- iNaturalist times out → graceful null, section still renders with available data
- Soil from propIntel is null → skip soil subsection entirely

## Acceptance Criteria Mapping
- [x] Hardiness zone: phzmapi.org by ZIP → coordinate-specific
- [x] Frost dates: zone-based table, derived from coordinate-specific zone
- [x] Soil: USDA Web Soil Survey (already implemented, reused)
- [x] Native plant list: iNaturalist, state/county specific (16km radius)
- [x] Invasive species: iNaturalist with introduced filter (32km radius)
- [x] Wildlife: iNaturalist mammals, regionally specific
- [x] No hardcoded plant names: all from iNaturalist API
- [x] Graceful fallback: each data source independent, null = section omitted
- [x] Mobile rendering: uses existing premium card CSS
- [x] Tone: warm, optimistic — "Cool Things to Know" bucket
- [x] No Fair Housing language: describes land characteristics only
