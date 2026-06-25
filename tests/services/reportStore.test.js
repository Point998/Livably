'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

const { FileReportStore, InMemoryReportStore, createReportStore, atomicWrite } = require('../../src/services/reportStore');
const { runReportStoreContract } = require('./reportStoreContract');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'livably-reports-'));
}

runReportStoreContract(() => new FileReportStore(tmpDir()), 'FileReportStore');
runReportStoreContract(() => new InMemoryReportStore(), 'InMemoryReportStore');

describe('atomicWrite', () => {
  test('writes data and leaves no .tmp file behind', async () => {
    const dir = tmpDir();
    const target = path.join(dir, 'x.json');
    await atomicWrite(target, '{"a":1}');
    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":1}');
    expect(fs.readdirSync(dir).filter((f) => f.includes('.tmp')).length).toBe(0);
  });

  test('removes the temp file when the rename fails (no orphaned .tmp)', async () => {
    const dir = tmpDir();
    const target = path.join(dir, 'as-dir');
    fs.mkdirSync(target); // renaming a file onto an existing directory fails on every platform
    await expect(atomicWrite(target, '{"a":1}')).rejects.toThrow();
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

  test('a failed migration is not cached permanently — a later call retries', async () => {
    const store = new FileReportStore(tmpDir());
    const real = store._migrate.bind(store);
    let calls = 0;
    jest.spyOn(store, '_migrate').mockImplementation(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('transient FS error')) : real();
    });
    await expect(store.ensureMigrated()).rejects.toThrow('transient FS error');
    await expect(store.ensureMigrated()).resolves.toBeUndefined(); // retried, not the cached rejection
    expect(calls).toBe(2);
  });

  test('a successful migration runs once and stays memoized', async () => {
    const store = new FileReportStore(tmpDir());
    const spy = jest.spyOn(store, '_migrate');
    await store.ensureMigrated();
    await store.ensureMigrated();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

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

  test('putArtifact ignores stray address/createdAt in the artifact; canonical identity survives', async () => {
    const id = await mod.saveReport('canonical address');
    const created = (await mod.getReport(id)).createdAt;
    await mod.putArtifact(id, { address: 'EVIL', createdAt: 'EVIL', html: '<h1>x</h1>' });
    const rec = await mod.getReport(id);
    expect(rec.address).toBe('canonical address');
    expect(rec.createdAt).toBe(created);
    expect(rec.html).toBe('<h1>x</h1>');
  });

  test('resolveSharedReport touches lastAccessed on a hit', async () => {
    const id = await mod.saveReport('a');
    const before = (await mod.getReport(id)).lastAccessed;
    await new Promise((r) => setTimeout(r, 5));
    await mod.resolveSharedReport(id);
    await new Promise((r) => setTimeout(r, 5)); // allow fire-and-forget touch to settle
    expect((await mod.getReport(id)).lastAccessed).not.toBe(before);
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
