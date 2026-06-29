# FR-099 — Atomic writes for the error-memory store

## Problem

`src/errorMemory.js` persists two JSON files via full-file overwrite:

- `data/mitigations.json` — a read-modify-write: `loadMitigations()` → mutate → `fs.writeFileSync` (lines 92–111).
- `data/error-patterns.json` — full overwrite at line 88.

`fs.writeFileSync` is not atomic. If the process is killed mid-write (deploy restart,
crash, power loss), the file is left torn: the previous good copy is gone and the new
one is incomplete. The next `loadMitigations()` then hits `JSON.parse` on a partial
file. The error is caught and the value self-heals to `{}` — which silently discards
every mitigation the system had learned and applied. The diagnostic
`error-patterns.json` can likewise be left half-written and misleading if inspected.

This is the same read-modify-write / torn-write smell `src/services/reportStore.js`
already shed (NR-004), where `atomicWrite()` (temp sibling + `rename`) was introduced.

## Out of scope (deliberate)

- **`src/logger.js` is NOT changed.** It writes via `appendFileSync`. Appends don't
  clobber existing data, and a torn trailing line is already skipped by
  `readRecentLogs` (`try { JSON.parse(line) } catch { skip }`). It is already
  torn-write-safe; changing it would be scope creep. (The hand-off named
  "logger / errorMemory"; on inspection only errorMemory has the exposure.)
- No behavior change to mitigation rules, thresholds, or analysis logic.
- The async `atomicWrite()` in reportStore.js is left as-is; errorMemory is synchronous
  and fire-and-forget, so it gets a sync sibling rather than being made async.

## Inputs / Outputs

No change to public behavior. The functions exported by `errorMemory.js`
(`getMitigation`, `analyzeAndMitigate`, `loadMitigations`) keep identical signatures
and observable results. The only change is *how* the two files reach disk: via a
temp-file + atomic-rename instead of an in-place overwrite.

## Edge cases

- **mkdir still required** — the temp file is written into the target directory, so
  `data/` must exist first. The existing `mkdirSync(DATA_DIR, { recursive: true })`
  calls are preserved.
- **Write/rename failure** — the temp file (random suffix) must not be orphaned; the
  helper cleans it up best-effort and rethrows the original error. errorMemory's
  existing `try { … } catch { /* best-effort */ }` wrappers still swallow it so
  analysis never crashes the app.
- **Concurrent writers** — single-instance today; rename is last-writer-wins, which
  matches the existing `writeFileSync` semantics (no regression).

## Acceptance criteria

1. `errorMemory.js` writes both `mitigations.json` and `error-patterns.json` through a
   sync atomic helper (temp + `renameSync`), not `writeFileSync` directly.
2. A killed write can never leave the target file torn: the target is only ever
   replaced by a complete file via `rename`.
3. The helper removes its temp file and rethrows if the write or rename fails (no
   orphaned `*.tmp.*` files).
4. New unit test in `tests/shared/atomicFile.test.js` covers: correct content written,
   no leftover temp file on success, temp cleaned + original preserved on rename
   failure.
5. Full suite stays green (1,929 tests). Per CONSTRAINT-011, the new helper has tests.

## Module

Shared utility (`src/shared/atomicFile.js`) consumed by `src/errorMemory.js`. No
chapter module or API surface is touched, so the 5-address render test is not
applicable; the change is covered by unit tests instead.
