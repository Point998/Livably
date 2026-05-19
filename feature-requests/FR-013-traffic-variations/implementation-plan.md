# FR-013 — Traffic Variations: Implementation Plan

## Approach

Server-side. After the main service lookups complete, run 4 parallel Distance Matrix calls per destination (8am Mon, 12pm Mon, 5pm Mon, 10am Sat). Render as a "Traffic Patterns" chapter card with a CSS bar chart — no canvas/SVG required.

## Files changed

- `src/app.js` — `getNextDayAt()`, `getTrafficVariations()`, `buildTrafficItemHTML()`, `buildTrafficCardHTML()`, route update, `buildReportHTML` signature
- `public/report.css` — traffic card styles (bar chart, tags, stat row)

## Key decisions

- **Always-on** — traffic analysis runs on every report for grocery and hospital; no opt-in toggle. Matches acceptance criteria.
- **Work custom destinations included** — custom dests with `type === 'work'` are appended to the traffic targets list.
- **`Promise.allSettled` per slot** — a single time slot failure (e.g. API quota) doesn't cancel the other 3; the card still renders with available data.
- **`getNextDayAt(targetDay, hour)`** — generic helper (0=Sun…6=Sat) that always returns a future Unix timestamp, adding 7 days if the candidate time has already passed today. Replaces the narrower `getNextTuesday8am` pattern for the 4 traffic slots.
- **Color palette** — best: #3d9970 (muted green), good: gold, mid: #e07b39 (amber), worst: #c0392b (warm red). Warm palette coheres with the cream/gold design system.
- **Bar widths** — `width = (minutes / max) * 100%` so worst time is always 100% wide and others scale relative to it.
