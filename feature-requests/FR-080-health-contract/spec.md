# FR-080 — Health chapter → headless report contract

*Rollout #2 of the headless contract (after FR-078 utilities pilot, FR-079 community).*
**Status:** Spec · **Module:** `src/modules/health` · **Date:** 2026-06-23

---

## Goal

Migrate the **health** chapter's logic output into a versioned, presentation-free
`ChapterContract` (`src/contract/schema.js`), wired additively into the report
envelope (`GET /api/report.json`). Same proven pattern as utilities/community:
a per-module `contract.js` exporting `buildHealthContract(input, opts)` that calls
`safeBuild`, plus a contract test (schema-valid + per-address snapshots incl.
Jeffersonville IN). No reference renderer (community shipped without one).

## Scope boundary (ADR-1)

**Health contract = the health module's outputs only:** hospital (ER), urgent care,
and healthcare depth (CMS hospital type + NPI primary-care count). The visual
"Health & Safety" chapter *also* renders fire/police response, but that data is
`chapters.emergency`, owned by the **safety** module — it gets its own contract in a
later FR. One module → one contract, matching FR-078/079. The frontend composes the
two contracts into one visual chapter if it wants; presentation composition is the
FE's job, not the backend's.

## Inputs

Health data is **not** a single assembled object (unlike `chapters.utilities` /
`chapters.demographics`) — it is three values computed in `reportBuilder.js`:

- `hospital` — `{ name, address, location, driveTimeMinutes, crossStateWarning?, crossStateNote? }` or null
- `urgentCare` — same shape, or null
- `healthcareDepth` — `{ designation: {label, note}|null, primaryCareCount: number|null }` or null
- `locationInfo` — `{ state, city, county }` (context)

So the builder signature is `buildHealthContract({ hospital, urgentCare, healthcareDepth }, opts)`
where `opts = { asOf?, degraded? }`.

CONSTRAINT-003 is upstream and preserved: `hospital`/`urgentCare` arrive already
drive-time-verified across top-5 candidates (PM-003). The contract only serializes.

## Schema change (ADR-2)

`ClaimSchema` gains one **optional, non-breaking** field:

```js
place: z.object({ name: z.string(), address: z.string() }).strict().nullable().optional(),
```

**Why:** a located facility's name + address is durable payload the FE needs (render
"Baptist Health — 12 min", build a directions link) and cannot derive. It is **not**
health-specific — located-facility findings recur across ~5 remaining chapters
(health, schools, safety, reachability). Encoding name in `subject` + address in
`defaultCopy` (the no-schema-change alternative) is **lossy**: FR-078's ADR deletes
`defaultCopy` once the FE owns voice, which would silently drop the address.

**Why this doesn't violate FR-078's "don't expand until a consumer needs it":** that
posture targets *mechanism* speculation (GraphQL, generic query layers). `place` is
*domain modeling* of data five chapters already produce. Optional + `.strict()` →
existing utilities/community contracts validate unchanged; **schemaVersion stays 1.0**
(additive = non-breaking).

**Deliberately excluded now:** coordinates. `hospital.location {lat,lng}` exists, but
no FE map consumer does. `lat/lng` can be added later as another optional field
(non-breaking) when a real consumer appears. Adding it now is imagined-future bloat.

## Outputs — findings

All buckets/tones use the three-bucket framing only (CONSTRAINT-001 — no scores).
Tone is **derived** from existing semantic signals (drive-time tiers, count tiers),
never a color (CONSTRAINT-008). Drive time is a real `measure` (`unit: 'drive_minutes'`).

| id | when | bucket | tone | claim |
|----|------|--------|------|-------|
| `emergency-room` | hospital present | consider | ≤10 favorable / 11–20 neutral / >20 caution (drive min) | subject "Nearest emergency room", `place {name,address}`, measure {value: mins, unit: drive_minutes} |
| `emergency-room-missing` | hospital absent | check | caution | subject "Nearest emergency room", fallbackAction → CMS Care Compare URL |
| `urgent-care` | urgentCare present | cool | favorable if closer than ER, else neutral | subject "Nearest urgent care", `place`, measure drive_minutes |
| `urgent-care-missing` | urgentCare absent | check | neutral | fallbackAction → Solv Health URL (matches template's live fallback) |
| `hospital-type` | designation present | cool | neutral | subject "Hospital designation", defaultCopy = `${label} — ${note}`, source CMS |
| `primary-care` | primaryCareCount is a number | consider | 0 caution / ≤5 caution / ≤15 neutral / >15 favorable | subject "Primary care physicians in area", measure {value: count, unit: physicians}, source CMS NPI Registry |
| `primary-care-missing` | healthcareDepth present but count null | check | neutral | fallbackAction → instruction (contact insurer) |

Notes:
- **Cross-state hospital/urgent care** (CONSTRAINT-006 / PM-001, Jeffersonville edge):
  when `crossStateWarning`, set `tone: 'caution'` and surface `crossStateNote` via
  `defaultCopy`. A structured cross-state flag is a deferred follow-up — it's a true
  edge, not a recurring shape; don't structure speculatively.
- **Omission vs missing-fallback:** `hospital-type` and `primary-care` are L3
  enrichment — when their *source* data is simply absent (no hospital at all), the
  finding is omitted, mirroring community (only the core ER/urgent-care/primary-care
  data emits an explicit missing-fallback). CONSTRAINT-015 is satisfied because the
  core findings always carry an actionable fallback when their datum is missing.

## Provenance

- hospital, urgent care → `{ source: 'Google Places', asOf, modeled: false }`
- hospital type → `{ source: 'CMS', asOf, modeled: false }`
- primary care → `{ source: 'CMS NPI Registry', asOf, modeled: false }`
- `provenanceSummary` dedupes by `source|asOf`.

## Wiring

`reportBuilder.js` envelope `contract.chapters.health`:

```js
health: (hospital || urgentCare || healthcareDepth)
  ? buildHealthContract({ hospital, urgentCare, healthcareDepth }, { degraded: degradation.total > 0 })
  : null,
```

## Acceptance criteria

- AC-1: `buildHealthContract(null-ish input)` → null (no hospital/urgentCare/depth) ⇒ envelope sets `health: null`.
- AC-2: full input → `ChapterContractSchema.safeParse(c).success === true`.
- AC-3: ER finding carries `place {name, address}` and `measure {value, unit:'drive_minutes'}`.
- AC-4: ER tone derives correctly across the three drive-time tiers.
- AC-5: urgent-care tone is `favorable` when closer than ER, else `neutral`.
- AC-6: missing hospital ⇒ `emergency-room-missing` with actionable `fallbackAction` (CONSTRAINT-015).
- AC-7: no finding carries `score`/`grade`/`rating`; serialized JSON contains no `"color"` (CONSTRAINT-001/008).
- AC-8: cross-state hospital ⇒ tone `caution` + note in defaultCopy (CONSTRAINT-006).
- AC-9: primary-care tone derives across count tiers; count is a `measure`.
- AC-10: schema change is additive — existing utilities/community contract tests still pass unchanged; schemaVersion remains `1.0`.
- AC-11: per-address snapshots incl. Jeffersonville IN (CONSTRAINT-011).
- AC-12: full suite green (≈1,696 → +N tests), CI green.
