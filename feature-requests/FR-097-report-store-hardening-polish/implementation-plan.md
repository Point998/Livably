# FR-097 — Implementation plan

Single file: `src/services/reportStore.js`. Single test file: `tests/services/reportStore.test.js`.
Strict TDD: one failing test per fix, watch it fail for the right reason, minimal code to green.

## Task order (independent fixes; ordered by blast radius)

### Task 1 — M-3: migration retry on rejection (highest value; latent bug on main)
- **RED:** test — spy `_migrate` to reject once then succeed; first `ensureMigrated()` rejects, second
  resolves; assert `_migrate` called twice. Also assert a successful migration is memoized (called once
  across two calls).
- **GREEN:** in `ensureMigrated`, attach a `.catch` that nulls `this._migrated` then rethrows.

### Task 2 — M-2: atomicWrite temp cleanup on failure
- **RED:** test — force rename to fail by targeting an existing directory (temp writes fine, rename
  throws); assert it rejects AND no `.tmp` file remains in the dir.
- **GREEN:** wrap write+rename in `try`; on `catch`, `unlink(tmp).catch(() => {})` then `throw err`.

### Task 3 — M-4: putArtifact defensive destructure
- **RED:** test — `saveReport`, capture `createdAt`, then `putArtifact` with stray `address`/`createdAt`
  plus a real `html`; assert canonical `address`/`createdAt` survive and `html` merged.
- **GREEN:** destructure `{ address, createdAt, ...safe } = artifact || {}`; merge `...safe`.

### Verification
- Run `tests/services/reportStore.test.js` after each task (watch RED, then GREEN).
- Run full suite (`npm test`) at the end — expect 105 suites green, count up by 3 tests.

## Risks / unknowns
- **Cross-platform rename-onto-dir failure (M-2 RED):** renaming a file onto a directory throws on both
  POSIX (EISDIR/ENOTEMPTY) and Windows (EPERM/EEXIST). The test asserts "rejects + no orphan", not a
  specific errno, so it's platform-agnostic.
- **M-3 concurrency:** resetting `_migrated` only affects calls made *after* the in-flight promise
  settles; concurrent first callers still share the one rejection. Acceptable and intended.
- **Optional logger/errorMemory atomic-write:** out of plan; only if budget remains after green.
