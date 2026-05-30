'use strict';

// CONSTRAINT-014: The Logic Layer owns all coherence rules.
// src/shared/validate.js is the single place for cross-state filtering, rural detection,
// and drive-time coherence. No module data.js may implement these independently.
// Static analysis — catches inline state comparison logic in module data files.

const fs = require('fs');
const path = require('path');

function findModuleDataFiles() {
  const modulesDir = path.join(__dirname, '../../src/modules');
  const result = [];
  for (const mod of fs.readdirSync(modulesDir)) {
    const f = path.join(modulesDir, mod, 'data.js');
    if (fs.existsSync(f)) result.push({ mod, filePath: f });
  }
  return result;
}

const MODULE_DATA_FILES = findModuleDataFiles();

describe('CONSTRAINT-014: No module data.js implements its own coherence logic', () => {
  MODULE_DATA_FILES.forEach(({ mod, filePath }) => {
    test(`${mod}/data.js contains no inline state comparison logic`, () => {
      const src = fs.readFileSync(filePath, 'utf8');
      // Direct state string equality — cross-state filtering belongs in validate.js
      expect(src).not.toMatch(/\.state\s*===\s*['"][A-Z]{2}['"]/);
      expect(src).not.toMatch(/\.state\s*!==\s*['"][A-Z]{2}['"]/);
    });

    test(`${mod}/data.js does not call detectRuralMode directly`, () => {
      const src = fs.readFileSync(filePath, 'utf8');
      // Rural mode detection belongs in validate.js::detectRuralMode — not per-module
      // (accepting ruralMode as a parameter is fine; computing it inline is not)
      // Strip single-line comments to avoid false positives from doc comments
      const noComments = src.replace(/\/\/[^\n]*/g, '');
      expect(noComments).not.toMatch(/detectRuralMode\s*\(/);
    });
  });
});
