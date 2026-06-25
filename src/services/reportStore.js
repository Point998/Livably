'use strict';

const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Atomic write: write a temp sibling then rename over the target. rename(2) is
// atomic on the same filesystem, so a reader never sees a torn file and a crash
// mid-write leaves the previous version intact.
async function atomicWrite(filePath, data) {
  const tmp = `${filePath}.tmp.${crypto.randomBytes(4).toString('hex')}`;
  try {
    await fsp.writeFile(tmp, data, 'utf8');
    await fsp.rename(tmp, filePath);
  } catch (err) {
    // The temp name is random, so a failed write/rename would otherwise orphan it
    // forever. Best-effort cleanup; swallow its error so the original failure propagates.
    await fsp.unlink(tmp).catch(() => {});
    throw err;
  }
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

  // Lazy, idempotent, memoized once per instance: split a legacy single-map
  // data/reports.json into per-file records, then retire it to .bak.
  async ensureMigrated() {
    if (!this._migrated) {
      // Memoize the in-flight/successful migration so it runs once. But a *rejected*
      // promise must not be cached forever — that would brick the store for the whole
      // process after a transient failure. Reset on rejection so a later call retries.
      this._migrated = this._migrate().catch((err) => {
        this._migrated = null;
        throw err;
      });
    }
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

/**
 * The behavioral contract every report-store backend implements. Any conforming
 * backend is a drop-in for the singleton below (see createReportStore). Conformance
 * is enforced by the shared suite in tests/services/reportStoreContract.js.
 *
 * @typedef {Object} ReportStore
 * @property {() => Promise<string>} mintId        Fresh, unused 8-hex id, reserved so a
 *   concurrent mintId can't collide.
 * @property {(id: string, record: object) => Promise<void>} put   Persist the whole
 *   record; atomic last-writer-wins for a single id.
 * @property {(id: string) => Promise<object|null>} get   The stored record (a copy —
 *   callers mutating it must not affect storage), or null for an unknown id, corrupt
 *   data, or an empty reservation stub.
 * @property {(id: string) => Promise<boolean>} touch   Update lastAccessed; false if
 *   the id is absent.
 * @property {() => Promise<void>} ensureMigrated   Idempotent; safe to call before
 *   every op; a no-op for backends with nothing to migrate.
 */

// A Map-backed store mirroring FileReportStore's OBSERVABLE behavior. Its jobs:
// (1) prove the ReportStore contract is portable (a contract test with one impl can't),
// (2) a fast, isolated test fixture, (3) the template a real network backend copies.
// shortcut: intentionally NOT durable (state is lost on process restart) — it is a
// test/rehearsal backend, not production. Revisit only if a real in-memory production
// store is ever needed (it is not the host backend this seam exists for).
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

// Selects the report-store backend from config. Unset/`file` keeps today's behavior
// (the default); `memory` is the in-memory rehearsal/test backend. Unknown values fail
// fast rather than silently running a different store than asked for. This one switch
// is where a future external backend (Postgres/object storage) is registered.
function createReportStore(env = process.env) {
  const backend = env.LIVABLY_REPORT_STORE || 'file';
  switch (backend) {
    case 'file': return new FileReportStore();
    case 'memory': return new InMemoryReportStore();
    default:
      throw new Error(`Unknown LIVABLY_REPORT_STORE: "${backend}" (expected "file" or "memory")`);
  }
}

const store = createReportStore(process.env);

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
  // An artifact carries rendered/derived output only (html/contract/generatedAt/...).
  // Strip identity (address) and creation lifecycle (createdAt) so a stray key in the
  // artifact can't silently clobber the record's canonical values.
  const { address, createdAt, ...safe } = artifact || {};
  await store.put(id, { ...rec, ...safe });
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
  atomicWrite, FileReportStore, InMemoryReportStore, createReportStore, store,
  saveReport, getReport, updateReportAccess, putArtifact, resolveSharedReport,
};
