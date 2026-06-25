# FR-096 — Report store hardening + artifact persistence (backend-agnostic)

## Summary

Harden the report store and make it persist the **rendered report artifact**, so a shared
`/r/:reportId` link **serves the stored report directly instead of re-rendering it from scratch**.
This is NR-004 Hardening Stage 1 work done **backend-agnostically**: it fixes a real concurrency
correctness bug, establishes the `ReportStore` seam the eventual external backend drops into, and
delivers the SSG-per-report serving behavior — all on local disk, with **no deploy/backend decision
required** (that bridge is deferred, per the 2026-06-24 direction).

This FR is the **decision-independent core** of the artifact-store track. The decision-*dependent*
half (which external backend the bytes live in) is an explicit non-goal here.

## Background / current behavior

- `src/services/reportStore.js` persists `{ id → { address, createdAt, lastAccessed } }` in a single
  `data/reports.json` map. Every mutation does read-modify-write with `fs.writeFileSync`.
- `saveReport(address)` is called inside `buildReport` (`reportBuilder.js:201`) to **mint a short id**
  (`crypto.randomBytes(4).toString('hex')`); the id is embedded in the rendered HTML for the share link.
- `/r/:reportId` (`app.js:128`) looks up the **address only** and `res.redirect('/report?address=…')`
  — i.e. a shared link triggers a **full re-render** of the report on every visit.
- NR-004 findings addressed: 🔴 single-map read-modify-write **race / lost updates / parse-fail**
  (`reportStore.js`), and the SSR-per-view regeneration cost the SSG-per-report decision flagged.

## Module

`src/services/` — `reportStore.js` (rewritten behind a seam) + a new `FileReportStore` implementation.
Touches `reportBuilder.js` (persist call) and `app.js` (`/r/:reportId` serving). Three-layer module
rules don't apply (this is a service, not a chapter), but the existing separation is preserved.

## Design

### Storage layout — per-report file (APPROVED)
Replace the single `data/reports.json` map with **one file per report: `data/reports/<id>.json`**.
- Eliminates the lost-update race entirely (no shared map → no read-modify-write of shared state).
- Each write is atomic: write `data/reports/<id>.json.tmp` then `fs.rename` over the target
  (rename is atomic on the same filesystem).
- Scales once records hold ~100–300 KB of HTML — `get` reads one small file, not a monolithic map.
- Maps 1:1 onto any future backend (one row/object per report).

### The `ReportStore` seam
A small async interface; one concrete `FileReportStore` behind it:
```
put(id, record)  -> Promise<void>   // atomic write of data/reports/<id>.json
get(id)          -> Promise<record|null>
touch(id)        -> Promise<boolean> // update lastAccessed atomically; false if absent
mintId()         -> Promise<string>  // unused short id (crypto.randomBytes(4) hex, collision-checked)
```
The existing public functions become thin wrappers so current callers/tests keep working:
- `saveReport(address)` → `mintId()` + `put(id, { address, createdAt, lastAccessed })` (address-only
  stub, preserving today's early-mint behavior).
- `getReport(id)` → `get(id)`; `updateReportAccess(id)` → `touch(id)`.
- A new `putArtifact(id, { html, contract, generatedAt, schemaVersion, degraded })` merges the
  artifact into the existing record (get → merge → atomic put).

> **Async-first (deliberate interface choice).** Today's store functions are sync, and a local-disk
> backend *could* stay sync — but the entire purpose of the seam is to host a future **network**
> backend (Postgres/object storage), which is inherently async. Making the seam async now means that
> swap needs **zero signature or caller changes** — the alternative (sync now) would ripple an
> async refactor through every caller at swap time, exactly what the seam exists to prevent. So:
> the store + all wrappers are async, and **every caller is updated to `await`** — including making
> the currently-sync `/r/:reportId` handler `async` (`reportBuilder` is already async). The existing
> sync `reportStore.test.js` is updated to async in lockstep. `mintId` reserves an id by
> exclusive-create (`fs.writeFile` flag `wx`), retrying on `EEXIST` — no map scan.

### Record shape
```
{
  address: string,
  createdAt: ISO-UTC string,
  lastAccessed: ISO-UTC string,
  generatedAt?: ISO-UTC string,
  schemaVersion?: string,     // mirrors the contract envelope schemaVersion
  degraded?: boolean,
  contract?: object,          // SOURCE OF TRUTH (the FR-078 report envelope)
  html?: string               // derived cache; re-derivable from contract once FE renders from it
}
```
`contract` is the durable artifact; `html` is a cache stored beside it.

### Data flow
- **Generation (`buildReport`):** mint id early (unchanged — HTML embeds it). After `html` + `contract`
  are built, call `putArtifact(id, { html, contract, generatedAt, schemaVersion, degraded })`. The
  early address-only `saveReport` stub is retained so a record always exists even if artifact assembly
  later fails.
- **Serving (`/r/:reportId`):** `get(id)` →
  - record has `html` → **serve it directly** (`res.send(html)`, 200, no redirect, no regeneration);
  - record exists but no `html` (legacy / partial) → **fall back** to `res.redirect('/report?address=…')`;
  - no record → 404 (unchanged).
  - `touch(id)` on any hit (fire-and-forget, non-fatal).

### Legacy migration
One-time, idempotent, at boot (or first store access): if `data/reports.json` exists, split each entry
into `data/reports/<id>.json` (skipping ids that already have a per-file record), then rename the legacy
file to `data/reports.json.bak`. Preserves `createdAt`/`lastAccessed` for record fidelity. ~15 lines,
tested. (Note: `/history` is a **client-side localStorage** page — it never reads the server store — so
it is structurally independent of this migration; existing `/r/:reportId` share links keep resolving.)

## Inputs / outputs

- **Input (persist):** `id`, `{ address, html, contract, generatedAt, schemaVersion, degraded }`.
- **Output (serve):** stored HTML (200) on hit-with-artifact; redirect on hit-without-artifact; 404 on miss.

## Edge cases

- **Concurrent puts to the same id:** last-writer-wins on that one file via atomic rename; no torn file,
  no cross-id loss (different ids = different files). `putArtifact`'s get→merge→put is acceptable
  last-writer-wins for a single id (only the generator writes a given id).
- **Storage failure on `put`/`putArtifact`:** non-fatal — wrapped so report delivery never breaks
  (CONSTRAINT-015). The report still returns; the share link degrades to redirect-regeneration.
- **Corrupt/partial per-file JSON:** `get` catches parse errors → returns null → 404/redirect fallback
  (never throws into the request path). Matches the cache's self-heal posture.
- **Missing `data/reports/` dir:** created on first write (like `ensureReportsFile` today).
- **Legacy record (address-only, pre-migration or pre-artifact):** served via redirect fallback — no
  behavior regression vs today.
- **Large HTML:** acceptable at current volume; TTL/eviction is an explicit non-goal (tracked follow-up).

## Acceptance criteria

- **AC-1** `data/reports/<id>.json` is the storage unit; no single shared map is read-modified-written.
- **AC-2** All writes are atomic (temp + `rename`); a killed process mid-write never leaves a corrupt
  target file.
- **AC-3** `ReportStore` seam exists (`put`/`get`/`touch`/`mintId` + `putArtifact`); `FileReportStore`
  implements it; `saveReport`/`getReport`/`updateReportAccess` remain working wrappers.
- **AC-4** `buildReport` persists `{ address, html, contract, generatedAt, schemaVersion, degraded }`
  after assembly; persistence failure does not break report delivery.
- **AC-5** `/r/:reportId` serves stored HTML directly when present (no redirect, no regeneration);
  falls back to address-redirect when the artifact is absent; 404 when the id is unknown; `touch` on hit.
- **AC-6** `contract` is stored as the source of truth; `html` stored as a derived cache.
- **AC-7** Legacy `data/reports.json` is migrated idempotently to per-file records (preserving
  `createdAt`/`lastAccessed`) and renamed `.bak`; existing `/r/:reportId` links keep resolving.
- **AC-8** Existing `tests/services/reportStore.test.js` passes (via wrappers) or is updated in lockstep;
  new tests cover atomic write, per-file round-trip, migration, stored-hit vs redirect-fallback,
  concurrent-put-no-cross-id-loss. Full suite green.

## Constraint check

- **CONSTRAINT-015 (graceful degradation):** store failures degrade to redirect-regeneration, never a
  broken response. ✓
- **CONSTRAINT-011 (tests):** new service logic gets tests; storage round-trip + migration covered. ✓
- **No scoring / Fair Housing / design-layer constraints** apply (service layer, no findings/HTML
  generation in data/logic). ✓
- **NR-004 alignment:** fixes the 🔴 reportStore race; builds the Stage 1 state-externalization seam
  without committing a backend. ✓

## Non-goals (explicit — deferred to "the bridge")

- The external storage backend (Postgres / object storage) and its provisioning/config.
- Making `/report?address=` itself serve-from-store (requires the deferred identity/dedup decision).
- TTL / eviction / size caps on stored artifacts.
- Report versioning / regeneration-as-new-version semantics.
- Atomic-writing the *other* file stores (logger, errorMemory) — noted by NR-004, separate FR.
