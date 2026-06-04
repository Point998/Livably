# NR-003 — Spatial Cost Architecture: Cells, Bands, and the Path to Enterprise Margin
*Nathan Borders — June 2026*

---

## The Question

NR-002 proved per-report margin is fine at any consumer price point. So this is not "can Livably afford to run." It's the next question: **how does the marginal cost of a report behave at enterprise (B2B) volume, and what is the cheapest path to drive it down without sacrificing the accuracy that is Livably's entire differentiation?**

This document diagnoses the real cost leak (it's in our code, not in Google's pricing), proposes an architecture that collapses marginal cost by 70–85% with zero accuracy regression and no provider change, and lays out a phased path that defers the expensive infrastructure until a contract actually justifies it.

---

## Why This Matters Now (and Why NR-002 Isn't the Whole Story)

NR-002's verdict stands: at $25–99/report, $0.65 of API cost is a rounding error. But two things sit outside that frame:

1. **B2B marginal cost (Model C).** A lender doing 5,000 loans/month is ~$3,270; 10,000 is ~$6,150. That number lives *inside* a negotiated margin floor. Every cent off the marginal report widens the deal we can win and the discount we can offer.
2. **Abuse blast radius.** A scraper hammering the endpoint converts directly into *our* Google bill (NR-002, Scenario 2). Cost-per-report is also our exposure ceiling.

Both are about the cost of the **Nth report in an area**, not the first. That is the lens for everything below.

---

## The Diagnosis: The Leak Is One Line, Repeated

NR-002 assumed the caches were in-memory and reset on restart. That is now stale. `src/cache.js` is already a **persistent, file-backed cache** with sane TTLs (geocode 90d, places 7d, drivetime 24h). The "add persistence" recommendation is already half-built.

The real leak is the **cache key**, repeated across every module:

```js
const cacheKey = `grocery:${originLatLng}`;    // reachability/data.js:19
const cacheKey = `${originLatLng}:${destStr}`;  // distanceMatrix.js:9
```

**Every key is the exact coordinate.** Two houses on the same cul-de-sac produce different keys and share *nothing*. The same hospital, grocery, and schools get re-fetched and re-billed for every address — even though the answers are identical. At B2B volume, where loans cluster in the same metros and subdivisions, we pay full freight for answers already sitting on disk.

This is the "address-level live enrichment vs. regional intelligence" problem, and it is fixable without touching providers.

---

## The Architecture: Spatial Cells + Banding Are the Same Idea

The fix rests on one insight:

> **POI identity is shareable across a neighborhood. Drive time is not — unless you band it.**

### Spatial cells (shareable POIs)

The nearest hospital, grocery, and schools for 123 Main St are the same as for 145 Main St. Snap the origin to a spatial cell (**H3** or geohash) *before* building the cache key. Every address in that cell reuses one Places fetch. POI cost collapses toward zero on the 2nd+ report in a cell.

### Banding (honest shared drive times)

Drive time from each house differs by a minute or two, so we can't honestly share a cached "6 minutes." **Banding is what makes cell-sharing truthful.** Compute drive time once from the **cell centroid**, bucket it ("under 10 min"), and that statement is true for *every* house in the cell — the ±1–2 min intra-cell spread is absorbed by the band width.

This is not a precision downgrade tolerated for cost. It is the mechanism that lets one computation serve a whole neighborhood **honestly** — and it is consistent with Livably's DNA. CONSTRAINT-001 already bans false precision (scores, grades). "Exactly 6 minutes" is the same category of error: door-to-door, traffic-dependent driving does not have one-minute accuracy, and nobody *experiences* 6.0 minutes. They experience "a quick trip." Bands are the voice of having lived there; exact minutes are the voice of a machine.

**Compounding bonus:** the drivetime TTL is only 24h *because exact minutes drift with traffic*. A band barely moves day to day, so banding lets us extend that TTL from 24h to weeks — multiplying reuse.

---

## The Band Ladder: Fine Near Zero, Coarse Far Out

Bands must land on the numbers people already round to (5, 10, 15, 20, 30, an hour) — not arbitrary boundaries like 7 or 12, which nobody says aloud. And the gaps should **widen** with distance, because the annoyance of +5 minutes is huge at the 5-minute scale and trivial at the 45-minute scale (Weber's law).

**Suburban baseline ladder:**

| Threshold | Reads as |
|---|---|
| under 5 min | around the corner |
| under 10 min | a quick trip |
| under 15 min | a short drive |
| under 25 min | across town |
| under 40 min | a bit of a haul |
| 40 min+ | you plan around it |

Gaps grow: 5 / 5 / 5 / 10 / 15.

**The ladder shifts by density** using the `detectRuralMode()` classification we already compute (`validate.js:17`):

| Mode | H3 cell res (~edge) | Ladder behavior |
|---|---|---|
| Urban / downtown | res 9 (~150m) | tightens (2 / 5 / 10 / 15) — being 8 vs 3 min from transit matters |
| Suburban | res 8 (~450m) | baseline ladder above |
| Rural | res 6 (~3km) | slides up; bottom rungs vanish (starts ~15) |
| Remote | res 5 (~8km) | wide bands ("under 25 / under 40 / 40+") |

One ladder, shifted by a classification we already have — not four schemes to maintain. In real rural, destinations are far and shared across a wide area anyway, so large cells lose no accuracy and the wide bands are exactly how a resident describes it ("the grocery's a sub-25-minute drive").

---

## Two Honesty Guardrails (so this is engineered, not hand-wavy)

1. **Band width > worst-case intra-cell spread.** A ~450m suburban cell puts an edge house ~1–2 min off the centroid. A 5-min-wide band absorbs that. Bands are deliberately wider than the error they hide.
2. **Straddle rule.** If the centroid value lands within ~1 min of a boundary, round *up* to the slower band. We never undersell a drive — the buyer is never disappointed on move-in, only pleasantly surprised.

**Safety stays concrete.** Hospital/ER keeps an exact number and never receives a phrase. The *selection* (CONSTRAINT-003 — nearest by drive time across top-5 candidates) stays exact under the hood regardless of presentation. Banding is for the lifestyle tier, where lived-experience phrasing is the honest register anyway.

---

## The Data Contract (lock this; defer the visual)

The visual framing — per-place bands, "reachable-within" grouping, phrase vs. number — is a `template.js` decision and does not need to be made now. What must be locked is that the data and logic layers emit **band-capable data**, so any framing is a pure rendering choice later with zero re-fetching.

| Field | Layer | Why it must exist |
|---|---|---|
| `cellId` + `resolution` | `src/shared/` (new normalizer) | the cache key; what makes neighbors share a fetch |
| `centroidDriveMinutes` (exact) | logic | hospital selection (003), coherence check (010), straddle rounding, exact safety-tier display |
| `bandRung` (0–5) + `mode` | logic | the honest classification ("rung 2 at suburban thresholds") — a data fact, not a design choice |
| `destinationLocation`, source, research date | data | unchanged from today |

**Separation that keeps CONSTRAINT-009 clean:** logic emits the *rung* (computed math); template maps *rung → words* ("a quick trip" vs "under 10 min" vs a grouping header). The boundary is math (logic); the phrase is voice (template). Deciding the visual later touches exactly one layer.

The cost win rides entirely on the data layer — cell-keyed cache + band-stable values with long TTL. **None of the savings depend on which framing we eventually pick.** Deferring the visual costs nothing.

---

## What I'd Push Back On (the original optimization draft)

The working draft proposed replacing **both** routing (→ OSRM/Valhalla) **and** POI (→ OpenStreetMap/Overpass). **Do the first, not the second.**

- **Routing → OSRM: yes, eventually.** OSM's road network is complete and accurate even in Appalachia. Band computation ("under 7 / under 12") doesn't need Google's minute-precise traffic model — free-flow plus a congestion factor is plenty. Self-hosted OSRM has no per-call fee. This is where Google Distance Matrix cost legitimately disappears at scale.
- **POI → OSM: no.** OSM POI completeness in rural areas is materially worse than Google — and *getting rural right is Livably's entire differentiation* (Harlan, real rural). Swapping POI discovery to OSM degrades exactly the addresses we're proudest of and risks CONSTRAINT-003 (hospital) and CONSTRAINT-006 (cross-state) accuracy. **Keep Google as the POI source of truth; just stop re-billing it per-address.**

The sharp version of the hybrid: **OSRM for routing, Google for POI, cell-cache both.** Not "replace Google."

---

## The Phased Path

### Phase 1 — Spatial keys + banding. Do now. Pure Google, zero new infra.
- Add an H3/geohash normalizer in `src/shared/` that snaps origin → cell at mode-appropriate resolution.
- Rewrite cache keys from `${originLatLng}` to `${cellId}` for POI; compute drive time from cell centroid; emit `bandRung`.
- Extend drivetime TTL now that bands are stable.
- **Impact:** 1st report in a cell still ~$0.65; every subsequent report in that cell within TTL drops to ~$0.04. At clustered B2B volume, blended marginal cost plausibly falls from $0.65 → ~$0.10–0.20 (**70–85% off**) with no accuracy regression and no provider change. Achievable as one FR inside the existing 3-layer architecture.

### Phase 2 — OSRM for routing. Do when a B2B contract's math demands sub-$0.10.
- Stand up self-hosted OSRM as the band engine. Google Distance Matrix demoted to two jobs only: hospital top-5 *selection* (003 stays exact) and occasional traffic-accurate spot-checks. Google Places untouched.

### Phase 3 — Precomputed regional warehouse (PostGIS + H3, scheduled enrichment). Build on demand, never on spec.
- The "report = retrieval" endgame. Real, but it carries ongoing ops cost and an OSM-validation burden. Graduate here only when retrieval *latency* or a contract's volume floor requires it. Phase 1 captures most of the dollars for ~10% of the effort and none of the risk — do not skip it to chase the warehouse.

---

## Constraint Compatibility

| Constraint | Status under this plan |
|---|---|
| 003 — hospital by drive time | Selection stays exact (5-call verify, cell-cached); only the *displayed* number bands |
| 006 — cross-state | Unchanged; reverse-geocode check still runs |
| 007 — rural mode | Becomes *more* central — it drives cell resolution + band thresholds |
| 010 — drive-time coherence | Operates on the centroid number before banding |
| 001 — no false precision | Banding *strengthens* this posture |
| 009 — no design in data/logic | Logic emits `bandRung` (math); template maps to words (voice) |
| 014 — coherence lives in validate.js | Cell normalizer + band logic belong in `src/shared/`, called by all modules |

---

## Summary

| Question | Answer |
|---|---|
| Is per-report margin the problem? | No — NR-002 settled that. The target is **B2B marginal cost** and **abuse blast radius**. |
| Where is the actual leak? | Exact-coordinate cache keys. Neighbors share nothing. |
| The fix | Spatial cells (shareable POIs) + banding (honest shared drive times) — the same idea. |
| Why banding fits Livably | It is the anti-false-precision posture (CONSTRAINT-001) applied to time. Lived experience, not odometer. |
| Expected Phase 1 impact | Marginal cost $0.65 → ~$0.10–0.20 (70–85%), zero accuracy regression, no provider change. |
| Replace Google? | Routing → OSRM eventually. POI stays Google — rural accuracy is the differentiation. |
| Build the warehouse now? | No. Build it when a contract's volume math demands it, not on spec. |
| Decide the visual now? | No. Lock the data contract; framing is a one-layer template change later. |
| Next step | Spec Phase 1 as an FR against this document, through the 4-phase workflow. |
