'use strict';
const SHORT = (addr) => addr.split(',')[1]?.trim().slice(0, 4).toUpperCase() || addr.slice(0, 4);

// rows: [{ module, id, verdict, cells: [{ outcome, reason }] }]
// contexts: [{ address, error? }]
function renderMatrix(rows, contexts) {
  const usable = contexts.filter((c) => !c.error);
  const headers = usable.map((c) => SHORT(c.address).padEnd(5));
  const sym = (o) => (o === 'OK' ? 'OK  ' : o === 'FAIL' ? 'FAIL' : '--  ');
  const lines = [];
  lines.push(`${'SOURCE (module)'.padEnd(30)} ${headers.join(' ')}  VERDICT`);
  for (const r of rows) {
    const cells = r.cells.map((c) => sym(c.outcome)).join(' ');
    lines.push(`${`${r.id} (${r.module})`.padEnd(30)} ${cells}  ${r.verdict}`);
  }
  // failing-cell reasons
  const reasons = [];
  for (const r of rows) {
    r.cells.forEach((c, i) => {
      if (c.outcome === 'FAIL') reasons.push(`  ${r.module}/${r.id} @ ${SHORT(usable[i].address)}: ${c.reason}`);
    });
  }
  const tally = (v) => rows.filter((r) => r.verdict === v).length;
  lines.push('');
  lines.push(`${tally('FAIL')} FAIL · ${tally('INFO')} INFO · ${tally('PASS')} PASS · ${tally('SKIPPED')} SKIPPED`);
  for (const c of contexts.filter((c) => c.error)) lines.push(`! geocode failed: ${c.address} — ${c.error}`);
  if (reasons.length) { lines.push('', 'Failures:', ...reasons); }
  return lines.join('\n');
}

module.exports = { renderMatrix };
