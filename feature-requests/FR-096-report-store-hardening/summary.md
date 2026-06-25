# FR-096 — Summary

**Status:** complete. Report store hardened, artifacts persisted, `/r/:reportId` now serves stored
output instead of re-rendering. Backend-agnostic (NR-004 Hardening Stage 1 seam) — no deploy/backend
decision required; the external backend remains a deferred non-goal behind the new seam.

## What shipped

- **Per-report-file storage.** `src/services/reportStore.js` rewritten from a single `data/reports.json`
  map to one atomic file per report (`data/reports/<id>.json`). Eliminates the NR-004 🔴 read-modify-write
  race/lost-update finding entirely (no shared map), and avoids parsing every report (incl. HTML) on each read.
- **Atomic writes** via temp-file + `rename`; `mintId` reserves ids by exclusive-create (`wx`).
- **Async `FileReportStore` seam** (`mintId`/`put`/`get`/`touch` + lazy idempotent `ensureMigrated`),
  with a module singleton and async wrappers `saveReport`/`getReport`/`updateReportAccess` +
  new `putArtifact` and `resolveSharedReport`. A future `PostgresReportStore`/object-store implements the
  same class shape with no caller changes. Storage root overridable via `LIVABLY_REPORTS_DIR`.
- **Idempotent legacy migration** — a one-time `data/reports.json` → per-file split, retiring the legacy
  file to `.bak`, memoized once per instance.
- **Artifact persistence.** `buildReport` persists `{ html, contract, generatedAt, schemaVersion, degraded }`
  after assembly (contract JSON = source of truth, `html` = derived cache). Non-fatal (CONSTRAINT-015).
- **`/r/:reportId` serves the stored artifact** directly (no re-render); falls back to the address-redirect
  when no artifact is present; 404 on unknown id. Handler is now `async` via `resolveSharedReport`.

## Persistence is gated to the share-served path (final-review I-1)

`buildReport` takes a `persist` option (default **true**). The HTML `/report` route and `/compare`
persist as before; the **`/api/report.json` route opts out** (`{ persist: false }`) because it never
exposes a `reportId` — otherwise every JSON API call would orphan a full ~100–300 KB artifact file.
When `persist` is false, neither the id mint nor the artifact write happens.

## Process

4-phase workflow (spec → plan → subagent-driven implementation) + TDD throughout. Six tasks, each with a
fresh implementer + a spec/quality task review; then an opus whole-branch review (verdict: merge-with-fixes)
and a re-reviewed fix wave. **105 suites / 1907 tests green** (was 1897 at FR-095 merge). No new npm dependency.

## Explicit non-goals (deferred — "the bridge" + a follow-up FR)

- **The external storage backend** (Postgres / object store) + provisioning/config — the deferred deploy decision.
- `/report?address=` serve-from-store (needs the deferred identity/dedup decision); TTL/eviction of artifacts;
  report versioning.
- **Low-impact hardening carried to a follow-up FR** (final-review Minors, all benign for a single-instance
  file store): `atomicWrite` temp-unlink on write failure (M-2); `_migrate` resetting its memoized promise on
  rejection so migration can retry (M-3); `putArtifact` defensive destructure so a stray artifact key can't
  overwrite `address`/`createdAt` (M-4). Atomic-writing the other file stores (logger, errorMemory) also remains
  a separate NR-004 item.
