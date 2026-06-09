# FR-059 — Seismic Risk (Climate enhancement) · Summary

*Shipped on branch `FR-059-seismic-risk` (off `main`). 4-phase workflow + subagent-driven TDD with per-task review.*

## What shipped
Earthquake risk added to the **Climate** chapter (not a new chapter — it belongs in the natural-hazards bucket alongside flood/tornado/winter, per the "fit data into the chapter where it belongs" principle).

- **Data** (`climate/data.js#getSeismicHazard`): USGS ASCE 7-16 Seismic Design Web Service (keyless), cell-cached 90 days (negatives cached as `{pga:null}`; transient errors not cached). Composed into the existing `climateHistory` via `getSeismicContext`. No `chapters.js` change.
- **Logic** (`climate/logic.js#getSeismicContext`): PGA → descriptive **band** (very-low…very-high) from `PGA_BAND_THRESHOLDS`, with a `promote` flag and a factual, non-alarming narrative. **No score** (CONSTRAINT-001), same shape as the existing flood-zone risk labels.
- **Adaptive placement**: L3 "Earthquake" tab always (when data resolves); **L2 promoted row only when band ≥ moderate**; L4 design-values table (PGA/SS/S1/SDS) + USGS source disclosing the `riskCategory II` / `siteClass D` modeling assumptions.

## ✅ Verified live (USGS reachable from this env)
| Address | PGA (g) | Band | L2 promoted? |
|---|---|---|---|
| Georgetown KY | 0.084 | low | no |
| Louisville KY | 0.098 | low | no |
| Jeffersonville IN | 0.096 | low | no |
| **Harlan KY** | **0.217** | **high** | **yes** |
| **Bozeman MT** | **0.296** | **high** | **yes** |

**Differentiation win:** Harlan KY promotes because it sits near the **Eastern Tennessee Seismic Zone** (the 2nd-most-active in the eastern US) — a genuine, non-obvious hazard most buyers (and listings) would never surface. Exactly the "things you'd only learn after living there" value. (My pre-build assumption that all four KY/IN addresses would be low was wrong on Harlan — the real data is the point.)

**Transient-null note:** firing all 5 USGS calls back-to-back produced one transient `null` (Georgetown) from timeout/throttle; it resolves cleanly in isolation (pga 0.084) and is **not cached**, so it self-heals. In production each report makes a single cell-cached call, so rapid-fire contention doesn't occur; a hiccup simply omits the supplementary seismic finding and retries next report (CONSTRAINT-015).

## Architecture / resilience
- **Cell-cached, 90-day TTL** (hazard model updates ~every 6 years) — neighbors share one fetch (FR-058 alignment).
- Negatives cached (genuinely-no-data cells); transient failures not cached.
- Fully layered: data fetches, logic categorizes (no score), template renders (no inline styles).

## Tests
- **Full suite: 1248 / 66 suites** green (was 1232 / 65 on `main`; +1 suite `climate/logic.test.js`, +16 tests).
- Logic: band boundaries (incl. the `0.05→low` boundary), promote gating, null/invalid, no-scoring narrative.
- Data: parse, **cell-cache hit (no re-fetch)**, negative-cached, transient-not-cached, network-throw, **centroid-not-raw** URL.
- Template: all four adaptive-placement states (promote / low-but-present / null), no-inline-style, no-scoring.

## Notes / follow-ups
- The PGA band cutoffs are a single constant (`PGA_BAND_THRESHOLDS`) — trivially retunable. Harlan at 0.217 lands just over the 0.20 "high" line; if a higher bar before "high" is preferred, it's a one-line change.
- Visual styling rides on existing Climate classes (`prem-climate-row`, `climate-tab`, `climate-data-table`); no new CSS — finalize alongside the frontend phase if desired.
