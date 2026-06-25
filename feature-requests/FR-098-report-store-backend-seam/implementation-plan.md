# FR-098 — Report-store backend seam (bridge-readiness) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the report-store seam genuinely swappable so a future external backend is "write one class, pass the existing contract tests, flip one config value" — by adding a documented contract, a backend-agnostic contract-test suite, an in-memory backend that passes it, and a config-driven selector.

**Architecture:** One file holds it all (`src/services/reportStore.js`) — it already defines `FileReportStore` and the module wrappers. We add a sibling `InMemoryReportStore`, a `createReportStore(env)` factory, and point the singleton at the factory. A new shared test helper (`tests/services/reportStoreContract.js`) defines the behavioral checklist both backends run. No consumer changes — every caller already goes through the wrappers.

**Tech Stack:** Node.js, Jest. No new npm dependency. Plain `require`/`module.exports` (CommonJS), matching the file.

## Global Constraints

- **No new npm dependency** (spec AC-8). Use Node stdlib + Jest only.
- **No consumer signature changes** — `saveReport`/`getReport`/`updateReportAccess`/`putArtifact`/`resolveSharedReport` keep their exact signatures (spec AC-5).
- **`file` is the default backend** — unset `LIVABLY_REPORT_STORE` must behave exactly as today (spec AC-4).
- **No real external backend / host infra** — no Postgres/object-storage/IaC (spec non-goals).
- **TDD:** new behavior (in-memory backend, selector) gets a failing test first. Match existing test style in `tests/services/reportStore.test.js` (jest, `tmpDir()` helper, `async` tests).
- **CommonJS, `'use strict';`** at top of new files; match the file's existing comment density.

---

### Task 1: Shared contract-test suite, proven against the existing file backend

Builds the "moving-day checklist" and validates it against the known-good `FileReportStore`. This task is characterization (the file backend already conforms), so its tests pass on first run — that is expected and correct; it proves the suite is valid before Task 2 uses it to drive new code.

**Files:**
- Create: `tests/services/reportStoreContract.js`
- Modify: `tests/services/reportStore.test.js` (wire the runner in for `FileReportStore`)

**Interfaces:**
- Produces: `runReportStoreContract(makeStore, label)` — `makeStore: () => ReportStore` returns a *fresh, isolated* store; `label: string` names the backend in the describe title. Registers a `describe` block of behavioral `test`s. No return value.

- [ ] **Step 1: Write the contract runner**

Create `tests/services/reportStoreContract.js`:

```js
'use strict';

// The behavioral contract EVERY ReportStore backend must satisfy. Run it against any
// implementation via runReportStoreContract(makeStore, label) — a backend that passes
// is a drop-in replacement. Backend-specific concerns (atomic temp files, legacy
// reports.json migration) are intentionally NOT here; they live in the backend's own
// test file. `makeStore` must return a fresh, isolated store on each call.
function runReportStoreContract(makeStore, label) {
  describe(`ReportStore contract: ${label}`, () => {
    test('put then get round-trips a record', async () => {
      const store = makeStore();
      const id = await store.mintId();
      await store.put(id, { address: '100 Main St', createdAt: 't', lastAccessed: 't' });
      expect((await store.get(id)).address).toBe('100 Main St');
    });

    test('get returns null for an unknown id', async () => {
      const store = makeStore();
      expect(await store.get('deadbeef')).toBeNull();
    });

    test('get returns null for a minted-but-unwritten reservation stub', async () => {
      const store = makeStore();
      const id = await store.mintId();
      expect(await store.get(id)).toBeNull();
    });

    test('mintId returns unique 8-hex ids', async () => {
      const store = makeStore();
      const a = await store.mintId();
      const b = await store.mintId();
      expect(a).toMatch(/^[0-9a-f]{8}$/);
      expect(b).toMatch(/^[0-9a-f]{8}$/);
      expect(a).not.toBe(b);
    });

    test('touch updates lastAccessed and returns true; false for unknown id', async () => {
      const store = makeStore();
      const id = await store.mintId();
      await store.put(id, { address: 'a', createdAt: 't0', lastAccessed: 't0' });
      expect(await store.touch(id)).toBe(true);
      expect((await store.get(id)).lastAccessed).not.toBe('t0');
      expect(await store.touch('unknown00')).toBe(false);
    });

    test('stored records are copies, not shared references', async () => {
      const store = makeStore();
      const id = await store.mintId();
      const input = { address: 'orig', createdAt: 't', lastAccessed: 't' };
      await store.put(id, input);
      input.address = 'mutated-after-put'; // mutating the input must not change storage
      const got = await store.get(id);
      expect(got.address).toBe('orig');
      got.address = 'mutated-after-get'; // mutating the result must not change storage
      expect((await store.get(id)).address).toBe('orig');
    });

    test('ensureMigrated is idempotent and safe to call repeatedly', async () => {
      const store = makeStore();
      await expect(store.ensureMigrated()).resolves.toBeUndefined();
      await expect(store.ensureMigrated()).resolves.toBeUndefined();
    });
  });
}

module.exports = { runReportStoreContract };
```

- [ ] **Step 2: Wire the runner into the test file for FileReportStore**

In `tests/services/reportStore.test.js`, add the import beside the existing one and invoke the runner once. Add after the existing `require` (line 8) and after the `tmpDir()` helper:

```js
const { runReportStoreContract } = require('./reportStoreContract');
```

Then, immediately before the existing `describe('FileReportStore core', ...)` block, add:

```js
runReportStoreContract(() => new FileReportStore(tmpDir()), 'FileReportStore');
```

- [ ] **Step 3: Run the contract suite against FileReportStore**

Run: `npx jest tests/services/reportStore.test.js`
Expected: PASS — the new `ReportStore contract: FileReportStore` describe shows 7 passing tests; all pre-existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add tests/services/reportStoreContract.js tests/services/reportStore.test.js
git commit -m "test: add backend-agnostic ReportStore contract suite (FR-098)"
```

---

### Task 2: InMemoryReportStore (the practice cabinet), driven by the contract suite

**Files:**
- Modify: `src/services/reportStore.js` (add the class + export)
- Modify: `tests/services/reportStore.test.js` (run the contract against the new backend)

**Interfaces:**
- Consumes: `runReportStoreContract` (Task 1).
- Produces: `InMemoryReportStore` class with the same shape as `FileReportStore` — `async mintId()`, `async put(id, record)`, `async get(id)`, `async touch(id)`, `async ensureMigrated()`. Exported from `reportStore.js`.

- [ ] **Step 1: Write the failing test (apply the contract to the new backend)**

In `tests/services/reportStore.test.js`, update the import to also pull in `InMemoryReportStore`:

```js
const { FileReportStore, InMemoryReportStore, atomicWrite } = require('../../src/services/reportStore');
```

Add, directly below the `FileReportStore` contract invocation from Task 1:

```js
runReportStoreContract(() => new InMemoryReportStore(), 'InMemoryReportStore');
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest tests/services/reportStore.test.js`
Expected: FAIL — `InMemoryReportStore is not a constructor` (the symbol is `undefined` until implemented).

- [ ] **Step 3: Implement InMemoryReportStore**

In `src/services/reportStore.js`, add this class immediately after the `FileReportStore` class definition (after its closing `}`, before `const store = ...`):

```js
// A Map-backed store mirroring FileReportStore's OBSERVABLE behavior. Its jobs:
// (1) prove the ReportStore contract is portable (a contract test with one impl can't),
// (2) a fast, isolated test fixture, (3) the template a real network backend copies.
// shortcut: intentionally NOT durable (state is lost on process restart) — it is a
// test/rehearsal backend, not production. Revisit only if a real in-memory production
// cache is ever needed (it is not the host-backend this seam exists for).
class InMemoryReportStore {
  constructor() {
    this.map = new Map();
  }

  // Deep copy via JSON, matching FileReportStore's serialize/deserialize boundary:
  // stored and returned records share no references with the caller's objects, and
  // functions/undefined are dropped identically to the file backend.
  _clone(rec) { return JSON.parse(JSON.stringify(rec)); }

  async ensureMigrated() { /* nothing to migrate for an in-memory backend */ }

  async mintId() {
    for (;;) {
      const id = crypto.randomBytes(4).toString('hex'); // 8 hex chars
      if (!this.map.has(id)) {
        this.map.set(id, {}); // empty reservation stub, same as FileReportStore
        return id;
      }
    }
  }

  async put(id, record) {
    this.map.set(id, this._clone(record));
  }

  async get(id) {
    const rec = this.map.get(id);
    // Missing, or an empty reservation stub ('{}'), is not yet a usable record.
    return rec && Object.keys(rec).length ? this._clone(rec) : null;
  }

  async touch(id) {
    const rec = await this.get(id);
    if (!rec) return false;
    rec.lastAccessed = new Date().toISOString();
    await this.put(id, rec);
    return true;
  }
}
```

Then add `InMemoryReportStore` to `module.exports` — change the export line:

```js
module.exports = {
  atomicWrite, FileReportStore, InMemoryReportStore, store,
  saveReport, getReport, updateReportAccess, putArtifact, resolveSharedReport,
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest tests/services/reportStore.test.js`
Expected: PASS — `ReportStore contract: InMemoryReportStore` shows the same 7 tests passing, identical to the file backend.

- [ ] **Step 5: Commit**

```bash
git add src/services/reportStore.js tests/services/reportStore.test.js
git commit -m "feat: InMemoryReportStore passing the shared contract (FR-098)"
```

---

### Task 3: createReportStore selector

**Files:**
- Modify: `src/services/reportStore.js` (add the factory + export)
- Modify: `tests/services/reportStore.test.js` (selector tests)

**Interfaces:**
- Consumes: `FileReportStore`, `InMemoryReportStore`.
- Produces: `createReportStore(env)` — `env: { LIVABLY_REPORT_STORE?: string, LIVABLY_REPORTS_DIR?: string }`. Returns `new FileReportStore()` when `LIVABLY_REPORT_STORE` is unset or `'file'`, `new InMemoryReportStore()` when `'memory'`, and throws `Error` for any other value. Exported from `reportStore.js`.

- [ ] **Step 1: Write the failing tests**

In `tests/services/reportStore.test.js`, update the import to include `createReportStore`:

```js
const { FileReportStore, InMemoryReportStore, createReportStore, atomicWrite } = require('../../src/services/reportStore');
```

Add this describe block at the end of the file (after the last existing block):

```js
describe('createReportStore selector', () => {
  test('defaults to FileReportStore when LIVABLY_REPORT_STORE is unset', () => {
    expect(createReportStore({})).toBeInstanceOf(FileReportStore);
  });

  test("returns FileReportStore for 'file'", () => {
    expect(createReportStore({ LIVABLY_REPORT_STORE: 'file' })).toBeInstanceOf(FileReportStore);
  });

  test("returns InMemoryReportStore for 'memory'", () => {
    expect(createReportStore({ LIVABLY_REPORT_STORE: 'memory' })).toBeInstanceOf(InMemoryReportStore);
  });

  test('throws on an unknown backend name (fail fast, no silent fallback)', () => {
    expect(() => createReportStore({ LIVABLY_REPORT_STORE: 'postgres' })).toThrow(/postgres/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest tests/services/reportStore.test.js -t "createReportStore selector"`
Expected: FAIL — `createReportStore is not a function` (undefined until implemented).

- [ ] **Step 3: Implement createReportStore**

In `src/services/reportStore.js`, add the factory immediately before the `const store = ...` line:

```js
// Selects the report-store backend from config. Unset/`file` keeps today's behavior
// (the default); `memory` is the in-memory rehearsal/test backend. Unknown values
// fail fast rather than silently running a different store than asked for. This one
// switch is where a future external backend (Postgres/object storage) is registered.
function createReportStore(env = process.env) {
  const backend = env.LIVABLY_REPORT_STORE || 'file';
  switch (backend) {
    case 'file': return new FileReportStore();
    case 'memory': return new InMemoryReportStore();
    default:
      throw new Error(`Unknown LIVABLY_REPORT_STORE: "${backend}" (expected "file" or "memory")`);
  }
}
```

Add `createReportStore` to `module.exports`:

```js
module.exports = {
  atomicWrite, FileReportStore, InMemoryReportStore, createReportStore, store,
  saveReport, getReport, updateReportAccess, putArtifact, resolveSharedReport,
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest tests/services/reportStore.test.js -t "createReportStore selector"`
Expected: PASS — all 4 selector tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/reportStore.js tests/services/reportStore.test.js
git commit -m "feat: createReportStore selector (file default | memory) (FR-098)"
```

---

### Task 4: Point the singleton at the selector, leak audit, full verification

**Files:**
- Modify: `src/services/reportStore.js:94` (the singleton line)
- Create: `feature-requests/FR-098-report-store-backend-seam/summary.md`

**Interfaces:**
- Consumes: `createReportStore` (Task 3). No new produced interface.

- [ ] **Step 1: Repoint the singleton through the selector**

In `src/services/reportStore.js`, change the singleton construction:

```js
const store = createReportStore(process.env);
```

(Replaces `const store = new FileReportStore();`. The factory must be defined above this line — Task 3 placed it there.)

- [ ] **Step 2: Run the full report-store test file**

Run: `npx jest tests/services/reportStore.test.js`
Expected: PASS — every block green (both contract runs, file-specific tests, wrappers, selector). The wrappers default to `file`, so behavior is unchanged.

- [ ] **Step 3: Leak audit — confirm nothing bypasses the seam**

Run (Grep tool, or): `git grep -nE "data[\\/]reports|reports\\.json|new FileReportStore|require\\(.*reportStore" -- src`
Expected: the only references to `FileReportStore`/`data/reports`/`reports.json` are inside `src/services/reportStore.js`; every other consumer (`reportBuilder.js`, `app.js`) imports only the wrapper functions. Record the consumer list in `summary.md`. If any consumer reads `data/reports/*` directly or constructs a store itself, that is a leak — note it and route it through a wrapper before finishing.

- [ ] **Step 4: Run the entire suite**

Run: `npx jest`
Expected: PASS — 105 suites, test count up by the net-new tests (≈ 7 in-memory contract + 4 selector + the FileReportStore contract additions). Pristine output, no warnings.

- [ ] **Step 5: Write summary.md**

Create `feature-requests/FR-098-report-store-backend-seam/summary.md` covering: what shipped (contract suite + InMemoryReportStore + selector + repointed singleton), the leak-audit consumer list and its result, the test delta, and the explicit confirmation that no external backend / npm dependency was added. Note the `// shortcut:` logged on `InMemoryReportStore` (non-durable by design) for `SHORTCUTS.md`/roadmap tracking.

- [ ] **Step 6: Commit**

```bash
git add src/services/reportStore.js feature-requests/FR-098-report-store-backend-seam/summary.md
git commit -m "feat: select report-store backend via config; leak audit + summary (FR-098)"
```

---

## Self-Review (completed)

- **Spec coverage:** AC-1 (contract typedef) → documented in the contract runner's header + Task 4 note; AC-2/AC-3 (shared suite, two backends) → Tasks 1–2; AC-4 (selector) → Task 3; AC-5 (singleton + no signature change) → Task 4 Step 1–2; AC-6 (leak audit) → Task 4 Step 3; AC-7 (full suite green) → Task 4 Step 4; AC-8 (no backend/dep) → Global Constraints + Task 4 Step 5. *Note: a formal JSDoc `@typedef ReportStore` should be added atop `reportStore.js` during Task 1 Step 1 or Task 4 — it is the written "contract" of AC-1; the runner is its executable form.*
- **Placeholder scan:** none — every code/test step shows full content.
- **Type consistency:** `runReportStoreContract(makeStore, label)`, `createReportStore(env)`, and the five store methods are named identically across all tasks and the spec.

## Note on base branch
This plan assumes `reportStore.js` post-FR-097 (the hardened `atomicWrite`/`ensureMigrated`/`putArtifact`). FR-098 only edits the class list, the singleton line, and `module.exports` — none of which FR-097 touched except `module.exports` and (FR-097) `putArtifact`/`ensureMigrated` internals. To avoid a conflict and to build on the hardened seam, **merge PR #68 (FR-097) first, then rebase this branch onto `main`** before executing.
```
