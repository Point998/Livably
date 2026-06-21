# FR-078 — Spec: Headless Report Contract (utilities pilot)

**Phase 2 — Specification. No code changes in this phase.**
Date: 2026-06-21
Pilot chapter: **utilities** (richest mix: numeric facts, tone bands, provenance NREL/HIFLD,
CONSTRAINT-015 fallbacks already present). Fast-follow: **community** (validates the
Fair-Housing-by-schema guarantee).

---

## 1. Goal

Prove a versioned, presentation-free **report contract** + the **governance mechanism** (Zod
validation + snapshot tests + render-from-contract) on one chapter, so the remaining 13 are
repetition. Cut the JSON seam so the backend can serve the contract as data.

## 2. The v1 contract shape (chapter-level)

```jsonc
{
  "schemaVersion": "1.0",
  "chapterId": "utilities",          // stable key; frontend owns display label
  "findings": [
    {
      "id": "electric-rate",
      "bucket": "consider",          // CONSTRAINT-001 framing: consider | check | cool
      "tone": "caution",             // favorable | neutral | caution  (semantic, NOT a color)
      "claim": {
        "subject": "Residential electric rate",
        "measure": { "value": 13, "unit": "cents_per_kwh" },
        "comparison": {
          "basis": "state_average", "referenceValue": 11,
          "direction": "above", "deltaPct": 0.18, "region": "KY"
        }
      },
      "provenance": { "source": "NREL", "asOf": "2026-06", "modeled": false },
      "fallbackAction": null,        // or { type:"url"|"phone"|"instruction", label, value }  (CONSTRAINT-015)
      "defaultCopy": "The residential rate here is about 13¢/kWh, above the state average…" // TRANSITIONAL — deleted when FE owns voice
    }
    // …more findings (provider/ownership, EV charging, internet band)…
  ],
  "degraded": false,                 // from the FR-068 degradation ledger
  "provenanceSummary": [ { "source": "NREL", "asOf": "2026-06" } ]
}
```

### Field rules (the durable contract)
- `bucket` ∈ {consider, check, cool} — required on every finding.
- `tone` ∈ {favorable, neutral, caution} — required; the ONLY design-adjacent field, semantic.
- `claim` — structured; `measure`/`comparison` nullable when a finding is qualitative.
- `provenance` — required (source + asOf; `modeled` boolean per honest-provenance discipline).
- `fallbackAction` — nullable; present whenever the underlying datum is missing (CONSTRAINT-015).
- `defaultCopy` — **optional, transitional**; flagged in code as scaffolding to delete.
- **Forbidden by schema:** any numeric `score`/`grade`/`rating` (CONSTRAINT-001); any
  demographic-character field (CONSTRAINT-002, relevant for the community fast-follow).

## 3. Mechanism (ADR-2/3)

- **`src/contract/schema.js`** — Zod schemas: `FindingSchema`, `ChapterContractSchema`,
  enums for bucket/tone/provenance. Exported for reuse by every future chapter + (later) the
  frontend types (`zod-to-json-schema` or `z.infer` export).
- **`src/modules/utilities/contract.js`** — `buildUtilitiesContract(assembled)` maps the existing
  `assembleUtilities(...)` logic output → contract object, then `ChapterContractSchema.parse(...)`
  (throws on drift → caught + logged, never crashes a report; returns null + records degradation).
- **Serialize boundary** — `buildReport` additionally returns `contract` (per-chapter contracts);
  HTML stays for now behind it (additive, non-breaking).
- **Endpoint** — `GET /api/report?address=…&format=json` (or `/api/report.json`) returns the
  assembled contract. Behind the existing rate-limit + cost-breaker chokepoints. Pilot: utilities
  chapter fully migrated; other chapters MAY appear in raw form (flagged `schemaVersion: null`)
  until migrated.

## 4. Render-from-contract proof (sufficiency test)

Refactor `utilities/template.js` to render **from the contract** (not from raw logic output). This
is the real test that the contract carries everything the UI needs. The reference renderer is
explicitly throwaway/placeholder — deliberately minimal, no design investment. If rendering needs
a field the contract lacks, the contract is incomplete → fix the schema, not the template.

## 5. Inputs / Outputs / Edge cases

- **Input:** the existing utilities `assembleUtilities` output (unchanged upstream).
- **Output:** a `ChapterContractSchema`-valid object; `degraded` reflects the ledger.
- **Edge — datum missing** (e.g., electric null): finding still emitted with `tone:"neutral"`,
  `measure:null`, and a populated `fallbackAction` (OpenEI/PSC link) — the contract form of the
  CONSTRAINT-015 fallback we already render today.
- **Edge — schema drift** (logic adds a field the schema rejects): `parse` throws → caught,
  `logError` + `recordDegradation({label:'contract-utilities', kind:'error'})`, chapter omitted
  from the contract; report does not crash.
- **Edge — Fair Housing (community fast-follow):** schema has no demographic-character field; a
  test asserts the community contract cannot carry one.

## 6. Acceptance criteria

- [ ] AC-1 `ChapterContractSchema` (Zod) exists and is the single source of truth; exports a JSON
  Schema / inferred types artifact for the future frontend.
- [ ] AC-2 `buildUtilitiesContract` returns a schema-valid contract for all 5 test addresses
  (incl. Jeffersonville IN); **snapshot-tested** per address.
- [ ] AC-3 No finding contains a numeric score/grade/rating field (CONSTRAINT-001) — asserted by a
  schema-level test, not just convention.
- [ ] AC-4 Missing-datum findings carry a `fallbackAction` (CONSTRAINT-015) — tested.
- [ ] AC-5 `tone` is semantic (enum), never a color; no hex/`color` token appears in the contract.
- [ ] AC-6 `GET /api/report?...format=json` returns the validated contract; behind rate-limit +
  cost-breaker; respects the FR-058 cell cache.
- [ ] AC-7 `utilities/template.js` renders from the contract; existing utilities render tests still
  assert the same key facts appear (proves sufficiency, no user-visible regression).
- [ ] AC-8 Schema-drift path is crash-safe (caught, logged, chapter omitted) — tested.
- [ ] AC-9 `defaultCopy` is documented in code as transitional; a follow-up issue tracks its
  removal when the frontend owns voice.
- [ ] AC-10 Full suite green; new deps (zod, zod-to-json-schema) documented in summary.

## 7. Scope / non-goals

**In:** utilities chapter contract + Zod mechanism + endpoint + render-from-contract + tests.
**Out:** the other 13 chapters (rollout plan only); the frontend; framework choice; TypeScript
adoption; GraphQL; removing `defaultCopy` (tracked, not done).

## 8. Rollout plan (post-pilot, for context)
Per chapter, additively: write `<module>/contract.js` + Zod conformance, snapshot per address,
re-point its template at the contract. Bump `schemaVersion` only on breaking changes; additive
fields don't bump. When all 14 are migrated, `buildReportHTML` becomes the throwaway reference
renderer and the frontend takes over.

## 9. New dependencies
- `zod` (schema + runtime validation). `zod-to-json-schema` (export types for the frontend).
  Both mainstream, zero-native-dep. Documented per project policy.

## Phase 2 exit
No code changed. Plan (Phase 3) follows on approval: ordered tasks (schema → contract builder →
endpoint → render-from-contract → tests), risks, and the snapshot-test list.
