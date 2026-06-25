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
