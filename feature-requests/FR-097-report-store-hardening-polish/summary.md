# FR-097 — Summary

Closed the three residual hardening gaps FR-096 left open (session-12 hand-off). All three fixes live in
`src/services/reportStore.js`, below the `ReportStore` seam, so they stay with `FileReportStore` after
the future external-backend extraction — no rework. Strict TDD: each fix got a failing-first test.

## What changed

- **M-3 (latent bug on main) — migration no longer bricks the store.** `ensureMigrated` now resets its
  memoized promise on rejection, so a transient migration failure (disk full, FS error) is retried on the
  next call instead of being replayed forever. Successful migrations still memoize (run once).
  `reportStore.js:31-41`.
- **M-2 — `atomicWrite` cleans up its temp on failure.** Write+rename wrapped in `try`; on failure the
  random-named `.tmp` is best-effort `unlink`ed (its own error swallowed so the original propagates),
  preventing slow disk-fill under repeated write failures. `reportStore.js:10-21`.
- **M-4 — `putArtifact` can't clobber identity/lifecycle.** Strips `address`/`createdAt` from the incoming
  artifact before merging, so a stray key can only ever carry rendered/derived fields. `reportStore.js`.

## Tests (TDD, all RED-first verified)

`tests/services/reportStore.test.js` — 4 new cases (3 behavior + 1 memoization regression guard):
- atomicWrite removes the temp file when rename fails (no orphaned `.tmp`).
- a failed migration is not cached permanently — a later call retries.
- a successful migration runs once and stays memoized (guard for the M-3 change).
- putArtifact ignores stray `address`/`createdAt`; canonical identity survives.

Each behavior test was watched failing for the correct reason before implementation.

## Verification

- `tests/services/reportStore.test.js`: 17 passed.
- Full suite: **105 suites / 1911 tests passed** (was 1907; +4).
- 5-address regression matrix: N/A — this is a service-layer change, not a location-searching module
  (CONSTRAINT-011's 5-address rule targets modules that search by location). Covered by unit tests.

## Phases

Full 4-phase workflow followed: Discovery (read `reportStore.js` + tests, confirmed all three gaps) →
Spec → Plan → TDD implementation. No phases skipped.

## Deferred (recommended next)

- Optional same-theme follow-on: atomic-write the *other* file stores (logger, errorMemory). Held out of
  scope here per FR-096's "separate FR" note; clean candidate for a quick follow-up.
- The external-backend bridge — the deferred strategic move this hardening precedes. The store seam is
  now clean to extract an interface from.
