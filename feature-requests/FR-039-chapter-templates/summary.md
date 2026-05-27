# FR-039 Summary — Chapter Templates

**Branch:** `fr-039-chapter-templates`
**Merged:** 2026-05-27
**Status:** Complete

---

## What Was Done

Extracted all chapter HTML generator functions from `src/premium.js` and `src/app.js` into `src/templates/chapters/` — one file per chapter. Each file imports from `src/templates/components/` (FR-038) and `src/utils/`.

### Files Created

```
src/templates/components/chapterCard.js   ← premiumCard extracted here
src/templates/chapters/climate.js
src/templates/chapters/garden.js
src/templates/chapters/schools.js
src/templates/chapters/safety.js          ← buildCrimeHTML + buildEmergencyServicesHTML
src/templates/chapters/sensory.js
src/templates/chapters/walkability.js
src/templates/chapters/costs.js
src/templates/chapters/community.js
src/templates/chapters/growth.js
src/templates/chapters/property.js
src/templates/chapters/health.js
src/templates/chapters/reachability.js
src/templates/chapters/traffic.js
src/templates/chapters/index.js           ← re-exports all chapter functions
```

### What Changed in premium.js / app.js

Each extracted function was replaced with a single `require` import. `buildPremiumSectionsHTML` is the only HTML-assembling function remaining in `premium.js` — it is now a 16-line orchestrator that calls the extracted chapter functions.

---

## Acceptance Criteria

- [x] All `build*HTML` functions removed from premium.js body (replaced with requires)
- [x] All `build*HTML` functions removed from app.js body (replaced with requires)
- [x] `buildPremiumSectionsHTML` ≤ 30 lines (16 lines)
- [x] `npm test` — 145 tests passing, no regressions
- [x] Server loads (`node -e "require('./src/app')"`)
- [x] Zero `style=""` attributes in any chapter file
- [ ] Tests in `tests/templates/chapters/` — deferred to FR-040 (constraint coverage tests)

---

## What's Next

- FR-040: Test suite — will add `tests/templates/chapters/` coverage for CONSTRAINT-008 (no inline styles) and CONSTRAINT-009 (no layer violations)
- FR-041: Services and routes — final architectural extraction, slims `app.js` to ~30 lines
