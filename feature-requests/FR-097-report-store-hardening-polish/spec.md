# FR-097 — Report store hardening polish (M-2/M-3/M-4)

## Summary

Close the three loose ends FR-096 deliberately left open (session-12 hand-off). All are small,
self-contained robustness fixes inside `src/services/reportStore.js`, *below* the `ReportStore` seam —
they belong to the `FileReportStore` implementation and stay with it after the future external-backend
extraction, so doing them now is not rework. M-3 in particular is a latent correctness bug on `main`
today: a failed migration permanently bricks the store.

## Background / current behavior

FR-096 (#67) shipped the per-file store, the seam, and artifact persistence. Its review surfaced three
residual gaps, none of which break the happy path but each of which degrades a failure path:

- **M-2 — orphaned temp on write failure.** `atomicWrite` (`reportStore.js:10-14`) writes a
  randomly-named `<file>.tmp.<hex>` then `rename`s it over the target. If `writeFile` partially writes
  or `rename` throws (target is a dir, cross-device, permissions), the random-named temp is leaked with
  no way to find it again — a slow disk-fill under repeated failures.
- **M-3 — migration can permanently brick the store.** `ensureMigrated` (`reportStore.js:31-34`)
  memoizes `this._migrate()`. A *rejected* promise is cached forever, so every subsequent `get`/`put`/
  `mintId` (all call `ensureMigrated` first) re-returns the same rejection even after a transient cause
  (disk full, transient FS error) has cleared. The store is dead for the process lifetime.
- **M-4 — artifact can clobber identity/lifecycle fields.** `putArtifact` (`reportStore.js:107-111`)
  spreads `...artifact` over the existing record, so a stray `address` or `createdAt` key inside the
  artifact silently overwrites the canonical value.

## Module

`src/services/reportStore.js` only. No callers change. No public signatures change. Three-layer chapter
rules don't apply (service, not a chapter).

## Design

### M-2 — best-effort temp cleanup
Wrap the write+rename in `try`; on failure `unlink` the temp (best-effort, swallow its error so the
*original* failure is the one that propagates), then rethrow. Preserves atomic-rename semantics on the
happy path; adds cleanup only on the error path.

### M-3 — reset the memoized promise on rejection
Keep memoization (concurrent callers must share one in-flight migration; a *successful* migration stays
memoized so it runs once). On rejection, clear `this._migrated` so the next call retries instead of
replaying the cached rejection. Concurrent callers awaiting the in-flight promise all still see the
rejection; only calls *after* it settles retry.

### M-4 — defensive destructure
Strip `address` and `createdAt` from the incoming artifact before merging, so artifact payload can only
ever carry rendered/derived fields (`html`, `contract`, `generatedAt`, `schemaVersion`, `degraded`),
never identity (`address`) or creation lifecycle (`createdAt`). `lastAccessed` is owned by `touch()` and
is out of scope here (noted, not fixed — see non-goals).

## Inputs / outputs

No interface change. Behavior changes only on failure/edge paths:
- `atomicWrite(filePath, data)` — on write/rename failure, leaves **no** `.tmp` orphan; still throws.
- `ensureMigrated()` — after a rejected migration, a subsequent call **retries** rather than re-rejecting.
- `putArtifact(id, artifact)` — `artifact.address` / `artifact.createdAt` are **ignored**; the stored
  record keeps its canonical `address`/`createdAt`.

## Edge cases

- **M-2:** `unlink` of the temp itself fails (already gone / permissions) → swallowed; original error
  still propagates. Happy path unchanged: no temp remains after a successful rename (already true).
- **M-3:** migration succeeds → memoized once, never re-runs (unchanged). Migration rejects then a retry
  succeeds → store recovers. Concurrent first callers all get the rejection, then recover on next call.
- **M-4:** artifact with no `address`/`createdAt` → behaves exactly as today. Record had no prior
  `createdAt` (artifact-before-stub edge) → the `|| { createdAt: now, lastAccessed: now }` default still
  supplies one; stripping the artifact's stray `createdAt` does not remove the defaulted one.

## Acceptance criteria

- **AC-1** A failed `atomicWrite` (write or rename) leaves no `.tmp` file in the directory and still
  rejects with the original error.
- **AC-2** A successful `atomicWrite` still leaves no `.tmp` behind (existing test stays green).
- **AC-3** After `_migrate` rejects once, a subsequent `ensureMigrated()` call invokes `_migrate` again
  (retry) and can succeed; a successful migration is still memoized (runs once).
- **AC-4** `putArtifact` ignores `address` and `createdAt` supplied in the artifact; the stored record
  retains its canonical `address`/`createdAt` while other artifact fields (e.g. `html`) are merged.
- **AC-5** All existing `reportStore.test.js` cases stay green; full suite green.

## Constraint check

- **CONSTRAINT-011 (tests):** each fix gets a failing-first test. ✓
- **CONSTRAINT-015 (graceful degradation):** M-3 directly improves degradation (transient failure no
  longer permanent). ✓
- **No scoring / Fair Housing / design-layer / cross-state constraints** apply (service layer). ✓
- **NR-004 alignment:** hardens the Stage-1 store seam before the external-backend bridge builds on it. ✓

## Non-goals

- Atomic-writing the other file stores (logger, errorMemory) — same theme, optional follow-on; only
  done if M-2/M-3/M-4 land cleanly and there's session budget.
- Protecting `lastAccessed` in `putArtifact` (owned by `touch`; no caller passes it; out of scope).
- The external-backend bridge itself (the deferred strategic move this hardening precedes).
- TTL / eviction / size caps (unchanged from FR-096 non-goals).
