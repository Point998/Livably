# FR-078 — Implementation Plan (Headless Report Contract, utilities pilot)

**Phase 3 — Planning. No code changes in this phase.**
Date: 2026-06-21
Pilot: utilities. Dep confirmed: `zod` (+ `zod-to-json-schema`).

## Ordered tasks (schema → builder → endpoint → render-from-contract → tests → ship)

**T0 — Dependency.** `npm i zod zod-to-json-schema`. Document in summary (project policy).

**T1 — Contract schema (the single source of truth).** `src/contract/schema.js`:
- Zod enums: `Bucket` (consider|check|cool), `Tone` (favorable|neutral|caution).
- `MeasureSchema` { value:number, unit:string } (nullable). `ComparisonSchema`
  { basis, referenceValue, direction, deltaPct, region } (nullable).
- `ProvenanceSchema` { source:string, asOf:string, modeled:boolean }.
- `FallbackActionSchema` { type: url|phone|instruction, label, value } (nullable).
- `FindingSchema` { id, bucket, tone, claim:{subject, measure, comparison}, provenance,
  fallbackAction, defaultCopy?:string }.
  - **`.strict()`** on every object so unknown fields (e.g. a stray `color`/`score`) THROW —
    this is how CONSTRAINT-001/-008 leakage is caught structurally.
- `ChapterContractSchema` { schemaVersion:'1.0', chapterId, findings:[Finding], degraded:boolean,
  provenanceSummary:[{source,asOf}] }.
- Export `chapterContractJsonSchema` via `zod-to-json-schema` for the future frontend.
- Export a `safeBuild(chapterId, buildFn)` helper: runs buildFn, `parse`es, and on throw →
  `logError` + `recordDegradation({label:\`contract-${chapterId}\`, kind:'error'})` → returns null.
  Crash-safety is the contract (mirrors degradationLedger discipline).

**T2 — Utilities contract builder.** `src/modules/utilities/contract.js`:
- `buildUtilitiesContract(u)` where `u` = `assembleUtilities(...)` output.
- Map to findings:
  - `electric-rate` (when rate present): measure cents/kWh, comparison vs `stateAvgRate`,
    tone from the existing rate-delta (below→favorable, near→neutral, above→caution),
    bucket `consider`. provenance from `u.electricSource`.
  - `electric-provider` (provider/ownership): qualitative, tone neutral, bucket `cool`.
  - `electric-missing` path → fallbackAction = OpenEI/PSC (the 015 fallback we render today).
  - `ev-charging`, `internet-band` similarly (tone from the band, provenance from source).
- Tone derivation lives here (logic→tone mapping), NOT color. (We do NOT yet rip `color` out of
  `logic.js` globally — pilot keeps logic untouched and derives tone in the contract builder; the
  global color→tone refactor is a documented follow-up so the pilot stays bounded.)
- Wrap via `safeBuild('utilities', () => ChapterContractSchema.parse({...}))`.

**T3 — Serialize boundary + endpoint.**
- `reportBuilder`: additionally assemble `contract` (pilot: utilities migrated; other chapters
  emitted as `{ schemaVersion: null, chapterId, raw: … }` placeholders so the endpoint is whole).
  Keep `html` (additive, non-breaking).
- Route: `GET /api/report.json?address=…` (or `?format=json`) in the server layer → returns the
  contract. Reuse the existing address→report path so it sits behind rate-limit + cost-breaker +
  FR-058 cell cache. Read-only GET.

**T4 — Render-from-contract (sufficiency proof).**
- Add a thin `renderUtilitiesFromContract(contract)` (reference renderer, explicitly throwaway)
  OR re-point the existing `buildUtilitiesIntelHTML` to consume the contract. Minimal markup —
  no design investment. If a needed field is absent → fix the schema/builder, not the renderer.
- Goal: prove the contract carries everything the UI needs. Keep the old template path working
  during the pilot (feature-parity, not deletion).

**T5 — Tests.**
- `tests/contract/schema.test.js`: `.strict()` rejects an unknown field (e.g. `color`/`score`);
  enums enforced; a forbidden numeric `score` field throws.
- `tests/modules/utilities/contract.test.js`: `buildUtilitiesContract` produces schema-valid
  output for fixtures covering: full NREL, HIFLD-fallback (provenance HIFLD), electric-missing
  (fallbackAction present), EV present/absent, internet band. **Snapshot** the contract per the 5
  test addresses incl. **Jeffersonville IN**.
- Schema-drift crash-safety: a builder that emits a bad field → `safeBuild` returns null, no throw,
  degradation recorded.
- Endpoint test: `GET /api/report.json` returns 200 + schema-valid body (mock the data layer).
- Render-from-contract: asserts key facts (utility name, rate, fallback link) still appear.

**T6 — Verify & document.** Full suite green; `summary.md` (deps, ADR recap, snapshot note,
`defaultCopy`-is-transitional callout, rollout pointer).

**T7 — Ship.** Branch `FR-078-headless-report-contract`, commit, push, PR; roadmap fold-in.

## Risks
| # | Risk | Mitigation |
|---|---|---|
| R1 | `.strict()` breaks on a field we legitimately need later. | Additive: add the field to the schema deliberately. `.strict()` is the point — it forces intent. |
| R2 | Snapshot churn on every data tweak. | Snapshots are per-fixture (deterministic mocks), not live API — stable. Live addresses use field-shape assertions, not value snapshots. |
| R3 | Endpoint exposes a new public surface. | Reuse existing rate-limit + cost-breaker chokepoints; GET-only; no new auth surface. Document. |
| R4 | Scope creep into ripping `color` out of all logic. | Explicitly deferred: pilot derives tone in the contract builder; global color→tone is a follow-up FR. |
| R5 | `defaultCopy` quietly becomes permanent. | AC-9: code comment + follow-up issue; it is scaffolding. |
| R6 | New dep (zod) supply-chain / size. | zod is mainstream, zero-native-dep, widely audited. Documented. |

## Non-goals (restate)
Other 13 chapters; the frontend + its framework; TypeScript; GraphQL; deleting `defaultCopy`;
global logic `color`→`tone` refactor.

## Phase 3 exit
No code changed. Execute T0–T7 on the branch; check in after T2 (schema + builder proven on
utilities) — the critical-path validation — before wiring the endpoint/renderer.
