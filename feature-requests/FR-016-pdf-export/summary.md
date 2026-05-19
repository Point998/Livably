# FR-016 — PDF Export: Summary

## What was built

A "Download PDF" button in every report footer that triggers server-side PDF generation via Puppeteer. The PDF is generated on-demand by navigating headless Chrome to the existing report URL (so all caching, rate limiting, and report content are reused), applying print CSS, and streaming the result back as `application/pdf` with a sanitized filename.

## Changes

**`src/app.js`**
- `slugify(text)` — lowercases and replaces non-alphanumeric runs with `-`, capped at 50 chars.
- `getDateSlug()` — returns `YYYY-MM-DD` for the current date.
- `activePDFs` semaphore (max 3 concurrent) — polls every 500ms when at capacity.
- `GET /report/pdf` route:
  1. Reconstructs the full query string from `req.query` with `fetch=1` appended.
  2. Launches Puppeteer with `--no-sandbox`.
  3. Intercepts requests to `fonts.googleapis.com` / `fonts.gstatic.com` and aborts them to reduce embedded font bloat.
  4. Calls `page.emulateMediaType('print')` so `@media print` rules apply.
  5. Navigates to `http://localhost:{PORT}/report?{params}&fetch=1` and waits for `networkidle0`.
  6. Generates a Letter-format PDF with `printBackground: true` and 0.5in margins.
  7. Returns the PDF buffer with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="livably-report-{slug}-{date}.pdf"`.
- `map-section` div gets `no-print` class (interactive maps don't render in static PDF).
- `share-section` div gets `no-print` class.
- Footer gets a `.footer-actions` div with `<a class="btn-pdf">` link that derives its `href` from `window.location.search` client-side so custom destination params are preserved.

**`public/report.css`**
- `.btn-pdf` — gold link styled as a button, placed in `.footer-actions`.
- `@media print` block: hides `.no-print` elements; sets `page-break-inside: avoid` on cards and traffic sections; removes `max-width` constraint on `body`.

## Deviations from spec

- **PDF size** — generated PDFs are ~5.5MB (vs. the <2MB spec target). Font CDN blocking reduces it from ~7.7MB, but CSS background colors are rasterized by Puppeteer's print renderer. Production optimization would require a dedicated print stylesheet that strips colored backgrounds.
- **No loading indicator during generation** — the browser's native "waiting" state (spinner in tab) serves this purpose for a prototype. A dedicated loading state would require a client-side polling/websocket approach.
- **No static map in PDF** — the interactive Google Maps section is hidden in print mode (`no-print`). The spec's static map URL approach (Google Static Maps API) would require an additional API call and is deferred.
