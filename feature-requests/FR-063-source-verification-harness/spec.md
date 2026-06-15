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
| `probe(ctx)` | no | Reachability check (HTTP status) for swallow-to-empty sources whose `isValid` can't tell failure from empty. When present: cell `OK` iff probe reachable AND `isValid` passes. See "Swallow-to-empty sources". Probes MUST build their URL from the same `constants.js` value the module's fetcher uses — never a hardcoded copy — so a probe can't drift out of sync with the real endpoint. |

### Provider tags & concurrency

Each source belongs to a **provider** (the upstream host/quota domain — `google`,
`noaa`, `census`, `usgs`, `fema`, `nrel`, `eia`, `airnow`, etc.), derived from its
module/constants or an explicit `provider` field. The harness bounds concurrency
**per provider** (small cap, e.g. 2) so a burst of parallel calls to one host
can't trip its QPS limit. A rate-limit response (`429`) is **not** an outage; it
is retried (see flap tolerance) and, if still rate-limited, reported as
`SKIPPED (rate-limited)` rather than `FAIL`, so quota throttling never reads as a
dead source.

## Inputs

### Cache bypass (liveness, not cached)
The harness probes **live** upstreams, never cached results — a dead source whose
last-good payload is cached must still read `FAIL`. It runs with caches bypassed
(a harness flag / `LIVABLY_VERIFY=1` env the cache layer honors, or a fresh
cache instance) so `run`/`probe` always hit the network. In CI the cache is cold
anyway; this guarantees the same authoritative behavior when run locally.

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

1. Resolve `ctx` for each of the 5 addresses (caches bypassed — see Cache bypass).
2. Discover all `SOURCES` across modules.
3. For each source × address, scheduled with a **per-provider concurrency cap** so
   one upstream's QPS limit is never exceeded:
   - If `status === 'deferred'` → `SKIPPED (deferred)`.
   - Else if `requiresKey` is named and blank → `SKIPPED (no key)`.
   - Else evaluate the cell with **flap tolerance** (below).
4. Compute per-source verdict from `coverage` (skipped cells excluded from the
   denominator; an all-skipped source → `SKIPPED`, not FAIL/PASS).
5. Print matrix + summary. Exit 1 if any source verdict is `FAIL`, else 0.

### Cell evaluation with flap tolerance

A monitor that alarms on the first transient blip becomes noise and gets muted.
Each cell is therefore evaluated as **try → on-failure retry-once → only then
fail**:

1. `await run(ctx)` (and `await probe(ctx)` if defined) inside try/catch.
2. A cell is `OK` when: probe reachable (if present) **and** `isValid(result)` passes.
3. On any failure (throw, timeout, unreachable probe, `isValid` false) — wait a
   short backoff and **retry once**.
4. If the retry also fails → cell `FAIL` with the retry's reason.
5. A `429`/rate-limit response on both attempts → cell `SKIPPED (rate-limited)`,
   **not** `FAIL` (throttling ≠ dead source).

This means only **sustained** failure alarms; a single dropped request self-heals.

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
Legend: `OK` valid · `FAIL` invalid/unreachable (after retry) · `--` skipped (no key / deferred / rate-limited / expected-empty).
A failing cell prints its reason beneath the matrix (HTTP status, thrown message,
or "isValid returned false").

### `--json`
Machine-readable object (sources[] with per-address cells, verdict, reasons) for
the scheduled workflow to upload as an artifact.

## Exit codes
- `0` — no source FAILed (PASS / INFO / SKIPPED only).
- `1` — at least one source FAILed, OR geocoding failed for all addresses, OR a
  fatal harness error.

## CI workflow & notification

`.github/workflows/verify-sources.yml` — **separate** from `ci.yml`:

- Triggers: `schedule` (cron — weekly, Mon 06:00 UTC placeholder) + `workflow_dispatch`.
  **Never** `push`/`pull_request`.
- Steps: checkout → setup-node → `npm ci` → `npm run verify:sources -- --json`,
  uploading the JSON as a run artifact.
- Secrets: the `config.js` keys as repo secrets (`GOOGLE_MAPS_API_KEY` +
  optionals). Missing secrets → those sources `SKIPPED (no key)`, never FAIL —
  the run stays green and honest when secrets are partial.
- **Notification on FAIL** — a monitor nobody sees is decorative. On a failing run
  (exit 1) the workflow **opens or updates a single GitHub issue** (labelled e.g.
  `source-health`, de-duped by a stable title) with the failing sources + reasons,
  and closes/comments it when a later run goes green. This is the visible alert
  path; GitHub's default cron-failure email is the fallback, not the primary.

| Case | Behavior |
|------|----------|
| Transient failure (throw/timeout) then success on retry | cell = OK (flap tolerance self-heals) |
| Source throws on both attempts | cell = FAIL, reason = error message |
| Source times out on both attempts | cell = FAIL (AbortSignal in the module fetcher), reason = timeout |
| `429` / rate-limited on both attempts | cell = SKIPPED (rate-limited), not FAIL |
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
   as repo secrets, and **opens/updates a `source-health` GitHub issue on FAIL**
   (closes/comments on recovery).
6. **Flap tolerance**: every cell retries once before being scored `FAIL`; a
   transient failure that succeeds on retry reads `OK`.
7. **Per-provider concurrency**: calls are bounded per upstream provider so a
   `429` is not produced by the harness's own parallelism; a sustained `429` →
   `SKIPPED (rate-limited)`, never `FAIL`.
8. **Liveness, not cached**: the harness bypasses caches so `run`/`probe` hit the
   network; `probe` URLs are built from `constants.js`, not hardcoded.
9. `tests/verify-sources.test.js` (Jest, mocked results — no live calls) covers the
   verdict engine: coverage:'all' dead-at-one → FAIL; coverage:'some' dead-at-all →
   FAIL; coverage:'some' partial → INFO; thrown → FAIL; missing key → SKIPPED;
   deferred → SKIPPED; rate-limited → SKIPPED; transient-then-retry-OK → OK;
   probe-unreachable-but-payload-empty → FAIL. Plus a structural test that every
   module exports a valid SOURCES (and swallow-to-empty ones carry a probe).
10. Pure verdict logic lives in its own module (e.g. `scripts/lib/verdict.js`) so it
    is unit-testable without the harness I/O.
11. No business rules or HTML in the harness; it only reads descriptors and reports.

## Out of scope

- Repairing any dead source (e.g. FR-062 FCC) — this only *surfaces* them.
- A dashboard / persisted history (NR-004 Stage 2 observability layer — later).
- Folding into the main `ci.yml` push/PR job (deliberately separate, cost reasons).
- Verifying drive-time *correctness* or report content quality — reachability +
  shape only.
