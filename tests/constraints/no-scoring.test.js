'use strict';

// CONSTRAINT-001: No scoring, grades, or numerical ratings.
// Static analysis of all template source files — catches score-related CSS
// class names that would render visual scoring UI. Complements runtime tests
// by catching violations even when functions return '' for null input.

const fs = require('fs');
const path = require('path');

function readFile(relPath) {
  return fs.readFileSync(path.join(__dirname, '../../src', relPath), 'utf8');
}

const TEMPLATE_FILES = [
  'modules/climate/template.js',
  'modules/community/template.js',
  'modules/costs/template.js',
  'modules/garden/template.js',
  'modules/growth/template.js',
  'modules/property/template.js',
  'modules/reachability/template.js',
  'modules/sensory/template.js',
  'modules/safety/template.js',
  'modules/schools/template.js',
  'modules/traffic/template.js',
  'modules/health/template.js',
  'modules/walkability/template.js',
  'templates/components/badge.js',
  'templates/components/buckets.js',
  'templates/components/checklist.js',
  'templates/components/chapterCard.js',
  'templates/components/destCard.js',
  'templates/components/footer.js',
  'templates/components/keyTakeaway.js',
  'templates/pages/reportPage.js',
  'templates/pages/comparePage.js',
  'templates/pages/errorPage.js',
];

// Patterns that would indicate a scoring UI element.
// Matches CSS class names — the word "score" in prose text is not a violation.
const SCORING_CLASS_PATTERNS = [
  /class="[^"]*\bscore\b/,
  /class="[^"]*\b(?:score-ring|score-value|score-grade|score-band)\b/,
  /class="[^"]*\bgrade-ring\b/,
  // Numeric display classes — e.g. walk-display-num, score-display-num
  /class="[^"]*\bdisplay-num\b/,
];

// Numeric score formats (X/10 or X/100) as standalone rating indicators.
// Uses negative lookbehind to exclude arithmetic chains like `1.5 / 100 / 12`
// (where the digit is preceded by `.`) and negative lookahead to exclude `/100 /`.
const NUMERIC_SCORE_PATTERN = /(?<![a-z_$.])\b[1-9]\d?\s*\/\s*(?:10|100)\b(?!\s*\/)/;

// Index range labels like "walkability index (0–100)" — signals a numeric scoring UI.
const INDEX_RANGE_PATTERN = /index\s*\(\s*0\s*[–-]\s*\d+\s*\)/;

describe('CONSTRAINT-001: No scoring UI in template files', () => {
  TEMPLATE_FILES.forEach((relPath) => {
    test(`${relPath} contains no scoring CSS classes`, () => {
      const src = readFile(relPath);
      SCORING_CLASS_PATTERNS.forEach((pattern) => {
        expect(src).not.toMatch(pattern);
      });
    });

    test(`${relPath} contains no X/10 or X/100 numeric ratings`, () => {
      const src = readFile(relPath);
      expect(src).not.toMatch(NUMERIC_SCORE_PATTERN);
    });

    test(`${relPath} contains no index range labels (0–N)`, () => {
      const src = readFile(relPath);
      expect(src).not.toMatch(INDEX_RANGE_PATTERN);
    });
  });
});
