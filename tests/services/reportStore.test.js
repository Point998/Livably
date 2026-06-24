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
