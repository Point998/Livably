'use strict';

const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { geocodeCache, placesCache, driveTimeCache, cacheStats } = require('./cache');
const { getUsageStats } = require('./rateLimit');
const { googleMapsApiKey } = require('./shared/google/client');
const { toTitleCase, slugify, getDateSlug } = require('./utils/text');
const { MAX_CONCURRENT_PDFS } = require('./utils/constants');
const { logError, logRequest, logAnalysis, readRecentLogs } = require('./logger');
const { loadMitigations } = require('./errorMemory');

const { buildReport, classifyError } = require('./services/reportBuilder');
const { getReport, updateReportAccess } = require('./services/reportStore');
const { generateComparisonData } = require('./services/compareBuilder');
const { buildErrorHTML, buildLoadingHTML } = require('./templates/pages/errorPage');
const { buildCompareFormHTML, buildCompareLoadingHTML, buildCompareResultsHTML } = require('./templates/pages/comparePage');
const { buildAdminHealthHTML } = require('./templates/pages/adminPage');

const { validateConfig } = require('./config');
const { makeRequireAdmin } = require('./middleware/adminAuth');

let config;
try {
  config = validateConfig();
} catch (err) {
  console.error(`[config] FATAL: ${err.message}`);
  process.exit(1);
}

const app = express();
const port = config.port;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-inline' is REQUIRED: report/compare/error/loading templates emit
      // inline <script> and the loading page dynamically re-executes scripts.
      // Nonce/hash CSP would break rendering. Stage 0 compromise — externalizing
      // inline scripts to enable a strict script-src is a future hardening pass.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.static(path.join(__dirname, '../public')));

// ── Report ────────────────────────────────────────────────────────────────────

app.get('/report', async (req, res) => {
  const address = req.query.address ? toTitleCase(req.query.address.trim()) : '';
  const isFetch = req.query.fetch === '1';

  if (!address) return res.send(buildErrorHTML('SERVER_ERROR', 'No address provided', 'Please go back and enter an address.', null, null));
  if (!googleMapsApiKey) return res.send(buildErrorHTML('SERVER_ERROR', 'Configuration error', 'The server is missing required API credentials.', null, null));
  if (!isFetch) return res.send(buildLoadingHTML(address));

  const _reqStart = Date.now();
  try {
    const options = {
      customDestName: req.query.customDestName,
      customDestAddress: req.query.customDestAddress,
      customDestType: req.query.customDestType,
    };
    const { html } = await buildReport(address, options);
    return res.send(html);
  } catch (error) {
    const { type, title, message, retryAfter } = classifyError(error);
    logError('report', address, error);
    logRequest(address, 'error', Date.now() - _reqStart, type);
    logAnalysis();
    return res.send(buildErrorHTML(type, title, message, address, retryAfter));
  }
});

// ── Shared report link ────────────────────────────────────────────────────────

app.get('/r/:reportId', (req, res) => {
  const report = getReport(req.params.reportId);
  if (!report) return res.status(404).send(buildErrorHTML('SERVER_ERROR', 'Report not found', 'This link may have expired or is invalid.', null, null));
  try { updateReportAccess(req.params.reportId); } catch {}
  return res.redirect(`/report?address=${encodeURIComponent(report.address)}`);
});

// ── Compare ───────────────────────────────────────────────────────────────────

app.get('/compare', async (req, res) => {
  const addressesParam = req.query.addresses;
  if (!addressesParam) return res.send(buildCompareFormHTML());
  if (req.query.fetch !== '1') return res.send(buildCompareLoadingHTML(addressesParam));

  const addresses = addressesParam.split('|').map((a) => a.trim()).filter(Boolean).slice(0, 3);
  if (addresses.length < 2) return res.send(buildErrorHTML('SERVER_ERROR', 'At least 2 addresses required', 'Please go back and enter at least 2 addresses.', null, null));

  const reportResults = await Promise.allSettled(addresses.map((addr) => generateComparisonData(addr)));
  const reports = reportResults.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { address: addresses[i], error: r.reason?.message || 'Unknown error' },
  );
  return res.send(buildCompareResultsHTML(reports));
});

// ── Admin ─────────────────────────────────────────────────────────────────────

// Guards every /admin/* route below — loopback OR matching x-admin-token (FR-064).
app.use('/admin', makeRequireAdmin(() => config.adminToken));

app.get('/admin/health', (req, res) => {
  let patterns = null;
  try { patterns = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/error-patterns.json'), 'utf8')); } catch {}
  const mitigations = loadMitigations();
  const recentErrors = readRecentLogs(1).filter((e) => e.type === 'error').slice(-20).reverse();
  const usage = getUsageStats();

  return res.send(buildAdminHealthHTML({ patterns, mitigations, recentErrors, usage }));
});

app.get('/admin/api-usage', (req, res) => res.json(getUsageStats()));

app.post('/admin/clear-cache', (req, res) => {
  geocodeCache.clear();
  placesCache.clear();
  driveTimeCache.clear();
  res.json({ success: true, message: 'All caches cleared' });
});

app.get('/admin/cache-stats', (req, res) => res.json(cacheStats()));

// ── History ───────────────────────────────────────────────────────────────────

app.get('/history', (req, res) => res.sendFile(path.join(__dirname, '../public/history.html')));

// ── PDF Export ────────────────────────────────────────────────────────────────

let activePDFs = 0;

app.get('/report/pdf', async (req, res) => {
  const address = req.query.address ? toTitleCase(req.query.address.trim()) : '';
  if (!address) return res.status(400).send('Address required');

  while (activePDFs >= MAX_CONCURRENT_PDFS) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  activePDFs++;

  let browser;
  try {
    const params = new URLSearchParams(req.query);
    params.set('fetch', '1');
    const reportUrl = `http://localhost:${port}/report?${params.toString()}`;

    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) r.abort();
      else r.continue();
    });
    await page.emulateMediaType('print');
    await page.goto(reportUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });

    const filename = `livably-report-${slugify(address)}-${getDateSlug()}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  } catch (error) {
    console.error('[PDF] generation error:', error.message);
    res.status(500).send(buildErrorHTML('SERVER_ERROR', 'PDF generation failed', 'Unable to generate PDF. Please try again.', address, null));
  } finally {
    if (browser) await browser.close().catch(() => {});
    activePDFs--;
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(port, () => console.log(`Livably app running at http://localhost:${port}`));
