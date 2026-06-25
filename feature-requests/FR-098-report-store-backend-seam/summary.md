# FR-098 — Summary

Made the report-store seam genuinely swappable so a future external backend is "write one class, pass
the existing contract tests, flip one config value" — without building any real external backend (that
stays host-gated). The rehearsal (an in-memory backend run through the same contract suite) exposed **no**
divergence, so no spec revision was needed.

## What shipped (all in `src/services/reportStore.js` + tests)

- **Documented contract (AC-1).** A JSDoc `@typedef ReportStore` describing the five methods plus their
  behavioral rules (null on miss/corrupt/empty-stub, atomic last-writer-wins, copy-not-reference,
  idempotent `ensureMigrated`). The executable form is the contract suite below.
- **Backend-agnostic contract suite (AC-2).** `tests/services/reportStoreContract.js` exports
  `runReportStoreContract(makeStore, label)` — 7 behavioral tests. Run unchanged against both backends.
- **`InMemoryReportStore` (AC-3).** Map-backed, mirrors `FileReportStore`'s observable behavior (JSON
  deep-copy boundary, empty-stub→null, reserved `mintId`, `touch`, no-op `ensureMigrated`). Passes the
  contract identically to the file backend. Logged `// shortcut:` — intentionally non-durable; it is a
  test/rehearsal backend + the template a real backend copies, not production.
- **`createReportStore(env)` selector (AC-4).** `LIVABLY_REPORT_STORE` → `file` (default) | `memory`;
  unknown value throws (fail fast, no silent fallback). The one switch a future external backend
  registers into. The singleton is now `createReportStore(process.env)` (AC-5).

## Leak audit (AC-6) — the walk-through

`git grep` over `src/` for `data/reports` / `reports.json` / `new FileReportStore` / `new
InMemoryReportStore` / `createReportStore` / `require(...reportStore)`. Result: **zero bypass.** Every
consumer reaches the store only through the wrapper functions:
- `src/app.js` → imports `resolveSharedReport` only.
- `src/services/reportBuilder.js` → imports `saveReport`, `putArtifact` only.
All store construction and all `data/reports` path references live inside `reportStore.js`.

## Verification

- `tests/services/reportStore.test.js`: 35 passed (17 pre-existing + 14 contract [7×2 backends] + 4
  selector).
- Full suite: **105 suites / 1929 tests passed** (was 1911 after FR-097; +18).
- 5-address matrix N/A — service-layer change, not a location-searching module (CONSTRAINT-011's
  5-address rule targets modules that search by location). Covered by unit + contract tests.
- **No new npm dependency; no external backend / host infra introduced** (AC-8).

## Process

Full brainstorm → spec → plan → TDD execution. Each new behavior (in-memory backend, selector) was
watched failing first for the correct reason. No phases skipped.

## Deferred (host-gated — "moving day")

- The real external backend (`PostgresReportStore` / object storage) + provisioning, pooling, schema,
  IaC. Built once the host is chosen; it implements `ReportStore`, passes the existing contract suite,
  and registers as one `case` in `createReportStore`.
- Redis / cache externalization (`src/cache.js`) — separate concern, separate FR.
- Making `InMemoryReportStore` durable — intentionally out of scope (it is not the host backend).

## Shortcut logged (for SHORTCUTS.md / roadmap)

`src/services/reportStore.js` — `InMemoryReportStore` is intentionally non-durable (state lost on process
restart). Ceiling: not a production/multi-instance backend. Revisit trigger: never, unless a real
in-memory production store is genuinely needed — the host backend this seam exists for is the real fix.
