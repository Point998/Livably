# FR-099 — Implementation plan

Ordered by layer. This is a shared-utility + store change; there is no data/logic/
template split to traverse.

## Task 1 — Shared helper (new)

`src/shared/atomicFile.js`

```js
const fs = require('fs');
const crypto = require('crypto');

// Write to a temp sibling then rename over the target. rename(2) is atomic on the same
// filesystem, so a reader never sees a torn file and a crash mid-write leaves the
// previous version intact. Sync sibling of services/reportStore.js atomicWrite(), for
// the best-effort synchronous error-memory writes.
function atomicWriteFileSync(filePath, data) {
  const tmp = `${filePath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
  try {
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* temp may not exist; surface the original error */ }
    throw err;
  }
}

module.exports = { atomicWriteFileSync };
```

Why a new sync helper instead of reusing `reportStore.atomicWrite`: that one is async
(fs.promises) and lives in the report-store domain. errorMemory is synchronous and
fire-and-forget; converting it to async would ripple through `analyzeAndMitigate` and
the `setImmediate` caller in logger for zero benefit. Build-vs-Borrow: the existing
helper is the wrong shape, and the sync version is ~10 lines — write the lines.

## Task 2 — Repoint errorMemory's two writes

`src/errorMemory.js`

- `require` the helper.
- `saveMitigations` (line 28): `fs.writeFileSync(MITIGATIONS_FILE, …)` →
  `atomicWriteFileSync(MITIGATIONS_FILE, …)`. Keep the `mkdirSync` guard.
- `analyzeAndMitigate` patterns write (line 88): `fs.writeFileSync(PATTERNS_FILE, …)`
  → `atomicWriteFileSync(PATTERNS_FILE, …)`. Keep the `mkdirSync` guard.
- Leave the surrounding `try { … } catch { /* best-effort */ }` wrappers intact.

## Task 3 — Test

`tests/shared/atomicFile.test.js` — write to an OS temp dir (no project `data/`
pollution):

1. Writes exact content to the target.
2. Overwrites an existing file with the new complete content.
3. Leaves no `*.tmp.*` sibling after a successful write.
4. On rename failure (target path is a directory, or parent removed), the temp file is
   cleaned up and the original target is left intact / the error propagates.

## Risks / unknowns

- **Windows `renameSync` over an existing file** — Node's `fs.renameSync` replaces an
  existing destination on Windows (unlike the raw POSIX rename caveats), matching the
  report-store helper already in production. Low risk; covered by test case 2.
- No API/address-dependent behavior, so the 5-address matrix doesn't apply; unit tests
  are the coverage.

## Verification

- `npx jest tests/shared/atomicFile.test.js` green.
- Full `npm test` green (no regression in the 105 suites).
