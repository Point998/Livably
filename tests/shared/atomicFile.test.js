const fs = require('fs');
const os = require('os');
const path = require('path');
const { atomicWriteFileSync } = require('../../src/shared/atomicFile');

describe('atomicWriteFileSync', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomicfile-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function siblings(target) {
    const base = path.basename(target);
    return fs.readdirSync(path.dirname(target)).filter((f) => f.startsWith(`${base}.tmp.`));
  }

  test('writes the exact content to the target', () => {
    const target = path.join(dir, 'out.json');
    atomicWriteFileSync(target, '{"a":1}');
    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":1}');
  });

  test('overwrites an existing file with the new complete content', () => {
    const target = path.join(dir, 'out.json');
    fs.writeFileSync(target, '{"old":true}', 'utf8');
    atomicWriteFileSync(target, '{"new":true}');
    expect(fs.readFileSync(target, 'utf8')).toBe('{"new":true}');
  });

  test('leaves no temp sibling after a successful write', () => {
    const target = path.join(dir, 'out.json');
    atomicWriteFileSync(target, 'payload');
    expect(siblings(target)).toEqual([]);
  });

  test('on rename failure: cleans up the temp file, preserves the original, and rethrows', () => {
    // Target is a directory -> renameSync over it fails on every platform.
    const target = path.join(dir, 'occupied');
    fs.mkdirSync(target);

    expect(() => atomicWriteFileSync(target, 'payload')).toThrow();
    // The original target (the directory) is untouched, and no temp file is orphaned.
    expect(fs.statSync(target).isDirectory()).toBe(true);
    expect(siblings(target)).toEqual([]);
  });
});
