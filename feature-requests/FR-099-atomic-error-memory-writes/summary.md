# FR-099 — Summary

## What shipped

Atomic writes for the error-memory store, closing the read-modify-write / torn-write
smell flagged in NR-004 (the same one `reportStore.js` already shed).

- **New** `src/shared/atomicFile.js` — `atomicWriteFileSync(filePath, data)`: writes a
  temp sibling then `renameSync` over the target. The target is only ever replaced by a
  complete file, so a crash mid-write leaves the previous good copy intact. On
  write/rename failure the temp file is cleaned up best-effort and the original error is
  rethrown. Synchronous sibling of the async `reportStore.atomicWrite()`.
- **Changed** `src/errorMemory.js` — both full-file overwrites now route through the
  helper: `mitigations.json` (`saveMitigations`) and `error-patterns.json`
  (`analyzeAndMitigate`). The `mkdirSync` guards and best-effort `try/catch` wrappers
  are unchanged.
- **New** `tests/shared/atomicFile.test.js` — 4 tests: exact content, overwrite of an
  existing file, no orphaned temp on success, and temp cleanup + original-preserved +
  rethrow on rename failure.

## Deliberately NOT changed

`src/logger.js` — it appends via `appendFileSync`; appends don't clobber existing data
and a torn trailing line is already skipped by `readRecentLogs`. It is already
torn-write-safe, so touching it would have been scope creep. The hand-off named
"logger / errorMemory"; inspection narrowed the real exposure to errorMemory alone.

## Verification

- `npx jest tests/shared/atomicFile.test.js` — 4/4 pass.
- `npm test` — 106 suites / 1,933 tests pass (was 1,929; +4 new). No regression.

## Why no 5-address test

The change is a pure I/O-durability utility with no API calls, no address-dependent
behavior, and no chapter/template surface. CONSTRAINT-011's location-search clause
(Jeffersonville IN regression case) doesn't apply; unit tests are the appropriate
coverage. No new npm packages.

## Notes / follow-ups

- No new shortcuts introduced. The async `reportStore.atomicWrite()` and the sync
  `atomicFile.atomicWriteFileSync()` are intentionally two small helpers (different
  call shapes) rather than one — unifying them would mean making errorMemory async for
  no benefit.
