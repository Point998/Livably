# FR-098 — Report-store backend seam (bridge-readiness)

## Plain-language summary (the analogy)

Finished reports get filed somewhere so share links keep working. Today they're filed as files on one
server — **the filing cabinet we already have.** Later, once a host is chosen, those reports move to a
real cloud store so Livably can run on more than one machine. This FR does **not** buy the new office
(no Postgres/cloud storage yet — that's host-gated). It does the work that makes **moving day** a quick,
safe, half-day job instead of a risky rebuild:

- **Standard label on every box** — write down exactly how a report store must behave (the contract).
- **Moving-day checklist** — automated tests any future store must pass; green = the move worked.
- **A practice cabinet** — a second, in-memory store that passes the same checklist, proving the labels
  and checklist actually work (a rehearsal that exposes problems now, not on moving day). Doubles as a
  fast test fixture.
- **A walk-through** — confirm nothing in the app reaches around the filing system; that's what makes a
  real move go badly.

**Outcome:** when the host is picked, adding the real backend is "write one class, pass the existing
tests, flip one config value."

## Background / current behavior

- FR-096 introduced `FileReportStore` (a class behind module wrappers) and FR-097 hardened it. Consumers
  never touch the class directly — they call the wrappers `saveReport` / `getReport` /
  `updateReportAccess` / `putArtifact` / `resolveSharedReport`, which delegate to a module-level
  singleton `store = new FileReportStore()`.
- The class **is** the de-facto seam, but four gaps keep the eventual swap from being mechanical:
  1. **Implicit contract** — the required behavior is only documented by the one implementation (incl.
     subtle rules: `get` returns `null` for missing/corrupt/empty-stub records; writes are atomic
     last-writer-wins; `ensureMigrated` is idempotent).
  2. **Unproven portability** — with a single implementation, the contract test (`reportStore.test.js`)
     can't prove it isn't silently encoding filesystem assumptions.
  3. **Hardcoded selection** — the singleton is `new FileReportStore()`; there's no config insertion
     point for an alternate backend.
  4. **No conformance suite** — nothing a future backend can run to prove "I behave correctly."

## Module

`src/services/reportStore.js` (add the in-memory implementation + the `createReportStore` selector +
the contract typedef). New shared test helper `tests/services/reportStoreContract.js`. **No consumer
changes** — every caller already goes through the wrappers. Three-layer chapter rules don't apply
(service, not a chapter).

## Design

### 1. Explicit `ReportStore` contract (documented)
A JSDoc `@typedef ReportStore` in `reportStore.js` naming the five methods and their *behavioral*
contract — not just signatures:
- `mintId() → Promise<string>` — a fresh, unused 8-hex id, reserved so a concurrent `mintId` can't
  collide.
- `put(id, record) → Promise<void>` — persist the whole record; atomic last-writer-wins for one id.
- `get(id) → Promise<record|null>` — `null` for unknown id, corrupt data, **or** an empty reservation
  stub; otherwise the stored record (a copy — callers mutating it must not affect storage).
- `touch(id) → Promise<boolean>` — update `lastAccessed`; `false` if the id is absent.
- `ensureMigrated() → Promise<void>` — idempotent, safe to call before every op; a no-op for backends
  with nothing to migrate.

### 2. `InMemoryReportStore` (the practice cabinet)
A `Map`-backed implementation mirroring `FileReportStore`'s **observable** behavior:
- `put`/`get` round-trip through `JSON.parse(JSON.stringify(...))` so stored and returned records are
  deep copies — matching the file backend's serialize/deserialize boundary (no shared references,
  functions/`undefined` dropped identically).
- `get` returns `null` for missing **and** for an empty-keys stub (same rule as file).
- `mintId` reserves an empty stub under a fresh random 8-hex id, retrying on the (astronomically rare)
  in-map collision.
- `touch` = get → set `lastAccessed` → put → `true`; `false` when absent.
- `ensureMigrated` resolves immediately (nothing to migrate).
- **Explicitly NOT a production backend** — no persistence across process restart. Its jobs are
  (a) prove the contract is portable, (b) serve as a fast/isolated test fixture, (c) be the template a
  real backend copies. (Logged as a `// shortcut:` noting it's intentionally non-durable.)

### 3. `createReportStore(env)` selector
A small factory (≈15 lines, no plugin registry) reading `LIVABLY_REPORT_STORE`:
- unset or `'file'` → `new FileReportStore()` (default; current behavior preserved exactly).
- `'memory'` → `new InMemoryReportStore()`.
- any other value → **throw a typed error at startup** (fail fast; never silently fall back to a
  different store than asked for).
The module singleton becomes `const store = createReportStore(process.env);`. `LIVABLY_REPORTS_DIR`
continues to configure the file backend's location, unchanged.

### 4. Shared contract-test suite (the moving-day checklist)
`tests/services/reportStoreContract.js` exports `runReportStoreContract(makeStore, label)` — a function
that registers the backend-agnostic behavioral assertions (round-trip, null-on-miss, null-on-empty-stub,
unique-reserved `mintId`, `touch` true/false, atomic last-writer-wins for one id, copy-not-reference
semantics, `ensureMigrated` idempotency). `reportStore.test.js` invokes it twice: once with a
temp-dir `FileReportStore`, once with `InMemoryReportStore`. The file backend's file-specific tests
(atomic-temp cleanup, legacy `reports.json` migration) stay where they are — they're not part of the
shared contract.

### 5. Leak audit (the walk-through)
Confirm every consumer reaches the store **only** through the wrappers, and nothing reads/writes
`data/reports/*` directly outside `reportStore.js`. Document the consumer list in `summary.md`. Close
any leak found (expected: none — known consumers are `reportBuilder.js` and `app.js`, both via wrappers).

## Inputs / outputs

No interface or signature change for any consumer. New surface area only:
- `LIVABLY_REPORT_STORE` env var (`file` default | `memory`).
- Exported `InMemoryReportStore`, `createReportStore` (alongside existing `FileReportStore`, `store`,
  wrappers).

## Edge cases

- **Unknown `LIVABLY_REPORT_STORE`** → typed error thrown at module load (fail fast).
- **In-memory copy semantics** — a caller mutating a record returned by `get` must not change stored
  state, and mutating a record after `put` must not change what's stored (both guaranteed by the JSON
  round-trip; asserted in the shared contract so the file backend is held to the same rule).
- **`mintId` collision in memory** — retry loop, same as file.
- **`ensureMigrated` on memory** — resolves immediately; calling it before every op stays cheap.
- **Concurrent `put` to one id (memory)** — single-threaded JS makes last-writer-wins trivially atomic;
  matches the file backend's atomic-rename guarantee at the observable level.

## Acceptance criteria

- **AC-1** An explicit `ReportStore` contract is documented (typedef) covering all five methods plus the
  null / empty-stub / atomicity / copy-semantics / idempotency rules.
- **AC-2** A shared contract-test suite exists and runs **unchanged** against two implementations.
- **AC-3** `InMemoryReportStore` passes the full contract suite identically to `FileReportStore`.
- **AC-4** `createReportStore` selects by `LIVABLY_REPORT_STORE` (`file` default, `memory` option) and
  throws a typed error on an unknown value.
- **AC-5** The singleton uses the selector; all existing wrappers and their tests stay green; no
  consumer signature changes.
- **AC-6** Leak audit complete: consumer list documented; zero direct `data/reports/*` access outside
  `reportStore.js`.
- **AC-7** Full suite green; net-new tests for the in-memory backend, the selector, and the contract
  runner.
- **AC-8** No real external backend or host infrastructure is introduced, and **no new npm dependency**.

## Constraint check

- **CONSTRAINT-011 (tests):** new backend + selector covered; the contract suite is the conformance
  gate. ✓
- **CONSTRAINT-015 (graceful degradation):** wrapper-level non-fatal persistence behavior is unchanged
  (the selector returns a store; failures still degrade as today). ✓
- **No scoring / Fair Housing / design-layer / cross-state constraints** apply (service layer). ✓
- **NR-004 alignment:** completes the Stage-1 seam so the real state-externalization swap is a contained,
  test-gated change. ✓

## Non-goals (explicit — host-gated, deferred to "moving day")

- Any **real** external backend (`PostgresReportStore`, `S3ReportStore` / object storage) and its
  provisioning, connection pooling, schema, and IaC. Built once the host is chosen.
- Redis / cache externalization (`src/cache.js`) — separate concern, separate FR.
- Report TTL / eviction / size caps; making `/report?address=` serve-from-store; auth / multi-tenancy.
- Making `InMemoryReportStore` durable — it is intentionally a test/rehearsal backend, not production.
