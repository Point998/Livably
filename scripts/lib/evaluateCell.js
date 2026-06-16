'use strict';

function isBlank(v) { return v == null || String(v).trim() === ''; }
const isRateLimit = (msg) => /\b429\b|rate.?limit/i.test(String(msg || ''));

// One attempt → { outcome: 'OK'|'FAIL'|'RATELIMIT', reason }
async function attempt(source, ctx) {
  if (typeof source.probe === 'function') {
    let status;
    try { status = await source.probe(ctx); }
    catch (e) {
      if (isRateLimit(e.message)) return { outcome: 'RATELIMIT', reason: e.message };
      return { outcome: 'FAIL', reason: `probe threw: ${e.message}` };
    }
    if (status === 429) return { outcome: 'RATELIMIT', reason: 'probe 429' };
    if (!(status >= 200 && status < 400)) return { outcome: 'FAIL', reason: `probe status ${status}` };
  }
  let result;
  try { result = await source.run(ctx); }
  catch (e) {
    if (isRateLimit(e.message)) return { outcome: 'RATELIMIT', reason: e.message };
    return { outcome: 'FAIL', reason: e.message || 'run threw' };
  }
  if (source.isValid(result)) return { outcome: 'OK', reason: '' };
  return { outcome: 'FAIL', reason: 'isValid returned false' };
}

// Full cell evaluation: skip rules → flap tolerance (retry once) → final outcome.
async function evaluateCell(source, ctx, opts = {}) {
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const retryDelayMs = opts.retryDelayMs ?? 500;

  if (source.status === 'deferred') return { outcome: 'SKIPPED', reason: 'deferred' };
  if (source.requiresKey && isBlank(process.env[source.requiresKey])) {
    return { outcome: 'SKIPPED', reason: 'no key' };
  }

  let res = await attempt(source, ctx);
  if (res.outcome === 'OK') return { outcome: 'OK', reason: res.reason };

  await sleep(retryDelayMs);
  res = await attempt(source, ctx);
  if (res.outcome === 'OK') return { outcome: 'OK', reason: res.reason };
  if (res.outcome === 'RATELIMIT') return { outcome: 'SKIPPED', reason: 'rate-limited' };
  return { outcome: 'FAIL', reason: res.reason };
}

module.exports = { evaluateCell, attempt };
