# FR-011 — Report History: Summary

## What was built

Browser localStorage history: every report visit saves the address, a timestamp, and a unique ID. A `/history` page lists all entries most-recent-first with per-entry delete and a clear-all button. The homepage shows the 3 most recent searches above the form, plus "View history" and "Compare addresses" footer links.

## Changes

**`public/history.html`** (new) — static page loaded by the `/history` express route. On load, reads `livablyHistory` from localStorage and renders a list of history items (address, formatted date, View Report link, delete button). Shows an empty state when history is absent. "Clear all" confirms before removing.

**`public/index.html`** — added:
1. `#recentSearches` section (hidden by default): JS reads localStorage on load and renders up to 3 recent addresses as clickable links above the form.
2. `.form-footer-links` row below the form: "View history" (`/history`) and "Compare addresses" (`/compare`).

**`src/app.js`** — two additions:
1. `GET /history` route → `res.sendFile('public/history.html')`.
2. `saveHistoryScriptHTML` — inline IIFE injected just before `</body>` in every report page. Reads existing history, moves duplicate address to front (deduplication), unshifts the new entry, caps at 50, writes back. Wrapped in `try/catch` so localStorage errors (private browsing, quota) never break the report.

**`public/report.css`** — added styles for: history page layout, `.history-item` cards, delete/clear buttons, `.history-empty` state; homepage `.recent-searches`, `.recent-label`, `.recent-item` links; `.form-footer-links` / `.form-footer-link`.

## Deviations from spec

- No livability score stored or displayed (FR-008 removed scoring).
- `/history.html` is a static file served via express `sendFile`; it is not a server-rendered route.
