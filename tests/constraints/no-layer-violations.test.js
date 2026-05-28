'use strict';

// CONSTRAINT-009: No design decisions in data or logic layers.
//   data.js files: no HTML strings, no API calls from template code
//   template files: no direct API client requires
//
// CONSTRAINT-014: The Logic Layer owns all coherence rules.
//   No module data.js may implement its own cross-state comparison logic.
//   All state comparisons live exclusively in src/shared/validate.js.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.join(__dirname, '../../src');

function readFile(absPath) {
  return fs.readFileSync(absPath, 'utf8');
}

function globDataFiles() {
  const modulesDir = path.join(SRC, 'modules');
  const mods = fs.readdirSync(modulesDir);
  return mods
    .map((m) => path.join(modulesDir, m, 'data.js'))
    .filter((p) => fs.existsSync(p));
}

function globTemplateFiles() {
  function walk(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...walk(full));
      else if (entry.name.endsWith('.js')) results.push(full);
    }
    return results;
  }
  return walk(path.join(SRC, 'templates'));
}

// Detects HTML tag patterns likely from a return value in a data.js function.
// A data.js shouldn't return strings starting with '<' — that's template territory.
const HTML_RETURN_PATTERN = /return\s+[`'"]<[a-z]/i;

// Direct API client usage that belongs only in data.js, not templates.
const TEMPLATE_API_PATTERNS = [
  /require\(['"`]axios['"`]\)/,
  /require\(['"`]@googlemaps/,
  /googleMapsClient\s*\./,
  /require\(['"`]\.\.\/\.\.\/shared\/google\/client['"`]\)/,
];

// Cross-state filtering logic that must only live in shared/validate.js.
// A data.js module implementing its own state check bypasses CONSTRAINT-014.
const STATE_COMPARISON_PATTERN = /(?:resultState|state)\s*===\s*(?:originState|state)|(?:originState|state)\s*!==?\s*\w+State/;

describe('CONSTRAINT-009: No HTML in data.js files', () => {
  const dataFiles = globDataFiles();

  test('found at least one data.js file to check', () => {
    expect(dataFiles.length).toBeGreaterThan(0);
  });

  dataFiles.forEach((absPath) => {
    const label = absPath.replace(SRC, 'src');
    test(`${label} does not return HTML strings`, () => {
      const src = readFile(absPath);
      expect(src).not.toMatch(HTML_RETURN_PATTERN);
    });
  });
});

describe('CONSTRAINT-009: No API client requires in template files', () => {
  const templateFiles = globTemplateFiles();

  test('found at least one template file to check', () => {
    expect(templateFiles.length).toBeGreaterThan(0);
  });

  templateFiles.forEach((absPath) => {
    const label = absPath.replace(SRC, 'src');
    TEMPLATE_API_PATTERNS.forEach((pattern) => {
      test(`${label} does not require API clients (${pattern.source.slice(0, 30)}...)`, () => {
        const src = readFile(absPath);
        expect(src).not.toMatch(pattern);
      });
    });
  });
});

describe('CONSTRAINT-014: No module data.js implements its own state comparison', () => {
  const dataFiles = globDataFiles();

  dataFiles.forEach((absPath) => {
    const label = absPath.replace(SRC, 'src');
    test(`${label} delegates state checks to shared/validate.js`, () => {
      const src = readFile(absPath);
      expect(src).not.toMatch(STATE_COMPARISON_PATTERN);
    });
  });
});
