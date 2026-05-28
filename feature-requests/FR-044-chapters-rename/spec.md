# FR-044 Spec — Chapters Rename

**Status:** Complete  
**Branch:** fr-039-chapter-templates (included in same cleanup pass)

## Problem

`src/premium.js` and its exported identifiers (`getPremiumData`, `buildPremiumSectionsHTML`) use a "premium" naming artifact from FR-022, which specced a Stripe paywall that was never implemented. Every report already receives these chapters — the word "premium" implies a paywall that doesn't exist and creates architectural confusion.

## Change

| Old | New |
|-----|-----|
| `src/premium.js` | `src/chapters.js` |
| `getPremiumData` | `getChapterData` |
| `buildPremiumSectionsHTML` | `buildChaptersHTML` |
| `premium` variable in reportBuilder.js | `chapters` |
| `premiumSectionsHTML` variable in reportPage.js | `chapterSectionsHTML` |
| `premium` parameter in reportPage.js functions | `chapters` |

## Scope

No behavior change. Pure rename. All 189 tests pass.

## Files Changed

- `src/premium.js` → deleted; replaced by `src/chapters.js`
- `src/services/reportBuilder.js` — updated require + variable names
- `src/templates/pages/reportPage.js` — updated require + function params + variable names
- `src/templates/chapters/climate.js` — comment update only
- `src/utils/constants.js` — comment update only
- `tests/services/reportBuilder.test.js` — updated mock names
- `tests/templates/pages/reportPage.test.js` — updated parameter name in test data

## Also Done

- Deleted `feature-requests/FR-022-premium-monetization/` — Stripe paywall strategy abandoned.
