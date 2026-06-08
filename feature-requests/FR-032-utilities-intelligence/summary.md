# FR-032 — Utilities & Power · Summary

*Shipped on branch `FR-032-utilities-intelligence`. Built with the 4-phase workflow (discovery → spec → plan → implementation) via subagent-driven TDD with per-task spec + code-quality review.*

## What shipped
A new **Utilities & Power** chapter (`src/modules/utilities/{data,logic,template}.js`), wired into `getChapterData` / `buildChaptersHTML`, rendered right after **Property Costs & Market** as the final "true cost of living here" chapter. Depth-slider L1–L4:
- **L1 Glance:** electric provider · rate-vs-state-average.
- **L2 Body:** electric (provider, inferred type, rate-vs-state narrative + badge), state-level grid reliability, likely water/sewer/gas (rural-mode driven) + verify action, Key Takeaway.
- **L3 Deep Read:** tabbed Electric / Reliability / EV Charging (nearest L2 + DC-fast, cost-per-charge, home-charging note).
- **L4 Research:** OpenEI, EIA-861, live outage-map, county service-area, AFDC links + a cross-link to the Property chapter's Internet tab (ISP is **not** rebuilt here).

## Scope (solid-core-first)
- **In:** electric provider + inferred type + residential rate vs state average (NREL Utility Rates); state-average reliability (bundled EIA-861 SAIDI/SAIFI); gas/water/sewer likely-service inference (ruralMode); EV charging (NREL Alternative Fuel Stations + cost-per-charge).
- **Cross-linked, not rebuilt:** ISP → Property chapter.
- **Deferred (recorded in spec):** address-level outage history; net metering; EPA SDWA water violations; well-depth-by-geology; trash/recycling; M-Lab/Ookla actual speeds; per-commute annual EV cost (→ FR-033, which will consume this chapter's local electric rate).

## Architecture / scalability / resilience (the priorities)
- **Cell-cached fetch (FR-058 parity):** `getUtilitiesData` keys by H3 `cellId`, searches from the cell centroid, and caches `{electric, evCharging}` for 30 days (`utilitiesCache`). Neighboring addresses in a cell share **one** fetch — warm cell = **zero** NREL calls. Utilities is the most cell-stable data in the report (one utility + rate per cell).
- **Resilience:** every external-failure path returns `null` → actionable fallback (CONSTRAINT-015); the fetch sits in `getChapterData`'s `Promise.allSettled` so it can never break the report. A both-null result is **not** cached for the full TTL (a transient NREL outage on a cold call won't blank a cell for a month). Optional `NREL_API_KEY`; falls back to `DEMO_KEY`.
- **Layer purity:** data fetches only, logic does factual comparisons (no scoring), template renders only — verified by the constraint suite scanning the new module.

## Data sources + research dates
- Electric provider + residential rate: **NREL / OpenEI Utility Rate Database** (live, per-address centroid).
- EV charging: **U.S. DOE Alternative Fuel Data Center** (live, nearest L2 + DC-fast).
- Reliability: **EIA-861** distribution reliability (IEEE 1366, ex–major events), bundled state averages — snapshot **June 2026**, labeled state-level.
- State electric rate averages: **EIA** residential price by state — snapshot **June 2026**.
- Water/sewer/gas: **inference** from rural-mode classification (no free parcel-level source) — always paired with a verify action.

## New dependencies / config
- `NREL_API_KEY` added to `.env.example` (optional; `DEMO_KEY` fallback). No new npm packages.
- New constants: `STATE_AVG_ELECTRIC_RATE`, `STATE_AVG_RELIABILITY`, `EV_BATTERY_KWH_REF`, `UTILITIES_CELL_TTL_DAYS`.
- New cache namespace: `utilitiesCache` (30-day TTL).

## Deviations from plan
- **Chapter color:** the plan/old-vision spec specified deep teal `#1a6b6b`, but `--ch-costs` already owns that exact hex and Utilities renders immediately after Costs — identical adjacent colors would break the per-chapter identity system. Shipped a distinct, currently-unused **power-amber** (`#a6791f`) as a **provisional placeholder**, to be finalized in the frontend design phase.
- **`getUtilityType` regex:** dropped the `\butilities?\b$` municipal anchor — it mislabeled "Kentucky Utilities" (an IOU, and the Georgetown KY acceptance case) as municipal because the name ends in "Utilities". Municipal detection still keys on `city of` / `municipal` / `public power|util` / `board of public` / `plant board`. Covered by an explicit regression test.

## Tests
- **Full suite: 1289 passed / 68 suites** (was 1232 / 65 → +57 tests, +3 suites: utilities data/logic/template).
- Logic: 29 tests (rate bands, type inference incl. the IOU regression, outage fallback, rural-vs-urban services, EV cost, assembleUtilities null-safety).
- Data: 11 tests incl. **cache-hit (zero new NREL calls on 2nd same-cell call)**, **centroid-search**, partial-failure tolerance, and **total-miss is not cached**.
- Template: 12 tests incl. both fallback paths, no-inline-style + no-scoring guards, takeaway branches.
- Constraint suite (layer-ownership, no-inline-styles, no-scoring, test-coverage, fair-housing, etc.): green with the new module scanned.

## NREL parser hardening (post-build, pre-merge)
Because live NREL wasn't reachable from the build environment, the parser was hardened against NREL's **documented** v3 response shapes via schema-derived fixtures (`tests/modules/utilities/fixtures/`, see its README) and a fixtures-driven suite:
- Quirks now locked by tests: nested `outputs.utility_info[].ownership`; `residential: "no data"` sentinel → `null` (no throw); `null` EVSE counts; empty station lists. (The pure-shape cases already passed before the change — confirming the original parser's resilience.)
- **Data-quality upgrade:** `getElectricData` now extracts NREL's **authoritative** `utility_info[].ownership`; `getUtilityType(name, ownership)` trusts it (confident label, `hedge:false`) for the three known buckets and falls back to the name heuristic (`hedge:true`) when ownership is absent or exotic (Federal/State/etc.) — strictly additive, no regression.
- ⚠️ These fixtures are **schema-derived, not live captures.** On first live contact, re-capture 1–2 real NREL responses and diff against the fixtures; if NREL's field names/structure differ, update fixtures + parser together. (Most likely point of surprise: the exact `ownership` string values and whether `utility_info` is always present.)

## Verification status (read this)
- ✅ **Verifiable here & done:** full unit/integration/constraint suite; cell-cache + centroid behavior; **live resilience** — in this sandbox `developer.nrel.gov` is DNS-blocked (ENOTFOUND), and the chapter degraded exactly as designed: assemble → template renders with `data-ch="utilities"`, actionable OpenEI/AFDC fallbacks, ruralMode-driven services (Harlan→well/septic, Georgetown→municipal), and state-level reliability (all NREL-independent), with no crash.
- ⏳ **Deferred — NOT yet verified:** the **populated** live-data acceptance checks (Georgetown KY → *Kentucky Utilities*; Bozeman MT → *NorthWestern Energy*; nearest chargers) could **not** run here because NREL is unreachable from this environment. These must be confirmed in an environment with NREL access (a real/DEMO key + network), e.g. Nathan's local box or once deployed. The full visual 5-address screenshot pass is likewise pending NREL reachability (Google APIs resolve fine; NREL does not).

## Follow-ups
- Run the populated 5-address verification (incl. Jeffersonville IN regression) where NREL is reachable; capture provider names + chargers.
- Finalize the chapter color in the frontend phase.
- FR-033 will reuse this chapter's local electric rate for per-commute EV cost.
