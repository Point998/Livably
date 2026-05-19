# FR-016 — PDF Export: Implementation Plan

## Approach

Server-side PDF generation via Puppeteer (headless Chrome). The `/report/pdf` route launches Puppeteer, navigates it to the existing `/report?address=...&fetch=1` URL (picking up cache from FR-014), and calls `page.pdf()`. No separate HTML template needed — the existing report HTML is reused with print media CSS applied.

## Files changed

- `src/app.js` — `slugify()`, `getDateSlug()`, concurrency semaphore, `/report/pdf` route; `no-print` class on map section and share section; `footer-actions` + PDF link in footer
- `public/report.css` — `.btn-pdf`, `.footer-actions`; `@media print` block hiding `.no-print` elements and setting `page-break-inside: avoid` on cards
- `package.json` — `puppeteer` dependency added

## Key decisions

- **`page.goto` to self** — rather than duplicating report generation logic, the PDF route calls the running server's own `/report?...&fetch=1` URL. This reuses caching (FR-014), rate limiting (FR-015), and all existing template logic.
- **Font CDN blocking** — Google Fonts (Fraunces, DM Sans) are blocked via `page.setRequestInterception` before navigation. Prevents the fonts from being fully embedded in the PDF and reduces file size.
- **`emulateMediaType('print')`** — applied before navigation so `@media print` rules (`.no-print` hiding, `page-break-inside`) take effect in the rendered PDF.
- **Max 3 concurrent generations** — simple `activePDFs` semaphore prevents Puppeteer from being spun up more than 3 times simultaneously.
- **Client-side URL construction** — the "Download PDF" button uses `onclick` to derive its `href` from `window.location.search` so custom destination params are automatically included.
