# FR-063 — Source-Verification Harness · Specification

*Phase 2. June 2026. Approved design — brainstorm decisions locked below.*

## Summary

A standalone monitor, `npm run verify:sources`, that proves each live external
data source returns *real* data for the 5 test addresses, surfacing dead sources
that graceful degradation otherwise hides. Self-discovering via a `SOURCES`
descriptor each `data.js` exports. Runs scheduled + on-demand in CI (never on
push/PR) and locally.

## Module ownership

This is **cross-cutting tooling**, not a chapter. It lives in `scripts/` and a
small pure-logic module, and it *reads from* every `src/modules/*/data.js`. It
does not add a chapter, does not touch templates, and makes no business-rule
decisions about report content.

## Locked decisions (from brainstorm)

1. **Descriptor model (Option B)** — each `data.js` exports a `SOURCES` array the
   harness auto-discovers. No central registry to keep in sync.
2. **Standalone** — `npm run verify:sources`, separate from Jest. Jest never makes
   live calls.
3. **Verdict policy — per-source coverage expectation**:
   - `coverage: 'all'` → source must be valid at **every** address; invalid at ≥1 → **FAIL**.
   - `coverage: 'some'` → invalid at **all 5** → **FAIL**; invalid at 1–4 → **INFO**.
4. **Cadence** — scheduled GitHub Actions workflow (cron, weekly) + `workflow_dispatch`
   + local. **Never** push/PR.
5. **Scope** — **every external endpoint** is catalogued, including unkeyed ones
   (WBD, USGS seismic, USGS elevation) — the silent-failure risk is highest there.
6. **FCC/broadband** — `SKIPPED (deferred)` descriptor (FR-062), never FAIL.
7. **Missing optional key** — dependent sources report `SKIPPED (no key)`, never FAIL.

## The source descriptor (contract)

Each `src/modules/<name>/data.js` adds:

```js
const SOURCES = [
  {
    id: 'noaa-normals',                 // unique within the module
    label: 'NOAA CDO 30-yr normals',    // human-readable for the matrix
    coverage: 'all' | 'some',           // verdict expectation
    requiresKey: 'NOAA_CDO_API_KEY',    // optional; if set & blank → SKIPPED (no key)
    status: 'active' | 'deferred',      // optional; 'deferred' → SKIPPED (deferred)
    run: (ctx) => getNOAAClimateNormals(ctx.lat, ctx.lng),  // adapts ctx → real call
    isValid: (result) => Array.isArray(result?.monthly) && result.monthly.length === 12,
    // probe — OPTIONAL; see "swallow-to-empty" below
  },
  // ...one entry per external endpoint
];
module.exports = { /* existing exports */, SOURCES };
```

### Swallow-to-empty sources (the blind spot, and the fix)

Some module fetchers catch their own transport errors and return the **same**
value a legitimate-empty result would. `getFEMADeclarations` returns `[]` both
when a county genuinely has no declarations **and** when the endpoint is dead.
For these, `isValid` alone cannot distinguish an outage from real emptiness — so
a dead source would falsely read `OK`, defeating the purpose of this FR.

This blind spot is **narrow**: the outages that motivated FR-063 (FCC 405, NREL
DNS, NOAA dead) all return `null` or throw, so an `isValid` that requires a real
shape already catches them. Only sources whose failure value equals a legitimate
value (`[]`-on-both) are affected.

**Fix — optional `probe(ctx)`**: a source whose `isValid` can't distinguish
failure from empty supplies a lightweight reachability probe that hits the
endpoint and returns `true`/`false` from the actual HTTP status (independent of
the module's swallowing fetcher). When present, a cell is `OK` only if
`probe(ctx)` is reachable **and** `isValid(run(ctx))` passes; an unreachable
probe → `FAIL` regardless of the empty payload. Most sources omit `probe` and
rely on `isValid` alone. FEMA-class sources (FEMA, NOAA storm-events pre-cache,
any other `[]`-on-both) supply one.

The generalized version of this — every swallowed failure visible on a dashboard
— is the NR-004 Stage 2 observability layer and remains out of scope; `probe`
is the targeted down-payment.

### Descriptor field semantics

| Field | Required | Meaning |
|-------|----------|---------|
| `id` | yes | Unique within the module. Matrix row key (namespaced by module). |
| `label` | yes | Display name. |
| `coverage` | yes | `'all'` or `'some'` — drives verdict. |
| `requiresKey` | no | env var name. If named and blank → all addresses `SKIPPED (no key)`. |
| `status` | no | defaults `'active'`. `'deferred'` → all addresses `SKIPPED (deferred)`. |
| `run(ctx)` | yes | Calls the module's real fetcher with context-mapped args. |
| `isValid(result)` | yes | Content check. Returns true only for reachable + real-shaped data. `[]` is valid where empty is legitimate (coverage:'some'). |
| `probe(ctx)` | no | Reachability check (HTTP status) for swallow-to-empty sources whose `isValid` can't tell failure from empty. When present: cell `OK` iff probe reachable AND `isValid` passes. See "Swallow-to-empty sources". |

## Inputs

### Per-address context (`ctx`)
Resolved once per test address before any source runs, reusing existing shared helpers:

```js
ctx = {
  address,                       // the raw test address string
  lat, lng,                      // geocodeAddress(address)
  state, county,                 // reverseGeocodeAddress({lat,lng}) — 2-letter state, "X County"
  fips: { state, county, tract } // getCensusFIPS(lat, lng) — numeric FIPS (may be null)
}
```

The 5 test addresses (CLAUDE.md): Georgetown KY, Harlan KY, Louisville KY,
Bozeman MT, Jeffersonville IN.

If `geocodeAddress` fails for an address, that address is unusable — the harness
reports it as a hard error and excludes it (geocoding is the floor everything
else stands on). If geocoding fails for **all** addresses, exit 1 immediately.

### Discovery input
Glob `src/modules/*/data.js`; require each; collect `module.exports.SOURCES`,
tagging each entry with its module name. A `data.js` with no `SOURCES` export is
reported as a discovery gap (warning), not a crash.

## Processing

1. Resolve `ctx` for each of the 5 addresses.
2. Discover all `SOURCES` across modules.
3. For each source × address:
   - If `status === 'deferred'` → `SKIPPED (deferred)`.
   - Else if `requiresKey` is named and blank → `SKIPPED (no key)`.
   - Else `await run(ctx)` inside try/catch; a throw → invalid with reason; then
     apply `isValid(result)` → `OK` / `FAIL`.
   - If the source defines `probe`, `await probe(ctx)` too: cell is `OK` only when
     probe is reachable **and** `isValid` passes; unreachable probe → `FAIL`.
4. Compute per-source verdict from `coverage` (skipped cells excluded from the
   denominator; an all-skipped source → `SKIPPED`, not FAIL/PASS).
5. Print matrix + summary. Exit 1 if any source verdict is `FAIL`, else 0.

## Outputs

### Default (human)
```
SOURCE (module)              GTWN HARL LOU  BOZ  JEFF   VERDICT
noaa-normals (climate)       OK   OK   OK   OK   OK     PASS
fema-declarations (climate)  OK   --   OK   --   OK     PASS (some)
nrel-rate (utilities)        --   --   --   --   --     SKIPPED (no key)
fcc-broadband (utilities)    --   --   --   --   --     SKIPPED (deferred)
acs-demographics (community) FAIL FAIL FAIL FAIL FAIL   FAIL

1 FAIL · N INFO · M PASS · K SKIPPED        exit 1
```
Legend: `OK` valid · `FAIL` invalid/unreachable · `--` skipped/expected-empty.
A failing cell prints its reason beneath the matrix (HTTP status, thrown message,
or "isValid returned false").

### `--json`
Machine-readable object (sources[] with per-address cells, verdict, reasons) for
the scheduled workflow to upload as an artifact.

## Exit codes
- `0` — no source FAILed (PASS / INFO / SKIPPED only).
- `1` — at least one source FAILed, OR geocoding failed for all addresses, OR a
  fatal harness error.

## Edge cases

| Case | Behavior |
|------|----------|
| Source throws | cell = FAIL, reason = error message |
| Source times out | cell = FAIL (AbortSignal in the module fetcher), reason = timeout |
| `coverage:'some'` empty at all 5 | source verdict FAIL |
| `coverage:'some'` empty at 1–4 | source verdict INFO (exit-neutral) |
| `coverage:'all'` empty at ≥1 | source verdict FAIL |
| Missing optional key | every cell SKIPPED (no key); verdict SKIPPED |
| Deferred source (FCC) | every cell SKIPPED (deferred); verdict SKIPPED |
| Swallow-to-empty source with `probe` | unreachable probe → FAIL even if payload is `[]` |
| Swallow-to-empty source without `probe` | known blind spot: dead reads as OK (documented, accepted) |
| `fips` null for an address | sources that need fips handle null via their own `run`; harness does not crash |
| Geocode fails for 1 address | address excluded, reported as hard error; other 4 still evaluated |
| Geocode fails for all | exit 1 immediately |
| `data.js` lacks SOURCES | discovery warning, continue |

## Acceptance criteria

1. `npm run verify:sources` runs standalone (not via Jest) and prints the matrix.
2. Every `src/modules/*/data.js` exports a well-formed `SOURCES` array covering
   **all** its external endpoints (unkeyed included), each with `coverage`,
   `run`, `isValid`. Every swallow-to-empty source (failure value == legitimate
   value, e.g. FEMA, NOAA storm-events) supplies a `probe`.
3. Verdict engine honors the coverage policy exactly (FAIL/INFO/PASS/SKIPPED) and
   sets the process exit code accordingly.
4. Missing optional keys → `SKIPPED (no key)`; FCC/broadband → `SKIPPED (deferred)`.
   Neither produces FAIL.
5. A separate workflow `.github/workflows/verify-sources.yml` runs on `schedule`
   (cron) + `workflow_dispatch` only — not on push/PR — with the config keys wired
   as repo secrets.
6. `tests/verify-sources.test.js` (Jest, mocked results — no live calls) covers the
   verdict engine: coverage:'all' dead-at-one → FAIL; coverage:'some' dead-at-all →
   FAIL; coverage:'some' partial → INFO; thrown → FAIL; missing key → SKIPPED;
   deferred → SKIPPED; probe-unreachable-but-payload-empty → FAIL. Plus a structural
   test that every module exports a valid SOURCES (and swallow-to-empty ones carry a probe).
7. Pure verdict logic lives in its own module (e.g. `scripts/lib/verdict.js`) so it
   is unit-testable without the harness I/O.
8. No business rules or HTML in the harness; it only reads descriptors and reports.

## Out of scope

- Repairing any dead source (e.g. FR-062 FCC) — this only *surfaces* them.
- A dashboard / persisted history (NR-004 Stage 2 observability layer — later).
- Folding into the main `ci.yml` push/PR job (deliberately separate, cost reasons).
- Verifying drive-time *correctness* or report content quality — reachability +
  shape only.
