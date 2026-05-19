# FR-008 — Location Insights: Summary

## What was built

A "Things to Know" chapter card that appears between the map and the "Daily Reachability" data card. It generates narrative prose from existing service data — no numeric scores, no new dependencies.

## Changes

**`src/app.js`** — added seven functions before `buildReportHTML`:

1. `generateDailyConveniencesNarrative(grocery, pharmacy)` — averages grocery/pharmacy drive times; assigns one of four tone tiers (everything nearby → plan your trips). Returns `{ opening, details, items }`. Gas station excluded pending FR-009.

2. `generatePeaceOfMindNarrative(hospital, urgentCare)` — three opening tones (<15, 15–25, >25 min). Mentions urgent care as a closer alternative only when it saves 5+ minutes vs. the hospital.

3. `generateGettingAroundNarrative(highwayRamp)` — three tone tiers (<5, 5–15, >15 min highway access).

4. `generateCallouts(grocery, pharmacy, hospital)` — emits "Worth Noting" callouts for hospital >30 min and grocery >30 min; emits "Heads Up" for all-average >40 min (remote location framing).

5. `buildInsightItemsHTML(items)` — renders the breakdown grid rows.

6. `buildInsightSectionHTML(icon, title, subtitle, narrative)` — renders a full insight section; returns empty string if narrative is null (graceful degradation when a service lookup failed).

7. `buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp)` — orchestrates all three sections and any callouts into a `chapter-card` div. Returns empty string if all sections are empty.

`buildReportHTML` now calls `buildInsightsCardHTML` and injects the result between `${mapSectionHTML}` and the Chapter 03 card.

**`public/report.css`** — added styles for all insight section elements, using existing design tokens (`--ink`, `--muted`, `--divider`, `--cream`, `--gold`). `.insight-item` uses a `80px 1fr auto` grid that fits comfortably within the 480px max-width layout.

## Test status

Syntactically verified (`node --check` passes). Live testing requires a running server with a valid API key.

## Deviations from spec

- Gas station excluded from Daily Conveniences (added in FR-009).
- "Chapter label" uses "Things to Know" (not a numbered chapter) to distinguish it from the data card below.
