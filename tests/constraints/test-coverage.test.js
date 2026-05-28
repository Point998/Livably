'use strict';

// CONSTRAINT-011: No feature ships without tests.
// Meta-test: every src/modules/*/data.js must have a corresponding
// tests/modules/*/data.test.js. Prevents new modules from being added
// without a test file.

const fs = require('fs');
const path = require('path');

const MODULES_SRC  = path.join(__dirname, '../../src/modules');
const MODULES_TEST = path.join(__dirname, '../modules');

function getModuleNames() {
  return fs.readdirSync(MODULES_SRC, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

describe('CONSTRAINT-011: Every data.js module has a test file', () => {
  const moduleNames = getModuleNames();

  test('at least one module exists to validate against', () => {
    expect(moduleNames.length).toBeGreaterThan(0);
  });

  moduleNames.forEach((mod) => {
    const dataPath = path.join(MODULES_SRC, mod, 'data.js');
    const testPath = path.join(MODULES_TEST, mod, 'data.test.js');

    if (!fs.existsSync(dataPath)) return; // module without data.js is fine

    test(`${mod}/data.js has a corresponding tests/modules/${mod}/data.test.js`, () => {
      const exists = fs.existsSync(testPath);
      if (!exists) {
        throw new Error(
          `Missing test file: tests/modules/${mod}/data.test.js\n` +
          `Add tests before shipping src/modules/${mod}/data.js (CONSTRAINT-011)`
        );
      }
      expect(exists).toBe(true);
    });
  });
});
