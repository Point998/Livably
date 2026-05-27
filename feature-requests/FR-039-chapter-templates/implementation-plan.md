# FR-039 Implementation Plan — Chapter Templates

**Branch:** `fr-039-chapter-templates`
**Approach:** Faithful extraction — move HTML generation as-is, no rewriting.
**Rule:** One chapter per stage, one commit per stage. Run `node -e "require('./src/app')"` after every stage.

---

## Chapter Map (what moves where)

### From premium.js
| Function | Lines | Target file |
|----------|-------|------------|
| `buildClimateChapterHTML` | 392–518 (~127) | `src/templates/chapters/climate.js` |
| `buildWhatWillGrowHTML` | 1109–1294 (~186) | `src/templates/chapters/garden.js` |
| `buildSchoolRatingsHTML` | 1537–1659 (~123) | `src/templates/chapters/schools.js` |
| `buildCrimeHTML` | 1660–1767 (~108) | `src/templates/chapters/safety.js` |
| `buildSensoryEnvironmentalHTML` | 1768–1974 (~207) | `src/templates/chapters/sensory.js` |
| `buildEmergencyServicesHTML` | 1975–2022 (~48) | appended to `safety.js` |
| `buildWalkabilityHTML` | 2023–2126 (~104) | `src/templates/chapters/walkability.js` |
| `buildPropertyDataHTML` | 2127–2220 (~94) | `src/templates/chapters/costs.js` |
| `buildDemographicsHTML` | 2221–2348 (~128) | `src/templates/chapters/community.js` |
| `buildGrowthAndDevelopmentHTML` | 2349–2506 (~158) | `src/templates/chapters/growth.js` |
| `buildPropertyIntelligenceHTML` | 2507–2642 (~136) | `src/templates/chapters/property.js` |
| `buildPremiumSectionsHTML` | 2643–end | stays in premium.js as thin orchestrator |

### From app.js
| Function | Lines | Target file |
|----------|-------|------------|
| `buildHealthSafetyChapterHTML` | 394–497 (~104) | `src/templates/chapters/health.js` |
| `buildInsightsCardHTML` + `buildCustomDestinationsCardHTML` + `buildAdditionalServicesCardHTML` + helper sections | 498–619 | `src/templates/chapters/reachability.js` |
| `buildTrafficItemHTML` + `buildTrafficCardHTML` | 621–679 (~59) | `src/templates/chapters/traffic.js` |

### Shared component (new — discovered during planning)
`premiumCard` (premium.js line 1511) wraps all premium chapters — move to `src/templates/components/chapterCard.js` so each chapter file can import it.

Also move `badgeColor` → already in `src/templates/components/badge.js` as `badgeClass`. Chapters import `badgeClass` instead.

---

## Key Decisions

### 1. Faithful extraction — no rewriting
Copy each function to its target file unchanged. Replace the original in premium.js/app.js with:
```js
const { buildClimateChapterHTML } = require('../templates/chapters/climate');
```
This is the only change in premium.js/app.js per stage. No logic changes.

### 2. Double-escaping fix for checklist details
Some detail fields are built with `${escapeHtml(city)}` interpolated, then passed to a template that also calls `escapeHtml`. During extraction, remove pre-escaping from dynamic interpolations within detail strings — the component handles it:
```js
// Before (in premium.js):
detail: `Call the police at ${escapeHtml(city)} station.`
// After (in chapter template):
detail: `Call the police at ${city} station.`
```
Only applies to values that are already safe strings from the API (city, county names from geocoding).

### 3. premiumCard moves to components first (Stage 1)
All 11 premium chapters depend on `premiumCard`. Extract it to a component before extracting any chapter. Each chapter file will `require('../components/chapterCard')`.

### 4. No tests required per chapter (FR-040 handles this)
FR-039 is faithful extraction. Correctness is verified by: (a) server loads without error, (b) all existing tests pass, (c) manual spot-check of one report after all stages complete.

---

## Ordered Stages

### Stage 0 — Create branch
```
git checkout -b fr-039-chapter-templates
```

### Stage 1 — Extract `premiumCard` to `src/templates/components/chapterCard.js`
- Copy `premiumCard` to new component file
- Export as `renderChapterCard`
- Replace in premium.js with `const { renderChapterCard } = require('./templates/components/chapterCard')`
- Update all `return premiumCard(...)` calls in premium.js to `return renderChapterCard(...)`
- Verify: `node -e "require('./src/premium')"` + `npm test`

### Stage 2 — Extract `buildClimateChapterHTML` → `climate.js`
- Import: `escapeHtml`, `badgeClass` (from components, replacing `badgeColor`), `renderChapterCard`
- Replace original in premium.js with require + forward call

### Stage 3 — Extract `buildWhatWillGrowHTML` → `garden.js`

### Stage 4 — Extract `buildSchoolRatingsHTML` → `schools.js`

### Stage 5 — Extract `buildCrimeHTML` + `buildEmergencyServicesHTML` → `safety.js`
Both functions are in safety chapter territory — export both from same file.

### Stage 6 — Extract `buildSensoryEnvironmentalHTML` → `sensory.js`

### Stage 7 — Extract `buildWalkabilityHTML` → `walkability.js`

### Stage 8 — Extract `buildPropertyDataHTML` → `costs.js`

### Stage 9 — Extract `buildDemographicsHTML` → `community.js`

### Stage 10 — Extract `buildGrowthAndDevelopmentHTML` → `growth.js`

### Stage 11 — Extract `buildPropertyIntelligenceHTML` → `property.js`

### Stage 12 — Verify premium.js orchestrator
After stage 11, `buildPremiumSectionsHTML` should be the only HTML-generating function remaining in premium.js. Verify: `grep -n "return \`" src/premium.js | wc -l` should be dramatically reduced.

### Stage 13 — Extract app.js chapters
- `buildHealthSafetyChapterHTML` → `health.js`
- `buildInsightsCardHTML` + helpers → `reachability.js`
- `buildTrafficItemHTML` + `buildTrafficCardHTML` → `traffic.js`

### Stage 14 — Create `src/templates/chapters/index.js`
Re-exports all chapter functions.

### Stage 15 — Full verification
- `npm test` — all 145 tests pass, no regressions
- `node -e "require('./src/app')"` — server loads
- Smoke test: run server, request one report, visually verify it renders

### Stage 16 — Summary, commit, push

---

## Per-Stage Extraction Pattern

For each chapter function:

```
src/templates/chapters/<name>.js
---
'use strict';
const { escapeHtml, formatDriveTime, ... } = require('../../utils/text');
const { badgeClass, renderChapterCard, ... } = require('../components');
// [paste function body, replacing badgeColor with badgeClass]
module.exports = { build<Name>HTML };
```

```
src/premium.js (replacement)
---
// Replace function definition with:
const { build<Name>HTML } = require('./templates/chapters/<name>');
```

---

## Files Created
```
src/templates/components/chapterCard.js
src/templates/chapters/climate.js
src/templates/chapters/garden.js
src/templates/chapters/schools.js
src/templates/chapters/safety.js
src/templates/chapters/sensory.js
src/templates/chapters/walkability.js
src/templates/chapters/costs.js
src/templates/chapters/community.js
src/templates/chapters/growth.js
src/templates/chapters/property.js
src/templates/chapters/health.js
src/templates/chapters/reachability.js
src/templates/chapters/traffic.js
src/templates/chapters/index.js
```

## Definition of Done
- [ ] All `build*HTML` functions removed from premium.js body
- [ ] All `build*HTML` functions removed from app.js body
- [ ] `buildPremiumSectionsHTML` ≤ 30 lines
- [ ] app.js HTML-generating functions reduced to `buildReportHTML` + error/loading/compare pages
- [ ] `npm test` 145 tests passing
- [ ] Server loads and renders a full report
- [ ] Zero `style=""` in any chapter file
