# Report Store Hardening + Artifact Persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the report store per-file + atomic, persist the rendered artifact, and serve `/r/:reportId` from storage instead of re-rendering — backend-agnostic (NR-004 Stage 1 seam, no deploy decision).

**Architecture:** Replace the single `data/reports.json` map with one atomic file per report (`data/reports/<id>.json`) behind an async `FileReportStore` seam. `buildReport` persists `{address, html, contract, …}` after assembly; `/r/:reportId` serves stored HTML when present, else falls back to today's address-redirect.

**Tech Stack:** Node.js, Express, Jest. Standard library only (`fs.promises`, `crypto`, `path`) — **no new npm dependency**.

## Global Constraints

- **Node:** `>=20` (repo `engines`); CI runs Node 20.x + 22.x — both must stay green.
- **No new npm dependencies** — `fs`/`crypto`/`path` stdlib only (Build-vs-Borrow rung 2).
- **CONSTRAINT-015 (graceful degradation):** persistence failures are non-fatal — report delivery must never break; a store miss/corruption degrades to redirect-regeneration, never a thrown request.
- **CONSTRAINT-011 (tests):** every new store behavior gets a test. (No Jeffersonville case required here — this is a service, not a location-search module.)
- **Async-first seam:** the store + all wrappers are `async`; every caller is updated to `await` (incl. making the currently-sync `/r/:reportId` handler `async`).
- **Contract JSON = source of truth; `html` = derived cache** stored beside it.
- **No `style="`/scoring/Fair-Housing surface** — service layer, no findings or HTML generation here.

---

## File Structure

- `src/services/reportStore.js` — **rewritten.** `atomicWrite` helper, `class FileReportStore` (`mintId`/`put`/`get`/`touch` + lazy `ensureMigrated`), a module singleton `store`, and async wrappers `saveReport`/`getReport`/`updateReportAccess`/`putArtifact`/`resolveSharedReport`. One focused file; a future `PostgresReportStore` becomes a sibling implementing the same class shape.
- `src/services/reportBuilder.js` — **modified** (~line 13 import; ~line 200–201 `await saveReport`; new `await putArtifact` after the `contract` object is built).
- `src/app.js` — **modified** (~line 19 import; ~line 128–133 `/r/:reportId` → `async`, uses `resolveSharedReport`).
- `tests/services/reportStore.test.js` — **rewritten** (real temp-dir, async, per-file + migration + resolve).
- `tests/services/reportBuilder.test.js` — **modified** (mock gains `putArtifact`; `saveReport` mock resolves).

Storage root is overridable via `process.env.LIVABLY_REPORTS_DIR` (default `data/reports/`) so tests point at a temp dir.

---

### Task 1: Atomic write + `FileReportStore` core (mintId / put / get / touch)

**Files:**
- Modify: `src/services/reportStore.js` (full rewrite of internals; wrappers added in Task 3)
- Test: `tests/services/reportStore.test.js` (rewrite begins here)

**Interfaces:**
- Produces:
  - `atomicWrite(filePath: string, data: string): Promise<void>` — temp-file + `rename`.
  - `class FileReportStore { constructor(baseDir?: string); mintId(): Promise<string>; put(id: string, record: object): Promise<void>; get(id: string): Promise<object|null>; touch(id: string): Promise<boolean>; ensureMigrated(): Promise<void>; }`
  - `baseDir` defaults to `process.env.LIVABLY_REPORTS_DIR || path.join(__dirname, '../../data/reports')`.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/services/reportStore.test.js` with (migration + wrapper tests come in Tasks 2–3; this step covers core methods):

```javascript
'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

const { FileReportStore, atomicWrite } = require('../../src/services/reportStore');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'livably-reports-'));
}

describe('atomicWrite', () => {
  test('writes data and leaves no .tmp file behind', async () => {
    const dir = tmpDir();
    const target = path.join(dir, 'x.json');
    await atomicWrite(target, '{"a":1}');
    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":1}');
    expect(fs.readdirSync(dir).filter((f) => f.includes('.tmp')).length).toBe(0);
  });
});

describe('FileReportStore core', () => {
  test('mintId returns a unique 8-char hex and reserves the file', async () => {
    const store = new FileReportStore(tmpDir());
    const id = await store.mintId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    const id2 = await store.mintId();
    expect(id2).not.toBe(id);
  });

  test('put then get round-trips a record', async () => {
    const store = new FileReportStore(tmpDir());
    const id = await store.mintId();
    await store.put(id, { address: '100 Main St', createdAt: 't', lastAccessed: 't' });
    expect((await store.get(id)).address).toBe('100 Main St');
  });

  test('get returns null for unknown id and for corrupt json', async () => {
    const dir = tmpDir();
    const store = new FileReportStore(dir);
    expect(await store.get('deadbeef')).toBeNull();
    await fsp.writeFile(path.join(dir, 'bad99999.json'), 'not json', 'utf8');
    expect(await store.get('bad99999')).toBeNull();
  });

  test('touch updates lastAccessed and returns false for unknown id', async () => {
    const store = new FileReportStore(tmpDir());
    const id = await store.mintId();
    await store.put(id, { address: 'a', createdAt: 't0', lastAccessed: 't0' });
    expect(await store.touch(id)).toBe(true);
    expect((await store.get(id)).lastAccessed).not.toBe('t0');
    expect(await store.touch('unknown00')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/reportStore.test.js`
Expected: FAIL — `FileReportStore`/`atomicWrite` not exported (or not defined).

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `src/services/reportStore.js` with:

```javascript
'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Atomic write: write a temp sibling then rename over the target. rename(2) is
// atomic on the same filesystem, so a reader never sees a torn file and a crash
// mid-write leaves the previous version intact.
async function atomicWrite(filePath, data) {
  const tmp = `${filePath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
  await fsp.writeFile(tmp, data, 'utf8');
  await fsp.rename(tmp, filePath);
}

// One file per report (data/reports/<id>.json). No shared map => no read-modify-write
// race / lost updates, and a `get` reads one small file instead of parsing every
// report (incl. its HTML) on every access. The class shape is the seam a future
// network backend (PostgresReportStore) implements unchanged.
class FileReportStore {
  constructor(baseDir = process.env.LIVABLY_REPORTS_DIR || path.join(__dirname, '../../data/reports')) {
    this.baseDir = baseDir;
    this.legacyFile = path.join(baseDir, '..', 'reports.json');
    this._migrated = null; // set in Task 2
  }

  _file(id) { return path.join(this.baseDir, `${id}.json`); }

  async ensureMigrated() { await fsp.mkdir(this.baseDir, { recursive: true }); } // replaced in Task 2

  async mintId() {
    await this.ensureMigrated();
    for (;;) {
      const id = crypto.randomBytes(4).toString('hex'); // 8 hex chars
      try {
        await fsp.writeFile(this._file(id), '{}', { flag: 'wx' }); // exclusive create = atomic reservation
        return id;
      } catch (err) {
        if (err.code === 'EEXIST') continue;
        throw err;
      }
    }
  }

  async put(id, record) {
    await this.ensureMigrated();
    await atomicWrite(this._file(id), JSON.stringify(record, null, 2));
  }

  async get(id) {
    await this.ensureMigrated();
    try {
      const rec = JSON.parse(await fsp.readFile(this._file(id), 'utf8'));
      // An empty reservation stub ('{}') is not yet a usable record.
      return rec && Object.keys(rec).length ? rec : null;
    } catch {
      return null; // ENOENT or parse error -> self-heal to null (never throw into a request)
    }
  }

  async touch(id) {
    const rec = await this.get(id);
    if (!rec) return false;
    rec.lastAccessed = new Date().toISOString();
    await this.put(id, rec);
    return true;
  }
}

module.exports = { atomicWrite, FileReportStore };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/reportStore.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/reportStore.js tests/services/reportStore.test.js
git commit -m "FR-096: per-file atomic FileReportStore core (mintId/put/get/touch)"
```

---

### Task 2: Idempotent legacy-map migration

**Files:**
- Modify: `src/services/reportStore.js` (replace the placeholder `ensureMigrated`)
- Test: `tests/services/reportStore.test.js` (append a describe block)

**Interfaces:**
- Consumes: `FileReportStore` from Task 1.
- Produces: `ensureMigrated()` now splits a legacy `data/reports.json` map into per-file records (idempotently, memoized once per instance) and renames the legacy file `.bak`.

- [ ] **Step 1: Write the failing test**

Append to `tests/services/reportStore.test.js`:

```javascript
describe('FileReportStore legacy migration', () => {
  test('splits a legacy reports.json map into per-file records and renames it .bak', async () => {
    const dir = tmpDir();
    const legacy = path.join(dir, '..', 'reports.json');
    await fsp.writeFile(legacy, JSON.stringify({
      abc12345: { address: '100 Main St', createdAt: 't', lastAccessed: 't' },
    }), 'utf8');

    const store = new FileReportStore(dir);
    const rec = await store.get('abc12345'); // triggers ensureMigrated

    expect(rec.address).toBe('100 Main St');
    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.existsSync(`${legacy}.bak`)).toBe(true);
  });

  test('does not overwrite a per-file record that already exists', async () => {
    const dir = tmpDir();
    const legacy = path.join(dir, '..', 'reports.json');
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, 'abc12345.json'), JSON.stringify({ address: 'NEW' }), 'utf8');
    await fsp.writeFile(legacy, JSON.stringify({ abc12345: { address: 'OLD' } }), 'utf8');

    const store = new FileReportStore(dir);
    expect((await store.get('abc12345')).address).toBe('NEW');
  });

  test('is a no-op when there is no legacy file', async () => {
    const store = new FileReportStore(tmpDir());
    await store.ensureMigrated();
    expect(await store.get('whatever0')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/reportStore.test.js -t "legacy migration"`
Expected: FAIL — first test errors (legacy file still exists / no `.bak`).

- [ ] **Step 3: Write minimal implementation**

In `src/services/reportStore.js`, replace the placeholder `ensureMigrated` method with:

```javascript
  // Lazy, idempotent, memoized once per instance: split a legacy single-map
  // data/reports.json into per-file records, then retire it to .bak.
  async ensureMigrated() {
    if (!this._migrated) this._migrated = this._migrate();
    return this._migrated;
  }

  async _migrate() {
    await fsp.mkdir(this.baseDir, { recursive: true });
    let raw;
    try {
      raw = await fsp.readFile(this.legacyFile, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return; // nothing to migrate
      throw err;
    }
    let map;
    try { map = JSON.parse(raw); } catch { map = {}; }
    for (const [id, rec] of Object.entries(map)) {
      const file = this._file(id);
      try { await fsp.access(file); continue; } catch { /* not present -> write it */ }
      await atomicWrite(file, JSON.stringify(rec, null, 2));
    }
    await fsp.rename(this.legacyFile, `${this.legacyFile}.bak`);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/reportStore.test.js`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/services/reportStore.js tests/services/reportStore.test.js
git commit -m "FR-096: idempotent legacy reports.json -> per-file migration"
```

---

### Task 3: Async public wrappers + `putArtifact` + `resolveSharedReport`

**Files:**
- Modify: `src/services/reportStore.js` (singleton + wrapper exports)
- Test: `tests/services/reportStore.test.js` (append wrapper + resolve tests)

**Interfaces:**
- Consumes: `FileReportStore` from Tasks 1–2.
- Produces (all async, exported):
  - `saveReport(address: string): Promise<string>` — mint id + persist address stub; returns id.
  - `getReport(id: string): Promise<object|null>`
  - `updateReportAccess(id: string): Promise<boolean>`
  - `putArtifact(id: string, artifact: {html, contract, generatedAt, schemaVersion, degraded}): Promise<void>` — merge artifact into the existing record.
  - `resolveSharedReport(id: string): Promise<{kind:'html', html:string} | {kind:'redirect', address:string} | {kind:'notFound'}>` — get + fire-and-forget touch; prefers stored HTML, falls back to address.

- [ ] **Step 1: Write the failing test**

Append to `tests/services/reportStore.test.js`:

```javascript
describe('public wrappers (singleton, temp dir via env)', () => {
  let mod;
  let dir;
  beforeEach(() => {
    dir = tmpDir();
    process.env.LIVABLY_REPORTS_DIR = dir;
    jest.resetModules();
    mod = require('../../src/services/reportStore');
  });
  afterEach(() => { delete process.env.LIVABLY_REPORTS_DIR; });

  test('saveReport returns an 8-char hex id and persists the address', async () => {
    const id = await mod.saveReport('100 Main St, Louisville, KY');
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect((await mod.getReport(id)).address).toBe('100 Main St, Louisville, KY');
  });

  test('updateReportAccess returns true for a known id, false otherwise', async () => {
    const id = await mod.saveReport('a');
    expect(await mod.updateReportAccess(id)).toBe(true);
    expect(await mod.updateReportAccess('nope00000')).toBe(false);
  });

  test('putArtifact merges html + contract while preserving address', async () => {
    const id = await mod.saveReport('a');
    await mod.putArtifact(id, { html: '<h1>hi</h1>', contract: { schemaVersion: '1.0' }, generatedAt: 't', schemaVersion: '1.0', degraded: false });
    const rec = await mod.getReport(id);
    expect(rec.address).toBe('a');
    expect(rec.html).toBe('<h1>hi</h1>');
    expect(rec.contract.schemaVersion).toBe('1.0');
  });

  test('resolveSharedReport: html hit, redirect fallback, not found', async () => {
    const withHtml = await mod.saveReport('a');
    await mod.putArtifact(withHtml, { html: '<h1>x</h1>', contract: {}, generatedAt: 't', schemaVersion: '1.0', degraded: false });
    expect(await mod.resolveSharedReport(withHtml)).toEqual({ kind: 'html', html: '<h1>x</h1>' });

    const addressOnly = await mod.saveReport('456 Rural Route 1, Harlan, KY');
    expect(await mod.resolveSharedReport(addressOnly)).toEqual({ kind: 'redirect', address: '456 Rural Route 1, Harlan, KY' });

    expect(await mod.resolveSharedReport('missing00')).toEqual({ kind: 'notFound' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/reportStore.test.js -t "public wrappers"`
Expected: FAIL — `saveReport`/`putArtifact`/`resolveSharedReport` not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/services/reportStore.js`, replace the final `module.exports = { atomicWrite, FileReportStore };` line with:

```javascript
const store = new FileReportStore();

async function saveReport(address) {
  const id = await store.mintId();
  const now = new Date().toISOString();
  await store.put(id, { address, createdAt: now, lastAccessed: now });
  return id;
}

function getReport(id) { return store.get(id); }

function updateReportAccess(id) { return store.touch(id); }

async function putArtifact(id, artifact) {
  const now = new Date().toISOString();
  const rec = (await store.get(id)) || { createdAt: now, lastAccessed: now };
  await store.put(id, { ...rec, ...artifact });
}

async function resolveSharedReport(id) {
  const rec = await store.get(id);
  if (!rec) return { kind: 'notFound' };
  store.touch(id).catch(() => {}); // fire-and-forget; access bookkeeping must never block serving
  if (rec.html) return { kind: 'html', html: rec.html };
  if (rec.address) return { kind: 'redirect', address: rec.address };
  return { kind: 'notFound' };
}

module.exports = {
  atomicWrite, FileReportStore, store,
  saveReport, getReport, updateReportAccess, putArtifact, resolveSharedReport,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/reportStore.test.js`
Expected: PASS (all reportStore tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/reportStore.js tests/services/reportStore.test.js
git commit -m "FR-096: async store wrappers + putArtifact + resolveSharedReport"
```

---

### Task 4: Persist the artifact from `buildReport`

**Files:**
- Modify: `src/services/reportBuilder.js` (import ~line 13; `await saveReport` ~line 201; new `await putArtifact` after the `contract` object)
- Test: `tests/services/reportBuilder.test.js` (mock ~line 21–41; beforeEach ~line 54+)

**Interfaces:**
- Consumes: `saveReport`, `putArtifact` from Task 3.

- [ ] **Step 1: Write the failing test**

In `tests/services/reportBuilder.test.js`, add a mock fn declaration next to the others (after line 21 `const mockSaveReport = jest.fn();`):

```javascript
const mockPutArtifact = jest.fn();
```

Change the reportStore mock (line 41) from:

```javascript
jest.mock('../../src/services/reportStore', () => ({ saveReport: mockSaveReport }));
```

to:

```javascript
jest.mock('../../src/services/reportStore', () => ({ saveReport: mockSaveReport, putArtifact: mockPutArtifact }));
```

In the `beforeEach` (around line 54–57), after `jest.clearAllMocks();`, add:

```javascript
  mockSaveReport.mockResolvedValue('abcd1234');
  mockPutArtifact.mockResolvedValue(undefined);
```

Then add this test at the end of the file's main `describe` (or as a new `describe`):

```javascript
describe('buildReport artifact persistence', () => {
  test('persists html + contract for the minted reportId', async () => {
    mockBuildReportHTML.mockReturnValue('<html>report</html>');
    await buildReport('123 Main St, Louisville, KY 40202', {});
    expect(mockSaveReport).toHaveBeenCalledWith('123 Main St, Louisville, KY 40202');
    expect(mockPutArtifact).toHaveBeenCalledTimes(1);
    const [id, artifact] = mockPutArtifact.mock.calls[0];
    expect(id).toBe('abcd1234');
    expect(artifact.html).toBe('<html>report</html>');
    expect(artifact.contract.schemaVersion).toBe('1.0');
  });
});
```

> Note: this file already wires the full happy-path mocks in its existing `beforeEach`. If `buildReport('123 Main St, …')` is not already exercised by a passing test here, reuse the same mock setup the existing success test uses (same `beforeEach`) — do not invent new mock return values.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/services/reportBuilder.test.js -t "artifact persistence"`
Expected: FAIL — `mockPutArtifact` called 0 times (and possibly a TypeError if `putArtifact` isn't imported yet).

- [ ] **Step 3: Write minimal implementation**

In `src/services/reportBuilder.js`, change the import (line 13) from:

```javascript
const { saveReport } = require('./reportStore');
```

to:

```javascript
const { saveReport, putArtifact } = require('./reportStore');
```

Change the mint call (line 200–201) from:

```javascript
  let reportId = null;
  try { reportId = saveReport(address); } catch {}
```

to:

```javascript
  let reportId = null;
  try { reportId = await saveReport(address); } catch {}
```

Then, immediately **after** the `const contract = { … };` object is fully constructed (after its closing `};`, before `buildReport` returns), add:

```javascript
  // FR-096 — persist the rendered artifact so /r/:reportId serves it directly instead of
  // re-rendering. Non-fatal (CONSTRAINT-015): a storage hiccup must never break delivery.
  if (reportId) {
    try {
      await putArtifact(reportId, {
        html,
        contract,
        generatedAt: contract.generatedAt,
        schemaVersion: contract.schemaVersion,
        degraded: contract.degraded,
      });
    } catch (err) {
      logError('putArtifact', address, err);
    }
  }
```

> If the `return` of `buildReport` lives between the `contract` object and the end of the function, place this block immediately before that `return { html, contract, … }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/services/reportBuilder.test.js`
Expected: PASS (existing reportBuilder tests + the new persistence test).

- [ ] **Step 5: Commit**

```bash
git add src/services/reportBuilder.js tests/services/reportBuilder.test.js
git commit -m "FR-096: buildReport persists rendered artifact via putArtifact"
```

---

### Task 5: Serve `/r/:reportId` from storage

**Files:**
- Modify: `src/app.js` (import ~line 19; route ~line 128–133)
- Test: covered by `resolveSharedReport` tests (Task 3) — the route becomes a thin adapter.

**Interfaces:**
- Consumes: `resolveSharedReport` from Task 3.

- [ ] **Step 1: Write the failing test**

The serving decision is already fully tested via `resolveSharedReport` (Task 3, "html hit, redirect fallback, not found"). Add one adapter-level guard test to `tests/services/reportStore.test.js`'s "public wrappers" describe to lock the contract the route depends on:

```javascript
  test('resolveSharedReport touches lastAccessed on a hit', async () => {
    const id = await mod.saveReport('a');
    const before = (await mod.getReport(id)).lastAccessed;
    await new Promise((r) => setTimeout(r, 5));
    await mod.resolveSharedReport(id);
    await new Promise((r) => setTimeout(r, 5)); // allow fire-and-forget touch to settle
    expect((await mod.getReport(id)).lastAccessed).not.toBe(before);
  });
```

- [ ] **Step 2: Run test to verify it fails (then passes — this asserts existing Task 3 behavior)**

Run: `npx jest tests/services/reportStore.test.js -t "touches lastAccessed"`
Expected: PASS (Task 3 already implements the touch). If it FAILS, the fire-and-forget touch in `resolveSharedReport` is wrong — fix it before continuing.

- [ ] **Step 3: Write the route change**

In `src/app.js`, change the import (line 19) from:

```javascript
const { getReport, updateReportAccess } = require('./services/reportStore');
```

to:

```javascript
const { resolveSharedReport } = require('./services/reportStore');
```

Replace the `/r/:reportId` route (lines 128–133) with:

```javascript
app.get('/r/:reportId', async (req, res) => {
  let resolved;
  try {
    resolved = await resolveSharedReport(req.params.reportId);
  } catch (err) {
    logError('shared-report', req.params.reportId, err);
    resolved = { kind: 'notFound' };
  }
  if (resolved.kind === 'html') return res.send(resolved.html);
  if (resolved.kind === 'redirect') {
    return res.redirect(`/report?address=${encodeURIComponent(resolved.address)}`);
  }
  return res.status(404).send(buildErrorHTML('SERVER_ERROR', 'Report not found', 'This link may have expired or is invalid.', null, null));
});
```

- [ ] **Step 4: Verify nothing else references the removed imports + run the suite**

Run: `grep -n "getReport\|updateReportAccess" src/app.js`
Expected: no matches (both were only used by this route).

Run: `npx jest tests/services/reportStore.test.js tests/services/reportBuilder.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app.js tests/services/reportStore.test.js
git commit -m "FR-096: /r/:reportId serves stored artifact, falls back to redirect"
```

---

### Task 6: Full-suite verification + bloat/constraint pass

**Files:** none (verification only)

- [ ] **Step 1: Run the entire suite**

Run: `npx jest`
Expected: all suites green (105 suites baseline + the unchanged count; the rewritten `reportStore.test.js` replaces the old one 1:1). If any snapshot or integration test references the old single-map `reports.json` shape, update it to the per-file shape and re-run.

- [ ] **Step 2: Confirm no leftover legacy references**

Run: `grep -rn "loadReports\|ensureReportsFile\|reports.json" src/ tests/`
Expected: only the intended references remain (the migration's `legacyFile`/`.bak` handling in `reportStore.js`). `loadReports`/`ensureReportsFile` are gone; if any other file imported them, replace with the new wrappers.

- [ ] **Step 3: Bloat/constraint self-check**

Confirm: no new npm dependency added; the `FileReportStore` class is one impl (no premature `index.js`/selector indirection — that lands with the second backend); persistence is non-fatal everywhere (CONSTRAINT-015); `contract` stored as source of truth with `html` as cache.

- [ ] **Step 4: Commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "FR-096: full-suite verification + legacy-reference cleanup"
```

---

## Notes for the implementer

- **Two writes per generation are intentional:** `saveReport` reserves the id + address stub early (so the share link embedded in the HTML always resolves to *something*, even if assembly later throws), then `putArtifact` fills the artifact. Don't collapse them.
- **`mintId` writes a `'{}'` reservation stub;** `get` treats a 0-key record as `null` so a reserved-but-unfilled id doesn't read back as a usable report. This is why the empty-object guard exists — keep it.
- **Tracked follow-ups (out of scope — the bridge):** external backend (`PostgresReportStore`/object store) behind this same class; `/report?address=` serve-from-store (needs the deferred identity/dedup decision); TTL/eviction of artifacts; atomic-writing the other file stores (logger, errorMemory). Log these in the FR summary, don't build them.
