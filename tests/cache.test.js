'use strict';

// FR-058 regression: cache namespaces where one is a prefix of another
// (e.g. `drivetime` vs `drivetime_cell`) must not interfere. clear()/stats()
// previously matched files by startsWith(`${namespace}_`), so clearing the
// short-namespace cache also wiped the long-namespace one — destroying the
// 14-day cell cache whenever app.js called driveTimeCache.clear().

const { Cache } = require('../src/cache');

// Throwaway namespaces (one a prefix of the other) so we never touch real caches.
const outer = new Cache('zztest', 60);
const inner = new Cache('zztest_sub', 60);

afterEach(() => { outer.clear(); inner.clear(); });

describe('Cache namespace isolation (prefix collision)', () => {
  test('clearing a namespace does not delete a longer namespace that shares its prefix', () => {
    outer.set('a', 1);
    inner.set('b', 2);
    outer.clear();
    expect(outer.get('a')).toBeNull();   // cleared
    expect(inner.get('b')).toBe(2);      // survives — different namespace
  });

  test('stats counts only files of the exact namespace, not prefix-sharing ones', () => {
    outer.set('a', 1);
    inner.set('b', 2);
    inner.set('c', 3);
    expect(outer.stats()).toBe(1); // only outer's own file
    expect(inner.stats()).toBe(2); // only inner's own files
  });
});

describe('LIVABLY_VERIFY cache bypass', () => {
  const { Cache } = require('../src/cache');
  afterEach(() => { delete process.env.LIVABLY_VERIFY; });

  test('get returns null and set is a no-op when LIVABLY_VERIFY=1', () => {
    const c = new Cache('verifytest', 3600);
    process.env.LIVABLY_VERIFY = '1';
    c.set('k', { v: 1 });        // no-op
    expect(c.get('k')).toBeNull(); // bypassed read
    delete process.env.LIVABLY_VERIFY;
    expect(c.get('k')).toBeNull(); // confirms nothing was written
  });
});
