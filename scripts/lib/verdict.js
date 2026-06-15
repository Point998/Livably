'use strict';

// cells: array of { outcome: 'OK' | 'FAIL' | 'SKIPPED' }
// coverage: 'all' | 'some'
function computeSourceVerdict(coverage, cells) {
  const active = cells.filter((c) => c.outcome !== 'SKIPPED');
  if (active.length === 0) return 'SKIPPED';
  const fails = active.filter((c) => c.outcome === 'FAIL').length;
  if (coverage === 'all') return fails > 0 ? 'FAIL' : 'PASS';
  // coverage 'some'
  if (fails === active.length) return 'FAIL';
  if (fails > 0) return 'INFO';
  return 'PASS';
}

function computeExitCode(verdicts) {
  return verdicts.some((v) => v === 'FAIL') ? 1 : 0;
}

module.exports = { computeSourceVerdict, computeExitCode };
