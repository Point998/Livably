'use strict';

// tasks: array of { provider: string, run: () => Promise<any> }
// Runs all providers in parallel, but caps concurrent calls *within* each
// provider at `limitPerProvider`. Returns results in the original task order.
async function runWithProviderLimit(tasks, limitPerProvider = 2) {
  const results = new Array(tasks.length);
  const byProvider = new Map();
  tasks.forEach((t, i) => {
    if (!byProvider.has(t.provider)) byProvider.set(t.provider, []);
    byProvider.get(t.provider).push(i);
  });

  const runners = [];
  for (const indices of byProvider.values()) {
    let cursor = 0;
    const worker = async () => {
      while (cursor < indices.length) {
        const idx = indices[cursor++];
        results[idx] = await tasks[idx].run();
      }
    };
    const workers = Math.min(limitPerProvider, indices.length);
    for (let k = 0; k < workers; k++) runners.push(worker());
  }
  await Promise.all(runners);
  return results;
}

module.exports = { runWithProviderLimit };
