# FR-029 — CH01: Health & Safety — Implementation Plan

## Tasks

1. Add `buildHealthSafetyChapterHTML(hospital, emergency)` to `src/app.js`
   - ER section: narrative paragraph derived from drive time (≤10 cool, 10–20 consider, >20 consider)
   - Fire + police row: station name, distance, response badge (color-coded)
   - Things to Check: 3 static action items (ISO rating, ER route, detectors)
   - Key Takeaway: dynamic, based on worst metric

2. Wire into `buildReportHTML`
   - Add call after premiumSectionsHTML / keyInsightsHTML lines
   - Insert in HTML after `${keyInsightsHTML}`, before `${insightsCardHTML}`

3. No new CSS needed — uses existing `.chapter-card`, `.chapter-header`, `.chapter-body` classes
   - Reuse `.prem-inline-badge` for response-time badges (already defined)
   - Add `.ch01-station-row` minimal inline style if needed

4. Test on Georgetown, Harlan, Louisville — verify chapter renders and data is correct
5. Write summary.md

## Risks / Notes

- `premium.emergency` is always fetched (per FR-022 design), so standard display is safe
- Response time is estimated (not measured) — disclaimer present in existing `buildCrimeHTML`; add same disclaimer to CH01
- Do NOT remove `buildCrimeHTML` from premium — it provides deeper narrative and research actions that CH01 doesn't duplicate
