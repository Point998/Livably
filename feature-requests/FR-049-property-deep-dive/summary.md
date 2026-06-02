# FR-049 Summary — Property Intelligence Deep Dive (L3/L4)

**Status:** Shipped — May 2026

## What Shipped

**L3 — "Property in Depth" (3 tabs inside `depth-l3`):**
- **Internet Providers** — Full provider list with download + upload speeds, tech type, fiber badge. Remote-work note when upload ≥ 100 Mbps available. Fallback to FCC Broadband Map link when no data.
- **Soil & Foundation** — USDA soil map unit name, drainage class badge with plain-English implication, hydric soil indicator with foundation/drainage warning.
- **Building Age** — Decade-by-decade housing age distribution (prem-age-row bars). Era risk callouts: pre-1978 lead paint, pre-1990 asbestos, post-1990 safer construction. Fallback when no ACS data.

**L4 — Research:**
- Full broadband provider table (all providers × all speed/tech columns)
- USDA soil reference row (map unit, drainage class, hydric)
- Housing age raw counts table (decade bands)
- County assessor and building department research links

## Commits
- `6c15d70` feat(fr-049): add L3/L4 deep dive HTML for property chapter
- `c1d7c5e` fix(fr-049): correct badge classes, add CSS for property L3 classes
- `6cf203e` test(fr-049): add L3/L4 template tests for property chapter
- `1729ded` test(fr-049): fix negative assertions and add threshold negative test
- `7db1573` fix(fr-049): use correct ink token names in property L3 CSS

## Constraints Met
- CONSTRAINT-008: No inline styles ✅
- CONSTRAINT-009: No API calls in template ✅
- CONSTRAINT-011: Tests written alongside implementation ✅
- CONSTRAINT-015: Graceful degradation — all tabs have fallback content when data unavailable ✅

## Notes
- Property chapter uses `renderChapterCard` — L3/L4 passed as `fullHTML` (9th param)
- Building age bands required adding ACS vars B25034_004E–_011E to `getPropertyIntelligence` data fetch
- `buildHousingAgeBands` logic function added to `property/logic.js`
