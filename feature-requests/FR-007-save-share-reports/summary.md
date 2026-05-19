# FR-007 — Save/Share Reports: Summary

## What was built

Shareable report URLs via a JSON file-backed store and a "Share this report" button in the hero section.

## Changes

**`src/app.js`** — five modifications:

1. Added `fs` and `crypto` requires (no new npm packages).

2. Storage layer — `DATA_DIR`/`REPORTS_FILE` constants plus five functions: `ensureReportsFile` (creates `data/` and `reports.json` if missing), `loadReports` (JSON parse with fallback), `saveReport` (generates collision-safe 8-hex-char ID, writes entry), `getReport` (ID lookup), `updateReportAccess` (stamps `lastAccessed`).

3. `buildReportHTML` — accepts `reportId` in destructured params. Builds `shareSectionHTML`: a gold outline "Share this report" button and a hidden toast span, plus an inline IIFE that wires click → `navigator.clipboard.writeText('/r/' + id)` with a 3-second toast confirmation and a `prompt()` fallback for older browsers. Inserted inside `.hero` after `.hero-date`.

4. `/report` route — after building the report, calls `saveReport(address)` inside a try/catch (failure silently passes `null`), then passes `reportId` to `buildReportHTML`.

5. `/r/:reportId` route — looks up address, calls `updateReportAccess`, redirects to `/report?address=...`. Returns a 404 error page for unknown IDs.

**`public/report.css`** — added `.share-section` (flex row with gap), `.share-button` (gold outline, hover fills gold), `.share-toast` / `.share-toast.hidden` (muted text, toggled by JS).

## Test status

Code is syntactically verified (`node --check` passes). Live testing requires a running server with a valid Google Maps API key (same requirement as FR-006).

## Deviations from plan

- Used `crypto.randomBytes` instead of `nanoid` to avoid a new dependency.
- Each report visit generates a fresh ID (no same-address deduplication); both options were listed as acceptable in the spec.
