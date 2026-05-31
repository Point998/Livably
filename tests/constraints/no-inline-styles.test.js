'use strict';

// CONSTRAINT-008: No inline styles in HTML generators.
// All visual appearance lives in report.css and design-tokens.css.
// CSS custom properties set via style (e.g. style="--path-len:80") are
// accepted — they're data/value tokens, not direct visual declarations.
// This test catches real CSS property assignments (style="width:...", etc.)

const fs = require('fs');
const path = require('path');

function readFile(relPath) {
  return fs.readFileSync(path.join(__dirname, '../../src', relPath), 'utf8');
}

// All chapter and component template files. adminPage.js is internal tooling
// exempt from the constraint (it has no public CSS to enforce against).
const CHAPTER_FILES = [
  'templates/chapters/climate.js',
  'templates/chapters/community.js',
  'templates/chapters/costs.js',
  'templates/chapters/garden.js',
  'templates/chapters/growth.js',
  'templates/chapters/property.js',
  'templates/chapters/reachability.js',
  'templates/chapters/sensory.js',
  'modules/safety/template.js',
  'templates/chapters/traffic.js',
  'modules/health/template.js',
  'modules/schools/template.js',
  'modules/walkability/template.js',
];

const COMPONENT_FILES = [
  'templates/components/badge.js',
  'templates/components/buckets.js',
  'templates/components/checklist.js',
  'templates/components/chapterCard.js',
  'templates/components/destCard.js',
  'templates/components/footer.js',
  'templates/components/keyTakeaway.js',
];

const PAGE_FILES = [
  'templates/pages/reportPage.js',
  'templates/pages/comparePage.js',
  'templates/pages/errorPage.js',
];

// Matches style=" not followed by -- (CSS custom property prefix).
// style="--path-len:80" is accepted; style="width:50%" is not.
const INLINE_STYLE_PATTERN = /style="(?!--)[^"]+"/;

const ALL_FILES = [...CHAPTER_FILES, ...COMPONENT_FILES, ...PAGE_FILES];

describe('CONSTRAINT-008: No inline CSS property declarations in template files', () => {
  ALL_FILES.forEach((relPath) => {
    test(`${relPath} contains no inline style attributes with CSS properties`, () => {
      const src = readFile(relPath);
      const matches = src.match(new RegExp(INLINE_STYLE_PATTERN.source, 'g')) || [];
      expect(matches).toHaveLength(0);
    });
  });
});
