# FR-078 — Summary: Headless Report Contract (utilities pilot)

**Phase 4 — Implementation complete.**
Date: 2026-06-21
Branch: `FR-078-headless-report-contract`

---

## What shipped

The first slice of making Livably **headless**: a versioned, presentation-free report **contract**
with a Zod single-source-of-truth, proven end-to-end on the **utilities** chapter. The backend can
now serve report data as JSON; the frontend will be built separately against this contract.

### New
- **`src/contract/schema.js`** — Zod schemas (the single source of schema truth):
  `Bucket`/`Tone` enums, `Measure`/`Comparison`/`Provenance`/`FallbackAction`/`Claim`/`Finding`/
  `ChapterContract`. **`.strict()` on every object** so a stray `color`/`score`/demographic field
  THROWS at parse — CONSTRAINT-001/-002/-008 become structural, not review-enforced. Exports
  `chapterContractJsonSchema` (via `zod-to-json-schema`) for the future frontend's types, and a
  crash-safe `safeBuild(chapterId, fn)` (validates; on throw → `logError` + `recordDegradation`
  → returns null, never crashes a report).
- **`src/modules/utilities/contract.js`** — `buildUtilitiesContract(assembled, opts)` maps the
  existing `assembleUtilities(...)` output → validated findings. Tone derived here from existing
  signals (rate delta, internet band) — never a color.
- **`src/modules/utilities/contractRenderer.js`** — a deliberately-minimal **throwaway reference
  renderer** that proves the contract carries everything a UI needs (semantic classes, no inline
  styles, tone→visual left to CSS). NOT the product UI.
- **`GET /api/report.json?address=…`** — returns the report contract; behind the existing
  metered limiter + cost-breaker + FR-058 cell cache; typed JSON error envelope.

### Changed (additive, non-breaking)
- `reportBuilder` now also returns `contract` alongside `html` (utilities chapter migrated; other
  chapters follow the same per-module `contract.js` pattern). HTML path untouched.

## The contract shape (v1)

Every finding: `{ id, bucket (consider|check|cool), tone (favorable|neutral|caution), claim
{subject, measure, comparison}, provenance {source, asOf, modeled}, fallbackAction?, defaultCopy? }`.
- **Structured claim, not prose.** `defaultCopy` rides along as **transitional scaffolding only**
  (flagged in schema comments; deleted when the frontend owns voice — AC-9).
- **CONSTRAINT-015 is now a contract field** — missing data emits a populated `fallbackAction`.

## Key decisions (ADRs, see discovery.md)
- **REST + Zod now; GraphQL only on consumer-count > 1.** The contract is a pure view-model, so
  GraphQL stays a cheap future bolt-on — no lock-in.
- **Zod = anti-drift mechanism** (runtime validation + exported types without adopting full TS),
  backed by snapshot tests. This is the part that has to scale to 14 chapters + 2 codebases.
- **Pilot via reference renderer**, not re-pointing the rich production template — wholesale
  template re-pointing belongs to the per-chapter frontend rebuild, not the pilot (lower risk,
  doesn't destabilize the 100+ existing utilities template tests).

## Tests
- `tests/contract/schema.test.js` (12): `.strict()` rejects `color`/`score`/`grade`; enum
  enforcement; `schemaVersion` pinned; `safeBuild` crash-safety + degradation recording.
- `tests/modules/utilities/contract.test.js` (24 incl. above split): builder valid across
  full-NREL / below-avg / HIFLD / all-missing; tone derivation; no score/color in output;
  fallbackAction on missing data; **per-address snapshots incl. Jeffersonville IN** (CONSTRAINT-011);
  reference-renderer sufficiency + no-inline-styles.
- **Full suite: 89 suites / 1,686 tests green** (1,662 baseline + 24), 3 snapshots.

## New dependencies
- `zod` (schema + runtime validation) and `zod-to-json-schema` (frontend type export). Mainstream,
  zero-native-dep. (`npm audit` shows pre-existing advisories unrelated to these two.)

## Endpoint verification note
`/api/report.json` is a thin wrapper over `buildReport` (which is integration-tested) + the
unit-tested contract builder; no `supertest` harness exists and a live call needs the IP-restricted
Google key (403 from dev, pre-existing). Wrapper logic syntax-checked + manually reviewed; full
live verification is a deploy-time check.

## Rollout (next, per chapter, additive)
`<module>/contract.js` + Zod conformance + per-address snapshot, then the frontend renders it.
`schemaVersion` bumps only on breaking changes. When all 14 are migrated, `buildReportHTML`
becomes the throwaway reference renderer and the frontend takes over.

## Follow-ups (tracked, not done)
- Delete `defaultCopy` once the frontend owns voice.
- Global `logic.js` `color` → `tone` refactor (pilot derived tone at the contract boundary).
- Migrate the remaining 13 chapters.
- Decide the frontend rendering strategy (SSG/SSR vs SPA) given "delivered as a web link".
