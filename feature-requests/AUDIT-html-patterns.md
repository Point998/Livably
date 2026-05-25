# AUDIT: HTML/CSS Class Name Mismatch — All Chapter Functions

**Date:** May 2026  
**Root cause:** CSS was rebuilt with new class names; HTML generators were not updated to match. Result: every premium chapter renders as an unstyled text dump because the generated class names have zero CSS rules.

---

## The Core Problem

`report.css` defines styles for one set of class names.  
`premium.js` and `app.js` generate HTML using a *different* set of class names.  
Neither set matches the other. CSS cannot fix what the HTML isn't building.

### Example — Schools Chapter

**CSS defines:**
- `.prem-school-warning` (warning banner)
- `.prem-school-name`, `.prem-school-meta` (school items)
- `.prem-school-checklist`, `.prem-school-check-item` (checklist)

**HTML generates:**
- `.prem-school-assigned-alert` — **no CSS**
- `.prem-school-card`, `.prem-school-header`, `.prem-school-level` — **no CSS**
- `.prem-school-choice-section`, `.prem-school-choice-item` — **no CSS**
- `.prem-narrative`, `.prem-narrative-lead`, `.prem-narrative-body` — **no CSS anywhere**

---

## Classes with NO CSS (generated but unstyled)

These appear in HTML output but have zero rules in report.css:

```
prem-narrative                  prem-narrative-lead        prem-narrative-body
prem-school-assigned-alert      prem-school-assigned-icon  prem-school-assigned-text
prem-school-assigned-action     prem-school-card           prem-school-header
prem-school-level               prem-school-addr           prem-school-time
prem-school-dist                prem-school-section-label  prem-school-choice-section
prem-school-choice-label        prem-school-choice-item    prem-school-choice-meta
prem-emergency-card             prem-emergency-head        prem-emergency-label
prem-emergency-name             prem-emergency-addr        prem-emergency-dist
prem-walk-header                prem-walk-desc             prem-walk-section-label
prem-walk-dests                 prem-walk-dest             prem-walk-dest-icon
prem-walk-dest-info             prem-walk-dest-name        prem-walk-dest-cat
prem-walk-dest-time             prem-walk-dest-dist        prem-walk-features
prem-walk-feat-yes              prem-walk-feat-note        prem-walk-feature (partial)
prem-demo-grid                  prem-demo-card             prem-demo-title
prem-demo-big                   prem-demo-sub              prem-demo-note
prem-edu-stats                  prem-edu-pct               prem-edu-lbl
prem-community-item             prem-synthesis-line        prem-carrying-section
prem-carrying-label             prem-carrying-note         prem-market-note
prem-market-note-icon           prem-homestead-note        prem-growth-section
prem-growth-label               prem-growth-named-projects prem-growth-named-project-header
prem-growth-named-project-icon  prem-growth-named-project-title prem-growth-named-project-type
prem-growth-named-project-timeline prem-growth-named-project-impact prem-growth-source-link
prem-growth-automated-note      prem-growth-places         prem-growth-place
prem-growth-place-icon          prem-growth-place-info     prem-growth-place-name
prem-growth-place-cat           prem-growth-place-dist     prem-intel-section
prem-intel-cautions             prem-intel-caution-label   prem-intel-caution-list
prem-intel-bb-providers         prem-intel-bb-provider     prem-intel-bb-name
prem-intel-bb-tech              prem-intel-bb-speed        prem-sensory-section
prem-climate-tornadoes          prem-climate-wildfire      prem-climate-heat
grow-subsection                 grow-subsection-label      grow-ext-cta
prem-safety-actions             prem-safety-action         prem-safety-action-icon
prem-safety-action-text         prem-safety-action-label   prem-safety-action-detail
prem-safety-actions-label       prem-disclaimer            snapshot-card (partial)
```

---

## Classes WITH CSS but HTML uses different names

| CSS class | What HTML generates instead |
|---|---|
| `.prem-school-warning` | `.prem-school-assigned-alert` |
| `.prem-safety-station` | `.prem-emergency-card` |
| `.prem-safety-station-name` | `.prem-emergency-name` |
| `.prem-safety-station-meta` | `.prem-emergency-addr` |
| `.prem-growth-named-project-desc` | `.prem-growth-named-project-impact` |
| `.prem-growth-commercial` | `.prem-growth-section` (partial) |
| `.prem-growth-commercial-title` | `.prem-growth-label` |
| `.prem-growth-commercial-item` | `.prem-growth-place` |
| `.prem-climate-stat` | no equivalent generated |
| `.grow-plant-item` | no equivalent generated |
| `.grow-soil-intro` | no equivalent generated |
| `.prem-demo-stat-num` | `.prem-demo-big` |
| `.prem-demo-stat-label` | `.prem-demo-sub` |
| `.prem-intel-era-desc` | not generated |
| `.prem-era-num` | not generated |

---

## Function-by-Function Verdict

### `src/app.js`

| Function | Status | Issues |
|---|---|---|
| `buildHealthSafetyChapterHTML` | NEEDS WORK | `.snapshot-card` wrapper in right col, `ch01-response-badge` inline styles |
| `buildInsightsCardHTML` (daily) | MOSTLY OK | `.prem-narrative` wrapper inside with no CSS |
| Reachability chapter (inline) | MOSTLY OK | Paragraphs unstyled |
| `buildTrafficCardHTML` | OK | Full-width bars work, traffic CSS exists |
| `buildCustomDestinationsCardHTML` | NEEDS WORK | Right column empty; no full-width moment |
| `buildAdditionalServicesCardHTML` | BROKEN | No `section.chapter` wrapper, no header, inline styles |

### `src/premium.js`

| Function | Status | Issues |
|---|---|---|
| `buildSchoolRatingsHTML` | BROKEN | Every content class name wrong; text dump with no styling |
| `buildCrimeHTML` | BROKEN | `.prem-safety-action*` classes undefined; inline `badgeColor()` |
| `buildSensoryEnvironmentalHTML` | BROKEN | `.prem-sensory-section`, `.prem-narrative*` undefined |
| `buildEmergencyServicesHTML` | BROKEN | `.prem-emergency-card` undefined |
| `buildWalkabilityHTML` | BROKEN | All dest/feature classes undefined; heavy inline styles |
| `buildPropertyDataHTML` | BROKEN | `.prem-carrying-section`, `.prem-market-note` undefined |
| `buildDemographicsHTML` | BROKEN | `.prem-demo-grid`, `.prem-demo-card`, all community classes undefined |
| `buildGrowthAndDevelopmentHTML` | BROKEN | Wrong class names throughout; inline `color` styles |
| `buildPropertyIntelligenceHTML` | BROKEN | `.prem-intel-section`, `.prem-intel-bb*`, `.prem-intel-caution*` undefined |
| `buildWhatWillGrowHTML` | PARTIAL | `.grow-subsection*`, `.grow-ext-cta` undefined; plant/wildlife items not built |
| `buildClimateChapterHTML` | PARTIAL | Flood banner works; narrative/risk rows use undefined classes |

---

## What's Actually Working

These CSS-HTML pairs are correctly matched:
- Chapter outer structure (section.chapter, chapter-num, chapter-hd, chapter-body, chapter-left/right) ✓
- Chapter color identities via `data-ch` ✓
- `.ch01-*` classes in health chapter ✓
- `.prem-flood-zone-*` classes in climate full-width ✓
- `.grow-frost-*` classes in garden full-width ✓  
- `.prem-bortle-*` classes in sensory full-width ✓
- `.walk-verdict-block` and `.walk-score-*` in walkability full-width ✓
- `.prem-age-row/track/fill/pct` in demographics ✓
- `.key-takeaway` across all chapters ✓
- `.traffic-bar`, `.traffic-row` in traffic chapter ✓
- `.dest-grid`, `.dest-item` in reachability ✓

---

## Rebuild Action

Every function flagged BROKEN or NEEDS WORK is being rebuilt from scratch.  
HTML generators are being rewritten to match CSS classes that exist.  
New shared CSS classes being added for common patterns (narrative text, data rows, cards, badges).

See commit history for rebuild sequence.
