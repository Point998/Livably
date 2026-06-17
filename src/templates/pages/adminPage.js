'use strict';

const { escapeHtml } = require('../../utils/text');

function buildAdminHealthHTML({ patterns, mitigations, recentErrors, usage, degradation }) {
  const pct = (n) => (n == null ? 'N/A' : `${(n * 100).toFixed(1)}%`);

  // FR-068 — source-chain degradation panel. Rows are sourceChain labels; counts
  // are fallback (served a non-primary source) / exhausted (all sources failed).
  const degRows = (degradation?.rows || []).map((r) => `
      <tr style="background:${r.exhausted > 0 ? '#fff3cd' : 'transparent'}">
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${escapeHtml(r.label)}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:${r.fallback ? '600' : '400'}">${r.fallback}</td>
        <td style="padding:6px 10px;text-align:right;color:${r.exhausted ? '#b8922a' : '#1a1a1a'};font-weight:${r.exhausted ? '600' : '400'}">${r.exhausted}</td>
        <td style="padding:6px 10px;text-align:right">${r.miss}</td>
        <td style="padding:6px 10px;text-align:right">${r.error}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${escapeHtml((r.sources || []).join(', ') || '—')}</td>
        <td style="padding:6px 10px;font-size:12px;color:#888">${r.lastTs ? new Date(r.lastTs).toLocaleString() : '—'}</td>
      </tr>`).join('');
  const flagged = Object.entries(patterns?.functions || {}).filter(([, f]) => f.flagged);

  const fnRows = Object.entries(patterns?.functions || {})
    .sort(([, a], [, b]) => b.failureRate - a.failureRate)
    .map(([fn, f]) => `
      <tr style="background:${f.flagged ? '#fff3cd' : 'transparent'}">
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${fn}</td>
        <td style="padding:6px 10px;text-align:right">${f.failures}</td>
        <td style="padding:6px 10px;text-align:right;color:${f.flagged ? '#b8922a' : '#1a1a1a'};font-weight:${f.flagged ? '600' : '400'}">${pct(f.failureRate)}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${f.topErrors[0] || '—'}</td>
      </tr>`).join('');

  const mitRows = Object.entries(mitigations)
    .filter(([k]) => k !== 'updatedAt')
    .map(([fn, m]) => `
      <tr>
        <td style="padding:6px 10px;font-family:monospace;font-size:13px">${fn}</td>
        <td style="padding:6px 10px">${JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => !['reason','appliedAt'].includes(k))))}</td>
        <td style="padding:6px 10px;font-size:12px;color:#555">${m.reason || '—'}</td>
        <td style="padding:6px 10px;font-size:12px;color:#888">${m.appliedAt ? new Date(m.appliedAt).toLocaleDateString() : '—'}</td>
      </tr>`).join('');

  const errorRows = recentErrors.map((e) => `
    <tr>
      <td style="padding:5px 10px;font-size:12px;color:#888">${new Date(e.ts).toLocaleTimeString()}</td>
      <td style="padding:5px 10px;font-family:monospace;font-size:12px">${e.fn || '—'}</td>
      <td style="padding:5px 10px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(e.address || '')}">${escapeHtml((e.address || '').slice(0, 40))}</td>
      <td style="padding:5px 10px;font-size:12px;color:#c0392b">${escapeHtml(e.errorMsg || '')}</td>
    </tr>`).join('');

  const apiRows = Object.entries(usage.byEndpoint || {})
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([ep, s]) => `
      <tr>
        <td style="padding:5px 10px;font-family:monospace;font-size:12px">${ep}</td>
        <td style="padding:5px 10px;text-align:right">${s.total}</td>
        <td style="padding:5px 10px;text-align:right">${s.total > 0 ? pct(s.success / s.total) : 'N/A'}</td>
      </tr>`).join('');

  const stats = patterns?.requestStats;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Livably — Health Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 24px; background: #faf8f4; color: #1a1a1a; font-family: 'DM Sans', sans-serif; font-size: 14px; }
    h1 { font-family: 'Fraunces', serif; font-size: 24px; margin: 0 0 4px; }
    h2 { font-family: 'Fraunces', serif; font-size: 16px; margin: 28px 0 10px; color: #1a1a1a; border-bottom: 1px solid #e0dcd4; padding-bottom: 6px; }
    .meta { color: #888; font-size: 12px; margin-bottom: 24px; }
    .cards { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
    .card { background: #fff; border: 1px solid #e0dcd4; border-radius: 8px; padding: 14px 20px; min-width: 140px; }
    .card-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
    .card-value { font-size: 26px; font-weight: 600; margin-top: 2px; }
    .card-value.warn { color: #b8922a; }
    .card-value.ok { color: #2e7d32; }
    .flag-banner { background: #fff3cd; border: 1px solid #b8922a; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e0dcd4; border-radius: 8px; overflow: hidden; }
    th { text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #888; background: #f4f1eb; border-bottom: 1px solid #e0dcd4; }
    tr + tr td { border-top: 1px solid #f0ece4; }
    .empty { color: #aaa; font-size: 13px; padding: 16px; text-align: center; }
  </style>
</head>
<body>
  <h1>Livably Health Dashboard</h1>
  <div class="meta">7-day window · analyzed ${patterns?.analyzedAt ? new Date(patterns.analyzedAt).toLocaleString() : 'never'} · API usage resets on restart</div>

  ${flagged.length ? `<div class="flag-banner">⚠️ <strong>${flagged.length} function${flagged.length > 1 ? 's' : ''} flagged:</strong> ${flagged.map(([fn, f]) => `${fn} (${pct(f.failureRate)})`).join(', ')}</div>` : ''}

  <div class="cards">
    <div class="card">
      <div class="card-label">Total Requests (7d)</div>
      <div class="card-value">${stats?.total ?? '—'}</div>
    </div>
    <div class="card">
      <div class="card-label">Success Rate (7d)</div>
      <div class="card-value ${stats?.successRate >= 0.9 ? 'ok' : stats?.successRate >= 0.7 ? 'warn' : 'warn'}">${pct(stats?.successRate)}</div>
    </div>
    <div class="card">
      <div class="card-label">Errors (7d)</div>
      <div class="card-value ${(stats?.error || 0) > 0 ? 'warn' : 'ok'}">${stats?.error ?? '—'}</div>
    </div>
    <div class="card">
      <div class="card-label">API Calls (24h)</div>
      <div class="card-value">${usage.last24h}</div>
    </div>
    <div class="card">
      <div class="card-label">API Success (24h)</div>
      <div class="card-value">${usage.successRate}</div>
    </div>
  </div>

  <h2>Source-Chain Degradation (7d)</h2>
  <div class="meta">${degradation ? `${degradation.reportsAffected} report${degradation.reportsAffected === 1 ? '' : 's'} ran on a fallback · ${degradation.totalFallbacks} fallback win${degradation.totalFallbacks === 1 ? '' : 's'} · ${degradation.totalExhausted} exhausted (link-floor)` : 'unavailable'}</div>
  ${degRows ? `<table><thead><tr><th>Source chain</th><th style="text-align:right">Fallback</th><th style="text-align:right">Exhausted</th><th style="text-align:right">Miss</th><th style="text-align:right">Error</th><th>Sources seen</th><th>Last seen</th></tr></thead><tbody>${degRows}</tbody></table>` : '<p class="empty">No source-chain degradation recorded — every chain served its primary source.</p>'}

  <h2>Function Failure Rates (7d)</h2>
  ${fnRows ? `<table><thead><tr><th>Function</th><th style="text-align:right">Failures</th><th style="text-align:right">Rate</th><th>Top Error</th></tr></thead><tbody>${fnRows}</tbody></table>` : '<p class="empty">No function errors recorded yet.</p>'}

  <h2>Active Mitigations</h2>
  ${mitRows ? `<table><thead><tr><th>Function</th><th>Value</th><th>Reason</th><th>Applied</th></tr></thead><tbody>${mitRows}</tbody></table>` : '<p class="empty">No mitigations active.</p>'}

  <h2>Recent Errors (today, last 20)</h2>
  ${errorRows ? `<table><thead><tr><th>Time</th><th>Function</th><th>Address</th><th>Error</th></tr></thead><tbody>${errorRows}</tbody></table>` : '<p class="empty">No errors logged today.</p>'}

  <h2>API Usage by Endpoint (24h)</h2>
  ${apiRows ? `<table><thead><tr><th>Endpoint</th><th style="text-align:right">Calls</th><th style="text-align:right">Success Rate</th></tr></thead><tbody>${apiRows}</tbody></table>` : '<p class="empty">No API calls recorded.</p>'}
</body>
</html>`;
}

module.exports = { buildAdminHealthHTML };
