# FR-072 — USDA soil resilience (non-Google single) — Discovery

## Phase 1 — Discovery (read-only)

### What this slice is
The next A1 slice, but a **different shape** from FR-066–071. Those wrapped a
*Google-Places-backed* finding in a Google→OSM fallback. USDA soil has **no Google
primary** — it's a lone third-party API (USDA Soil Data Access) that is a single
point of failure. Track A item 1 names it explicitly ("each lone API — NOAA
climate, USDA soil, … — is a single point of failure today"). The roadmap frames
the non-Google singles as **"primary → fallback *or* actionable floor, not
Google→OSM."**

### How soil works today (verified)
- **Single fetch:** `getSoilData(lat, lng)` (`src/modules/property/data.js:41`)
  POSTs a SQL query to the **USDA SDA Tabular REST** endpoint
  (`sdmdataaccess.sc.egov.usda.gov`), pulling SSURGO `muname, drainagecl, hydgrp,
  hydricrating` for the map unit intersecting the point.
- **Returns** `{ muname, drainagecl, hydricrating, isHydric, drainageCategory }`
  or `null`. Consumed by **both** Property (`buildSoilTab`,
  `buildPropertyIntelligenceHTML`, research tab) **and** Garden (`buildWhatWillGrowHTML`,
  `buildFoodGardenTab`) — Garden receives the same `soil` object, it does **not**
  re-fetch. So a single data-layer fix benefits two chapters.
- **`usda-soil`** SOURCES descriptor (`data.js:131`) runs `getSoilData`, `isValid`
  = `drainagecl` is a string.

### Two real problems with today's path
1. **Silent swallow (the NR-004 observability debt, verbatim).** `getSoilData`'s
   `try/catch` returns `null` on *any* failure — timeout, 5xx, SDA maintenance —
   logging only `console.error`. There is **no FR-068 degradation event**: a soil
   outage is invisible in the ledger/admin panel. This is exactly the
   "`try/catch → null` swallow site" sweep the roadmap watch-items call out.
2. **Generic, non-coordinate floor.** On `null`, the template already degrades
   gracefully (CONSTRAINT-015 is *met*): Property's `buildSoilTab` shows a
   geotech/seller prompt, and the research tab links `websoilsurvey.sc.egov.usda.gov/`
   — but the link is the **homepage**, not a parcel-specific AOI. The floor is
   honest but not as actionable as it could be.

### Is there a true independent second SOURCE? (live-probed)
| Candidate | Result | Verdict |
|---|---|---|
| **USDA SDA Tabular** (current) | ✅ 200 — `["Bluegrass-Maury silt loams…","Bluegrass","Well drained","B","No"]` | The authoritative SSURGO source. Works. |
| **SDA Spatial WFS** (same host) | ✅ 200 | Same host → **no outage independence**; different *service* only. |
| **SoilWeb / casoilresource (UC Davis)** | ❌ 404 on the documented `landpks.php`/`osd_query.php` JSON paths (host resolves; paths moved) | Independent SSURGO mirror in principle, but **no verified current lat/lng JSON API**. Needs a spike. |
| **ISRIC SoilGrids v2** (`rest.isric.org`) | ⚠️ 200 but `mean: null` on first probe; **modeled** global 250 m | Different data model — texture (clay/sand/silt), **not** drainage class / hydric / map-unit. Rate-limited (~5/min). Can only yield a *modeled drainage proxy*, honestly-labeled — not a like-for-like SSURGO replacement. |

**Honest conclusion:** there is **no turnkey, free, independent API** that
reproduces SSURGO's `drainagecl` + `hydricrating` + `muname` by lat/lng. The
authoritative data lives behind one host. SoilGrids is the FR-065-style
*measured→modeled* analog but provides *different fields* and returned null on the
first call; SoilWeb is the ideal independent mirror but its public JSON endpoint
needs verification.

### Recommended shape (matches the roadmap's "or actionable floor" framing)
A `sourceChain`-wrapped soil path whose primary value is **observability + an
honest, coordinate-specific floor** — not a manufactured second source:

1. **Primary — hardened SDA.** Keep the SDA Tabular query; add a **bounded retry**
   on transient failure (timeout/5xx), since a single host's real failure mode is
   transient, and one retry is cheap and genuine resilience.
2. **Floor — structured & coordinate-specific.** Replace the bare `null` with a
   floor record (e.g. `{ available: false, source: 'unavailable', soilwebUrl,
   websoilsurveyUrl }`) carrying a **point-specific** SoilWeb deep-link
   (`casoilresource.lawr.ucdavis.edu/gmap/?loc=<lat>,<lon>` — loads the exact AOI;
   verify in spec) so the CONSTRAINT-015 floor becomes parcel-specific. Surface it
   through `sourceChain` so the degradation is **recorded in the FR-068 ledger**
   (the swallow-debt fix) and provenance stays honest.
3. **Spike (Phase 2, time-boxed) — true secondary.** Attempt to verify a current
   SoilWeb lat/lng JSON endpoint (or an SDA mirror). **If found**, slot it as
   source 2 (measured, same fields) before the floor. **If not**, the hardened
   primary + observable coordinate floor *is* the resilience — a legitimate,
   honest outcome per the roadmap, and it still pays down the swallow debt.

This keeps us honest (no fake precision; `[[project_honest_provenance]]`), reuses
the FR-065 `sourceChain` primitive + FR-068 ledger (CONSTRAINT-014), and improves
two chapters at once.

### What this slice is NOT
- Not a Google→OSM copy (no Google primary, no OSM equivalent for SSURGO).
- Not a SoilGrids texture-model bolt-on *unless* the spec deliberately chooses the
  modeled-proxy path with explicit "modeled, not mapped" labeling — flagged as a
  decision, not assumed. (Its null-on-probe + rate-limit + field mismatch make it
  the weaker option.)

### Risks / unknowns (resolve in spec)
1. **Does a current SoilWeb JSON endpoint exist?** Central unknown — drives whether
   this is "two sources" or "hardened single + floor." Time-box the spike.
2. **SoilWeb gmap deep-link form** — confirm `?loc=lat,lon` loads the point AOI for
   the coordinate-specific floor.
3. **Retry semantics** — distinguish "no soil mapped here" (valid empty, e.g. open
   water / urban pits → keep returning the urban-land narrative) from "fetch
   failed" (retry/floor). Today both collapse to null; the chain must not retry a
   legitimate empty.
4. **SOURCES descriptor** — point `usda-soil` at the raw SDA fetch (like the Google
   descriptors target the Google impl) so the monitor reports SDA specifically, and
   add the floor as a separate informational descriptor if a secondary lands.
5. **No scoring / no fabricated values** (CONSTRAINT-001, honest-provenance).

### Recommendation
Proceed to Phase 2 (spec) as **FR-072-soil-resilience**, leading with the
time-boxed SoilWeb spike to settle the shape, then specify: hardened SDA primary →
(verified secondary, if any) → observable, coordinate-specific actionable floor,
all via `sourceChain` + FR-068 ledger.

---

## SoilWeb spike result (Phase 2 pre-work, time-boxed) — NEGATIVE for a JSON secondary

Probed casoilresource.lawr.ucdavis.edu (Georgetown KY point):

| Endpoint | Result |
|---|---|
| `/soil_web/api/landpks.php?q=spn&lon=&lat=` | ❌ 404 |
| `/soil_web/api/?lon=&lat=` | ❌ 403 |
| `/gmap/json_block.php?lon=&lat=` | ❌ 404 |
| `/soil_web/ssurgo.php?lon=&lat=` | ⚠️ 200 but **HTML** (the mapunit browser UI), not JSON |
| **`/gmap/?loc=<lat>,<lon>`** | ✅ **200 HTML** — the standard SoilWeb share-link |

**Conclusion:** SoilWeb has **no guessable/stable public lat/lng JSON API** that
returns SSURGO drainage/hydric — only HTML browser interfaces. The data backend is
not a public API. **So there is no true independent JSON secondary to slot in.**

**But** the spike found a genuinely useful asset: **`/gmap/?loc=<lat>,<lon>` is a
working, coordinate-specific SoilWeb deep-link** — perfect for upgrading the
actionable floor from today's generic Web Soil Survey *homepage* link to a
point-specific one.

### Settled shape for the spec
The "two sources" branch is closed by evidence. FR-072 = **hardened SDA primary →
observable, coordinate-specific actionable floor**, via `sourceChain` for FR-068
observability. Concretely:
1. `getSoilDataSDA(lat, lng)` — current query + a **bounded single retry** on
   transient failure (timeout/5xx/network); still returns `null` *only* for a
   legitimately empty/unmapped point (so the urban-land narrative is preserved),
   and **throws** on fetch failure so the chain can tell the two apart.
2. `getSoilData(lat, lng)` = `sourceChain([{ name:'sda', run: getSoilDataSDA,
   isValid: validSoilOrEmpty }], …, { label:'property-soil' })`; on a thrown-error
   exhaustion, return a **floor record** `{ available:false, source:'unavailable',
   soilwebUrl:'…/gmap/?loc=lat,lon' }`. The FR-068 ledger records the degradation
   automatically (kills the silent swallow).
3. Template: `buildSoilTab` / research tab consume the floor record to render a
   **point-specific SoilWeb link** instead of the homepage; everything else
   unchanged. Garden inherits the same object — no Garden change needed.
4. SOURCES: `usda-soil` descriptor points at `getSoilDataSDA` (reports SDA
   specifically, like the Google-impl descriptors).

This is the honest outcome: no fabricated second source, real transient-failure
resilience, observability, and a better floor — improving two chapters at once.
