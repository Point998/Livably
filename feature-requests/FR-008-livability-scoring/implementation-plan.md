# FR-008 — Location Insights: Implementation Plan

## Approach

Add a "Things to Know" chapter card above the existing "Daily Reachability" card. No numeric scoring — pure narrative generation from existing service data. No new dependencies.

## Functions added to `src/app.js`

- `generateDailyConveniencesNarrative(grocery, pharmacy)` — avg drive time determines tone tier; gas station deferred to FR-009
- `generatePeaceOfMindNarrative(hospital, urgentCare)` — hospital distance drives opening; urgentCare mentioned if meaningfully closer
- `generateGettingAroundNarrative(highwayRamp)` — three tone tiers (<5, 5–15, >15 min)
- `generateCallouts(grocery, pharmacy, hospital)` — hospital >30, grocery >30, all-avg >40
- `buildInsightItemsHTML(items)` — renders breakdown rows
- `buildInsightSectionHTML(icon, title, subtitle, narrative)` — renders a full section; no-ops if narrative is null
- `buildInsightsCardHTML(grocery, pharmacy, hospital, urgentCare, highwayRamp)` — orchestrates all sections into a chapter-card

## Template change

`buildReportHTML` now calls `buildInsightsCardHTML` and inserts the result between the map section and the Chapter 03 card.

## CSS added to `public/report.css`

Styles for: `.insights-body`, `.insights-intro`, `.insight-section`, `.insight-header`, `.insight-icon`, `.insight-title`, `.insight-subtitle`, `.insight-opening`, `.insight-details`, `.insight-breakdown`, `.insight-item`, `.item-label`, `.item-place`, `.item-time`, `.insight-callout`, `.callout-icon`, `.callout-title`, `.callout-message`.

## Notes

- `grocery` is an array; `grocery[0]` (closest) used throughout
- All services are null-safe; missing services are omitted from narrative and breakdown rows
- Gas station excluded from Daily Conveniences pending FR-009
