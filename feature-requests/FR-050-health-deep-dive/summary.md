# FR-050 Summary — Health L3/L4 Deep Dive

**Status:** Shipped — June 2026

## What Shipped

**Data fix:** `urgentCare` was being fetched but silently dropped — now threaded as 3rd param to `buildHealthSafetyChapterHTML`. Call site in `reportPage.js` updated.

**L3 — "Medical Access in Depth" (3 tabs inside `depth-l3`):**
- **Urgent Care** — Nearest urgent care clinic with drive time, address, comparison to ER drive time. Cross-state warning when applicable. Graceful fallback with Solv Health + Urgent Care Association links when no data.
- **Station Details** — Fire + Police/EMS stations with name, address, distance, response time badge. Conditional — hidden when no emergency data.
- **ISO Fire Rating** — Static education on ISO PPC classes 1–10 with premium implications. CTA to call insurance agent. Incorporates fire station response time contextually. Always rendered.

**L4 — facilities table:**
- 4 rows: Emergency Room, Urgent Care (when present), Fire Station, Police/EMS
- Columns: Type, Name, Address, Time

**CSS:** `.health-deep-dive`, `.health-deep-dive-label`, `.health-station-detail`, `.health-station-detail-hd`, `.health-iso-grid`, `.health-iso-row`, `.health-iso-class`, `.health-iso-desc`

## Commits
- `c5b8a12` feat(fr-050): thread urgentCare param to health chapter template
- `731aa04` feat(fr-050): add L3 deep dive HTML to health chapter (3 tabs)
- `38e9a7b` feat(fr-050): add L4 research table to health chapter
- `0c40c0c` feat(fr-050): add health L3/L4 CSS
- `718960b` fix(fr-050): use --space-80 token for health-iso-class min-width

## Constraints Met
- CONSTRAINT-008: No inline styles ✅
- CONSTRAINT-009: No business logic in template ✅
- CONSTRAINT-011: Tests written alongside ✅
- CONSTRAINT-015: Urgent Care tab shows actionable fallback links when urgentCare is null ✅

## Notes
- Health chapter uses a custom `<section>` structure (not `renderChapterCard`) — L3/L4 inserted inside `chapter-inner` before `renderDepthSelector`
- `--space-80` token used for `min-width` on ISO class label (corrected from hardcoded 80px during code review)
