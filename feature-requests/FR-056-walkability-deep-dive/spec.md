# FR-056 — Walkability L3/L4 Deep Dive

## Goal
Add L3 (2-tab deep dive) and L4 (destinations data table) to the Walkability chapter, completing its depth slider integration.

## Module
`src/modules/walkability/template.js`

## Input Data Shape
```js
{
  score: number,           // 0–100 (proxy via Google Places)
  category: { label, color, description },
  destinations: [{ label, icon, name, distanceMiles, walkMinutes }],
  isProxy: true
}
```

Note: The walkability module has no location context (no county/city name). All L3/L4 content must work from score and destinations alone.

## L3 — Two-Tab Deep Dive

### Tab 1: "Walk Before Closing"
A pre-closing checklist of things worth verifying in person. Walk time data describes the address, not the experience on foot. Content is score-aware (adjusts framing for high/mid/low walkability) but always shows all 5 items.

Checklist items:
1. 🚶 Walk your top destinations — test routes in person
2. 🌃 Visit in the evening — lighting and pedestrian density shift after dark
3. 📱 Preview routes in Street View — before next visit, check sidewalk continuity
4. 🚌 Verify transit frequency if it applies — frequency and hours, not just existence
5. ♿ Check accessibility if relevant — curb cuts, ramp conditions, surface quality

Reuses `.safety-prep-item` CSS (from FR-053, already in report.css).

### Tab 2: "Research Tools"
External resources for walkability verification. Static content — no location-specific data needed.

Items:
1. 📊 Walk Score — `walkscore.com`
2. 🗺️ Google Maps Street View — `maps.google.com`
3. 🚌 City transit trip planner — generic guidance (no fixed URL)
4. 🗂️ OpenStreetMap — `openstreetmap.org` (pedestrian layer)
5. 📋 City 311 / sidewalk inventory — generic guidance (no fixed URL)

Reuses `.sensory-research-item` CSS (from FR-055, already in report.css).

## L4 — Destinations Data Table
Full table of all `walk.destinations` with columns: Category | Name | Walk Time | Distance.

Absent if `destinations` is empty or null.

Source note: Google Places API, proxy calculation.

## CRITICAL: fullHTML Already in Use
Current `renderChapterCard` call passes `walkFullHTML` (verdict block) as 9th arg.

**Must append**, not replace:
```js
const fullHTML = [walkFullHTML, l3HTML, l4HTML].filter(Boolean).join('');
return renderChapterCard(..., fullHTML || null, ...);
```

## CSS Additions
Two new classes only — all item patterns reuse existing CSS:
- `.walk-deep-dive` — `margin-top: var(--space-4)`
- `.walk-deep-dive-label` — uppercase section heading (same pattern as other chapters)

Location: after `.prem-walk-feat-note` in report.css (before `/* ── Garden Subsections ──`).

## Acceptance Criteria
- [ ] All 5 test addresses render without error
- [ ] Verdict block (category label) still visible — not replaced
- [ ] "Walk Before Closing" tab present at L3
- [ ] "Research Tools" tab present at L3
- [ ] Walk Score link present
- [ ] All destinations appear in L4 table
- [ ] L4 absent when no destinations
- [ ] CONSTRAINT-008: no inline styles
- [ ] CONSTRAINT-001: no numeric score displayed
- [ ] All existing tests still pass
- [ ] New tests cover L3 and L4
