'use strict';
// Live verification: bypass caches BEFORE anything loads the cache module.
process.env.LIVABLY_VERIFY = '1';
require('dotenv').config();

const path = require('path');
const TEST_ADDRESSES = require('./lib/testAddresses');
const { resolveContexts } = require('./lib/resolveContext');
const { discoverSources } = require('./lib/discoverSources');
const { evaluateCell } = require('./lib/evaluateCell');
const { runWithProviderLimit } = require('./lib/pool');
const { computeSourceVerdict, computeExitCode } = require('./lib/verdict');
const { renderMatrix } = require('./lib/render');

const PROVIDER_LIMIT = 2;

async function main() {
  const asJson = process.argv.includes('--json');
  const contexts = await resolveContexts(TEST_ADDRESSES);
  const usable = contexts.filter((c) => !c.error);
  if (usable.length === 0) {
    console.error('All addresses failed to geocode — cannot verify sources.');
    process.exit(1);
  }

  const sources = discoverSources(path.join(__dirname, '..', 'src', 'modules'));

  // Build one task per (source × usable ctx), tagged by provider for the pool.
  const tasks = [];
  const index = []; // parallel: { sourceIdx, ctxIdx }
  sources.forEach((s, si) => {
    usable.forEach((ctx, ci) => {
      tasks.push({ provider: s.provider || s.module, run: () => evaluateCell(s, ctx) });
      index.push({ si, ci });
    });
  });

  const cellResults = await runWithProviderLimit(tasks, PROVIDER_LIMIT);

  // Regroup flat results back into per-source cell arrays (ctx order preserved).
  const rows = sources.map((s, si) => {
    const cells = usable.map((_, ci) => {
      const flat = index.findIndex((x) => x.si === si && x.ci === ci);
      return cellResults[flat];
    });
    return { module: s.module, id: s.id, verdict: computeSourceVerdict(s.coverage, cells), cells };
  });

  const exitCode = computeExitCode(rows.map((r) => r.verdict));

  if (asJson) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      addresses: contexts.map((c) => ({ address: c.address, error: c.error || null })),
      sources: rows,
      exitCode,
    }, null, 2));
  } else {
    console.log(renderMatrix(rows, contexts));
  }
  process.exit(exitCode);
}

main().catch((e) => { console.error('verify:sources fatal:', e); process.exit(1); });
