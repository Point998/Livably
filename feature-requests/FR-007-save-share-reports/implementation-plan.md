# FR-007 — Save/Share Reports: Implementation Plan

## Approach

- **Storage**: JSON file at `data/reports.json` (Phase 1 prototype, no new dependencies)
- **ID generation**: `crypto.randomBytes(4).toString('hex')` → 8 hex chars, collision-safe loop
- **No new npm packages** — uses built-in `fs` and `crypto`

## Changes

### `src/app.js`

1. Added `fs` and `crypto` requires
2. Added storage constants: `DATA_DIR`, `REPORTS_FILE`
3. Added storage functions: `ensureReportsFile`, `loadReports`, `saveReport`, `getReport`, `updateReportAccess`
4. Modified `buildReportHTML` to accept `reportId` in destructured params; injects share button + clipboard JS into hero section
5. Modified `/report` route: calls `saveReport(address)` after data fetch, passes `reportId` to `buildReportHTML` (failures silently fall back to no share button)
6. Added `/r/:reportId` route: looks up address, updates `lastAccessed`, redirects to `/report?address=...`
7. Calls `ensureReportsFile()` at startup

### `public/report.css`

Added `.share-section`, `.share-button`, `.share-button:hover`, `.share-toast`, `.share-toast.hidden` styles — gold outline button matching design system.

## Notes

- Each report generation produces a new ID (even for the same address); deduplication not implemented
- Share button only renders when `reportId` is available; fails silently if storage errors
- `/r/:reportId` → redirect → loading page → fresh report fetch (new ID generated on the shared load)
- `data/reports.json` should be added to `.gitignore` if not already present
