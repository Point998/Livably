# FR-074 — Census ACS vintage resilience (final non-Google single) — Discovery

## Phase 1 — Discovery (read-only)

### What this slice is
The **last A1 slice** and the highest-leverage one: `fetchCensusACS` in
`src/shared/census.js` is the **most widely-shared single source in the app** —
consumed by **6 modules + the rural-mode cascade** — and it hard-codes the ACS
**`2022`** data vintage. "Census vintage" names exactly this: the data is stale and
the lone endpoint is brittle.

### How Census works today (verified) — `src/shared/census.js`
- **`fetchCensusACS(fips, vars)`** — GETs
  `https://api.census.gov/data/2022/acs/acs5?get=…&for=tract:…&in=state:… county:…&key=…`,
  parses `[headers, values]`, returns `{ get, headers, values }` (where
  `get(name) = values[headers.indexOf(name)]`) or `null` (no key / non-ok /
  parse-fail / <2 rows). **No retry, no fallback, no observability** — silent null.
- **`getCensusFIPS(lat, lng)`** — reverse-geocodes via the Census *geocoder*
  (`geocoding.geo.census.gov`) → `{ state, county, tract }`, in-memory cached,
  silent `try/catch → null`. The **upstream cascade**: FIPS failure starves every
  ACS consumer.

### Consumers (the broad blast radius — contract must stay identical)
`fetchCensusACS`/`getCensusFIPS` are used by: **Property** (housing vintage —
median year built + age bands), **Growth** (new-construction share + permits-adjacent),
**Sensory** (population → Bortle light-pollution estimate), **Community**
(demographics), and **`services/reportBuilder.js`** (prefetch tract population →
**rural-mode detection**, CONSTRAINT-007). The `.get(name)` contract and the
no-key→null behavior are depended on across all of them + tested in
`tests/shared/census.test.js`.

### The concrete problem (live-probed)
| Probe | Result |
|---|---|
| Keyless ACS request (2022/2023/2024) | ❌ 302 → **"Missing Key"** page. Census now **requires a key** — no keyless fallback is viable (`if (!key) return null` stays correct). |
| Vintage path `…/2023/acs/acs5` | Reaches the key check (valid path) | 
| Hard-coded vintage | **`2022`** |

**As of today (2026-06-17), the 2024 ACS5 (2020-2024) has shipped (~Dec 2025) and
2023 too — so the app serves data ~two vintages stale.** And it's brittle: when a
vintage endpoint is eventually retired, the hard-coded year is a hard failure with
no fallback. *(Could not keyed-probe which vintages return data — no
`CENSUS_API_KEY` in the discovery shell; the 302 "Missing Key" fires before vintage
validation. The live verify must run where the key is set — see Risks.)*

### Three problems, ranked
1. **Stale + brittle vintage** — hard-coded `2022`; no path to newer data, no
   survival if the endpoint is retired. *The name-justifying core.*
2. **No observability** — silent null for the *most-shared* source; a Census outage
   is invisible in the FR-068 ledger (the NR-004 swallow class, worst instance).
3. **No retry** — single fetch against a sometimes-slow API.

### Recommended shape — vintage-fallback chain + observability (FR-072 lineage)
A **newest-first ACS5 vintage fallback**, resolved once and cached, wrapped in
`sourceChain` — simultaneously *more current* and *resilient*:

- New constant `CENSUS_ACS_VINTAGES = [2024, 2023, 2022]` (newest first;
  configurable). `fetchCensusACS` tries them in order; **first vintage that returns
  valid rows wins**, and the resolved vintage is **module-cached** so subsequent
  calls in the session skip the dead-newer probes (avoid re-hammering).
- Wrap the attempt in `sourceChain` (label `census-acs`) → vintage fallback +
  full exhaustion recorded in the **FR-068 ledger**. The broadly-shared dependency
  finally becomes observable.
- **Distinguish** "vintage unavailable" (non-ok/empty → try older) from a healthy
  empty result. Optionally one transient retry on the resolved vintage.
- **Provenance** (honest-provenance): carry the winning vintage year on the result
  (e.g., `{ get, headers, values, vintage }`) so consumers' "ACS 5-year estimates"
  disclaimers *can* name the year — additive, non-breaking (consumers ignore the
  extra field today).
- **Contract unchanged**: `{ get, headers, values }` + no-key→null preserved →
  consumers + `census.test.js` untouched in behavior.
- **No keyless fallback** (confirmed not viable).
- **Floor**: each consumer already degrades gracefully on null (Property era →
  "data was not available"; Growth → null; Sensory → `estimateBortle(null,…)`;
  rural-mode → `tractPop=0` path). CONSTRAINT-015 already met — no floor work.

### `getCensusFIPS` — secondary, in-scope-if-cheap
The geocoder is a *separate* single point of failure and the upstream of
everything. It's silent-swallow too. Recommend a **light** add in the same FR
(same file): a transient retry + `sourceChain`/ledger observability (label
`census-fips`). Flag as secondary — the named target is the *vintage*.

### Why this is the right final slice
Highest leverage (one fix hardens 6 modules + rural-mode), a *concrete* currency
win (2022 → newest), and it closes the observability gap on the app's most-shared
external dependency. Shape = FR-072's hardened-primary lineage, with the fallback
being **across vintages of the same source** (no third-party mirror needed — unlike
elevation's OpenTopoData, and unlike soil there *is* a real fallback dimension
here: the vintage axis).

### Risks / unknowns (resolve in spec / verify)
1. **Can't keyed-probe vintages here** (no key). Mitigation: keep older vintages in
   the fallback list, so bumping the newest is safe (a missing 2024 → 2023 → 2022).
   The live verify runs where `CENSUS_API_KEY` is set (prod/CI secret).
2. **Variable-ID stability across vintages** — the vars used (`B25034_*`, `B25035_*`,
   `B19013_*`, `B01003_*`, `B01001_*`) are long-stable ACS5 tables; low risk, but
   the fallback gracefully drops to an older vintage if a newer one rejects a var.
3. **Resolved-vintage cache scope** — module-level cache means a transient failure
   on the newest vintage could "stick" the session to an older one. Acceptable
   (still valid Census data, ledger-visible); optionally cache only *successful*
   resolution, not failures.
4. **Contract drift** — the additive `vintage` field must not break the `.get()`
   consumers (it won't — they read `.get`/`.values`).
5. **Latency** — newest-first means up to N failed calls before the first success
   on a cold session; the resolved-vintage cache bounds this to once per process.

### Recommendation
Proceed to Phase 2 (spec) as **FR-074-census-vintage-resilience**: newest-first
ACS5 vintage fallback (resolved-vintage cached) + `sourceChain` observability +
provenance year, contract-preserving; light `getCensusFIPS` retry+observability as
a secondary. This completes Track A1.
